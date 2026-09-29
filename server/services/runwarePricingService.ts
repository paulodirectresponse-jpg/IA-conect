import type { GenerationMode } from '../../src/types/index.js';
import type { ProviderGenerationParams } from '../adapters/videoProviderAdapter.js';
import type { RoutingV2BillingConfig } from '../routing-v2/domain.js';

const PRICING_BASE='https://content.runware.ai/models/';
const CACHE_TTL_MS=5*60_000;
const REQUEST_TIMEOUT_MS=6_000;

export interface RunwarePricingRate{amount:number;unit:string;label?:string;after?:number;}
export interface RunwarePricingMetadata{air?:string;status?:string;pricingRates?:RunwarePricingRate[];}
export interface RunwarePriceDimensions{
  provider_model_identifier:string;capability_id:string;mode?:GenerationMode;resolution?:string;
  duration_seconds?:number;number_of_outputs?:number;image_reference_count?:number;video_reference_count?:number;
  model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
}

interface PricingCacheEntry{expires_at:number;value:RunwarePricingMetadata;}
const pricingCache=new Map<string,PricingCacheEntry>();
const inFlight=new Map<string,Promise<RunwarePricingMetadata>>();

function pricingUrl(identifier:string){return PRICING_BASE+encodeURIComponent(identifier)+'/pricing';}
function pricingError(message:string,code:string){return Object.assign(new Error(message),{code});}

export async function fetchRunwarePricingMetadata(identifier:string):Promise<RunwarePricingMetadata>{
  const air=String(identifier||'').trim();
  if(!air)throw pricingError('Identificador Runware vazio.','RUNWARE_MODEL_IDENTIFIER_REQUIRED');
  const cached=pricingCache.get(air);
  if(cached&&cached.expires_at>Date.now())return cached.value;
  const pending=inFlight.get(air);
  if(pending)return pending;
  const request=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(pricingUrl(air),{headers:{Accept:'application/json'},signal:controller.signal});
      const text=await response.text();
      if(!response.ok){
        const excerpt=text.trim().slice(0,240);
        const message=response.status===404
          ?'Modelo não encontrado no catálogo público atual do Runware (HTTP 404).'
          :'Catálogo público de preços do Runware respondeu HTTP '+response.status+(excerpt?': '+excerpt:'')+'.';
        throw pricingError(message,'RUNWARE_PRICE_CATALOG_HTTP_'+response.status);
      }
      let metadata:RunwarePricingMetadata;
      try{metadata=JSON.parse(text) as RunwarePricingMetadata;}
      catch{throw pricingError('Catálogo Runware retornou JSON inválido.','RUNWARE_PRICE_CATALOG_INVALID');}
      if(String(metadata?.air||'').trim()!==air)throw pricingError('AIR do catálogo não corresponde ao identificador solicitado.','RUNWARE_PRICE_MODEL_MISMATCH');
      if(String(metadata?.status||'').toLowerCase()!=='live')throw pricingError('Modelo Runware não está marcado como live no catálogo público.','RUNWARE_MODEL_NOT_LIVE');
      if(!Array.isArray(metadata.pricingRates))throw pricingError('Catálogo Runware não publicou pricingRates para este modelo.','RUNWARE_PRICE_METADATA_MISSING');
      pricingCache.set(air,{expires_at:Date.now()+CACHE_TTL_MS,value:metadata});
      return metadata;
    }finally{clearTimeout(timer);inFlight.delete(air);}
  })();
  inFlight.set(air,request);
  return request;
}

