import { GenerationMode } from '../../src/types/index.js';
import { VideoProviderAdapter, ProviderGenerationParams, ProviderGenerationReference } from '../adapters/videoProviderAdapter.js';

const fx = () => Math.max(1, Number(process.env.PROVIDER_USD_BRL || 5.10));
const bufferRate = () => Math.min(0.25, Math.max(0, Number(process.env.PRICING_SAFETY_BUFFER_PERCENT || 5) / 100));
const targetMargin = (mode:GenerationMode) => (mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE')
  ? Math.min(0.8, Math.max(0.1, Number(process.env.IMAGE_TARGET_MARGIN_PERCENT || 50) / 100))
  : Math.min(0.8, Math.max(0.1, Number(process.env.VIDEO_TARGET_MARGIN_PERCENT || 40) / 100));
const minimumMargin = (mode:GenerationMode) => (mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE')
  ? Math.min(0.7, Math.max(0.05, Number(process.env.IMAGE_MIN_MARGIN_PERCENT || 35) / 100))
  : Math.min(0.7, Math.max(0.05, Number(process.env.VIDEO_MIN_MARGIN_PERCENT || 30) / 100));

function fakeReference(type:'IMAGE'|'VIDEO'|'AUDIO',slot_type:'INITIAL'|'END'|'GENERAL'='GENERAL'):ProviderGenerationReference{
  return {
    asset_id:`pricing-${type.toLowerCase()}`,
    owner_user_id:'pricing-engine',
    type,
    category:'GENERIC',
    name:`pricing-${type.toLowerCase()}`,
    alias:`pricing_${type.toLowerCase()}`,
    storage_path:'pricing://placeholder',
    public_url:`https://example.com/pricing-${type.toLowerCase()}`,
    thumbnail_url:'',
    mime_type:type==='IMAGE'?'image/jpeg':type==='VIDEO'?'video/mp4':'audio/mpeg',
    size_bytes:0,
    status:'READY',
    origin:'UPLOAD',
    created_at:new Date(0).toISOString(),
    updated_at:new Date(0).toISOString(),
    provider_accessible_url:`https://example.com/pricing-${type.toLowerCase()}`,
    slot_type,
    prompt_alias:`pricing_${type.toLowerCase()}`,
  } as ProviderGenerationReference;
}

export interface PricingGuardInput {
  userId:string;
  model_id:string;
  mode:GenerationMode;
  prompt?:string;
  negative_prompt?:string;
  duration_seconds:number;
  resolution:string;
  aspect_ratio:string;
  number_of_outputs:number;
  seed?:number|null;
  motion_strength?:number|null;
}

export interface SafeProviderQuote {
  provider_cost_usd:number;
  provider_cost_brl_cents:number;
  safe_cost_brl_cents:number;
  customer_price_cents:number;
  target_margin:number;
  minimum_margin:number;
  effective_margin:number;
  fx_rate:number;
  safety_buffer_rate:number;
  estimated:boolean;
  quoted_at:string;
}

function syntheticReferences(mode:GenerationMode):ProviderGenerationReference[]{
  if(mode==='IMAGE_TO_IMAGE') return [fakeReference('IMAGE','GENERAL')];
  if(mode==='IMAGE_TO_VIDEO') return [fakeReference('IMAGE','INITIAL')];
  if(mode==='REFERENCE_TO_VIDEO') return [fakeReference('IMAGE','GENERAL')];
  return [];
}

export const pricingGuardService={
  async quote(adapter:VideoProviderAdapter,input:PricingGuardInput):Promise<SafeProviderQuote>{
    if(!adapter.quoteCostUsd) throw Object.assign(new Error(`${adapter.name} não oferece cotação programática.`),{code:'LIVE_QUOTE_UNAVAILABLE'});
    const params:ProviderGenerationParams={
      generation_id:'pricing-preview',user_id:input.userId,model_id:input.model_id,mode:input.mode,
      prompt:input.prompt?.trim()||'pricing preview',negative_prompt:input.negative_prompt,
      duration_seconds:Math.max(1,input.duration_seconds),resolution:input.resolution,aspect_ratio:input.aspect_ratio,
      number_of_outputs:Math.max(1,input.number_of_outputs),seed:input.seed,motion_strength:input.motion_strength,
      references:syntheticReferences(input.mode),
    };
    const providerQuote=await adapter.quoteCostUsd(params);
    const providerUsd=Number(providerQuote.effective_price_usd);
    if(!Number.isFinite(providerUsd)||providerUsd<0) throw Object.assign(new Error('Cotação do provider inválida.'),{code:'LIVE_QUOTE_INVALID'});
    const fxRate=fx();
    const providerCost=Math.max(1,Math.ceil(providerUsd*fxRate*100));
    const safetyBuffer=bufferRate();
    const safeCost=Math.max(providerCost,Math.ceil(providerCost*(1+safetyBuffer)));
    const margin=targetMargin(input.mode);
    const customer=Math.max(safeCost+1,Math.ceil(safeCost/(1-margin)));
    const effectiveMargin=1-(safeCost/customer);
    const minMargin=minimumMargin(input.mode);
    if(effectiveMargin+1e-9<minMargin) throw Object.assign(new Error('Margem calculada abaixo do mínimo operacional.'),{code:'MARGIN_BELOW_MINIMUM'});
    return {
      provider_cost_usd:providerUsd,provider_cost_brl_cents:providerCost,safe_cost_brl_cents:safeCost,
      customer_price_cents:customer,target_margin:margin,minimum_margin:minMargin,effective_margin:effectiveMargin,
      fx_rate:fxRate,safety_buffer_rate:safetyBuffer,estimated:Boolean(providerQuote.estimated),quoted_at:new Date().toISOString(),
    };
  },
};