function failUnquoted(identifier:string):never{
  throw pricingError(
    'O Runware publica tarifa baseada em tokens para '+identifier+'; o custo exato só fica conhecido após a geração, então não há pré-cotação exata.',
    'RUNWARE_PRICE_TOKEN_BASED',
  );
}
function normalizedUnit(value:string){return String(value||'').toLowerCase().replace(/[^a-z]/g,'');}
function normalizedResolution(value:string){
  const raw=String(value||'').toLowerCase().replace(/\s/g,'');
  const dimensions=raw.match(/(\d{3,5})x(\d{3,5})/);
  if(dimensions)return Math.max(Number(dimensions[1]),Number(dimensions[2]));
  const kilopixel=raw.match(/(\d+(?:\.\d+)?)k/);
  if(kilopixel)return Math.round(Number(kilopixel[1])*1024);
  const pixels=raw.match(/(\d{3,5})(?:p)?/);
  if(pixels)return Number(pixels[1]);
  return null;
}
function isVideoMode(capability:string,mode?:GenerationMode){
  return capability.includes('video')||['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO','VIDEO_TO_VIDEO'].includes(String(mode||''));
}
function selectResolutionTier(rates:RunwarePricingRate[],resolution:string){
  const target=normalizedResolution(resolution);
  const tiers=rates.map(rate=>({rate,resolution:normalizedResolution(rate.label||'')})).filter(row=>row.resolution!==null);
  if(!tiers.length)return rates;
  const exact=tiers.filter(row=>row.resolution===target);
  if(exact.length)return exact.map(row=>row.rate);
  if(target!==null){
    // Some catalogs publish a physical tier name such as 1.5K for the API's
    // logical 1K preset. Choosing the next published tier is conservative:
    // we never quote a lower tier than the requested output.
    const next=tiers.filter(row=>Number(row.resolution)>=target).sort((a,b)=>Number(a.resolution)-Number(b.resolution))[0];
    if(next)return tiers.filter(row=>row.resolution===next.resolution).map(row=>row.rate);
  }
  throw pricingError('Runware não publicou preço para a resolução '+resolution+'.','RUNWARE_PRICE_RESOLUTION_UNAVAILABLE');
}
function rateAmount(rate:RunwarePricingRate){
  const amount=Number(rate.amount);
  if(!Number.isFinite(amount)||amount<0)throw pricingError('Catálogo Runware contém uma tarifa inválida.','RUNWARE_PRICE_RATE_INVALID');
  return amount;
}
function selectOutputRate(rates:RunwarePricingRate[],dimensions:RunwarePriceDimensions){
  const outputs=rates.filter(rate=>normalizedUnit(rate.unit)==='output');
  if(!outputs.length)return null;
  const hasReference=Number(dimensions.image_reference_count||0)>0;
  let candidates=outputs;
  const referenceRates=outputs.filter(rate=>/reference|style image|input image/i.test(rate.label||''));
  if(referenceRates.length)candidates=hasReference?referenceRates:outputs.filter(rate=>!referenceRates.includes(rate));
  candidates=selectResolutionTier(candidates,String(dimensions.resolution||'1K'));
  const requestedQuality=String(dimensions.pricing_options?.quality||dimensions.model_variant||'').toLowerCase();
  if(requestedQuality){
    const qualityMatch=candidates.filter(rate=>String(rate.label||'').toLowerCase().includes(requestedQuality));
    if(qualityMatch.length)candidates=qualityMatch;
  }else{
    const defaultTier=candidates.find(rate=>/\bdefault\b/i.test(rate.label||''));
    if(defaultTier)candidates=[defaultTier];
  }
  if(candidates.length>1)throw pricingError('O catálogo Runware expõe várias tarifas, mas não identifica uma opção padrão inequívoca.','RUNWARE_PRICE_TIER_AMBIGUOUS');
  return candidates[0]||null;
}
function selectDurationRate(rates:RunwarePricingRate[],dimensions:RunwarePriceDimensions){
  const secondRates=rates.filter(rate=>['durationsecond','durationseconds'].includes(normalizedUnit(rate.unit)));
  if(!secondRates.length)return null;
  const videoToVideo=['video-edit','video-extend'].includes(dimensions.capability_id)||Number(dimensions.video_reference_count||0)>0;
  const hasVideoToVideoTiers=secondRates.some(rate=>/video.?to.?video/i.test(rate.label||''));
  let candidates=hasVideoToVideoTiers
    ?secondRates.filter(rate=>/video.?to.?video/i.test(rate.label||'')===videoToVideo)
    :secondRates;
  if(!candidates.length)throw pricingError('Runware não publicou uma tarifa compatível com a operação '+dimensions.capability_id+'.','RUNWARE_PRICE_VIDEO_OPERATION_UNAVAILABLE');
  if(!videoToVideo){
    const textOrImageRates=candidates.filter(rate=>/(text.?\/.?image.?to.?video|text.?to.?video|image.?to.?video)/i.test(rate.label||''));
    if(textOrImageRates.length)candidates=textOrImageRates;
  }
  candidates=selectResolutionTier(candidates,String(dimensions.resolution||'720p'));
  if(candidates.length>1)throw pricingError('O catálogo Runware expõe várias tarifas de vídeo para estes parâmetros.','RUNWARE_PRICE_TIER_AMBIGUOUS');
  return candidates[0]||null;
}

export function calculateRunwareCatalogPrice(metadata:RunwarePricingMetadata,dimensions:RunwarePriceDimensions){
  const identifier=String(dimensions.provider_model_identifier||'').trim();
  if(!identifier||String(metadata?.air||'').trim()!==identifier)throw pricingError('AIR do catálogo não corresponde ao identificador solicitado.','RUNWARE_PRICE_MODEL_MISMATCH');
  if(String(metadata?.status||'').toLowerCase()!=='live')throw pricingError('Modelo Runware não está marcado como live no catálogo público.','RUNWARE_MODEL_NOT_LIVE');
  const rates=Array.isArray(metadata.pricingRates)?metadata.pricingRates:[];
  if(!rates.length)throw pricingError('Catálogo Runware não publicou tarifas para este modelo.','RUNWARE_PRICE_METADATA_MISSING');
  const video=isVideoMode(dimensions.capability_id,dimensions.mode);
  const selected=video?selectDurationRate(rates,dimensions):selectOutputRate(rates,dimensions);
  if(!selected){
    if(rates.some(rate=>/token/i.test(rate.unit)))failUnquoted(identifier);
    throw pricingError('O catálogo Runware não contém tarifa fixa compatível com esta capability.','RUNWARE_PRICE_UNIT_UNSUPPORTED');
  }
  const outputs=Math.max(1,Math.ceil(Number(dimensions.number_of_outputs)||1));
  const duration=Math.max(1,Number(dimensions.duration_seconds)||1);
  let amount=rateAmount(selected)*(video?duration:outputs);
  if(!video){
    const images=Math.max(0,Math.ceil(Number(dimensions.image_reference_count)||0));
    const imageFee=rates.filter(rate=>normalizedUnit(rate.unit)==='inputimage').reduce((sum,rate)=>sum+rateAmount(rate)*Math.max(0,images-Math.max(0,Number(rate.after)||0)),0);
    amount+=imageFee;
  }
  if(!Number.isFinite(amount)||amount<=0)throw pricingError('Runware não retornou custo total positivo verificável.','RUNWARE_PRICE_RATE_INVALID');
  return{amount,unit:video?'durationSecond' as const:'output' as const,unit_price:rateAmount(selected),selected_rate:selected};
}

export async function quoteRunwareCatalogPrice(params:ProviderGenerationParams){
  const identifier=String(params.provider_model_identifier||'').trim();
  const capability=String(params.capability_id||'');
  if(!capability)throw pricingError('Capability é obrigatória para calcular o preço Runware.','RUNWARE_PRICE_CAPABILITY_REQUIRED');
  const metadata=await fetchRunwarePricingMetadata(identifier);
  const quote=calculateRunwareCatalogPrice(metadata,{
    provider_model_identifier:identifier,capability_id:capability,mode:params.mode,resolution:params.resolution,
    duration_seconds:params.duration_seconds,number_of_outputs:params.number_of_outputs,
    image_reference_count:params.references.filter(reference=>reference.type==='IMAGE').length,
    video_reference_count:params.references.filter(reference=>reference.type==='VIDEO').length,
    model_variant:params.model_variant,pricing_options:params.pricing_options,
  });
  return{effective_price_usd:quote.amount,estimated:false,source:'CATALOG' as const};
}

export async function getRunwareRoutingPrice(identifier:string,capabilityId:string,resolution?:string){
  const metadata=await fetchRunwarePricingMetadata(identifier);
  const video=isVideoMode(capabilityId);
  const defaultResolution=String(resolution||(video?'720p':'1K'));
  const defaultImages=['image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(capabilityId)?1:0;
  const defaultVideos=['video-edit','video-extend'].includes(capabilityId)?1:0;
  calculateRunwareCatalogPrice(metadata,{
    provider_model_identifier:identifier,capability_id:capabilityId,resolution:defaultResolution,
    duration_seconds:video?5:1,number_of_outputs:1,image_reference_count:defaultImages,video_reference_count:defaultVideos,
  });
  const billingConfig:RoutingV2BillingConfig={
    type:'CUSTOM_FORMULA',currency:'USD',formula_id:'runware-catalog-pricing-v1',
    parameters:{
      provider_model_identifier:identifier,capability_id:capabilityId,pricing_rates_json:JSON.stringify(metadata.pricingRates),
      default_resolution:defaultResolution,default_duration_seconds:video?5:1,
      default_image_reference_count:defaultImages,default_video_reference_count:defaultVideos,
    },
  };
  return{billing_config:billingConfig,source:'PROVIDER_CATALOG_API' as const,source_reference:pricingUrl(identifier),fetched_at:new Date().toISOString()};
}

export function clearRunwarePricingCacheForTests(){pricingCache.clear();inFlight.clear();}
