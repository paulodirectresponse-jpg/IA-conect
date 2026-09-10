import { GenerationMode } from '../../src/types/index.js';
import { STUDIO_FALLBACK_MODELS } from '../../src/config/studioCatalog.js';
import { smartRouterService } from './smartRouterService.js';
import { pricingSignatureService, PricingSignature } from './pricingSignatureService.js';
import { retailPricingService, RetailPricingVersion } from './retailPricingService.js';
import { creditWalletService } from './creditWalletService.js';
import { pricingSettingsService } from './pricingSettingsService.js';
import { pricingSyncService } from './pricingSyncService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';

export interface CreditPricingInput{
 userId:string;model_id:string;mode:GenerationMode;prompt?:string;negative_prompt?:string;duration_seconds:number;resolution:string;aspect_ratio:string;number_of_outputs:number;seed?:number|null;motion_strength?:number|null;references?:Array<{asset_id:string;slot_type?:string;role?:string}>;force_live_quote?:boolean;audio_enabled?:boolean;model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
}
const DEFAULT_AUDIO_MODELS=new Set(['wan-3-0','wan-3-0-prime','seedance-2-5','seedance-2-0','kling-3-0']);
function referenceMode(refs:CreditPricingInput['references']){const r=refs||[];if(!r.length)return'none';if(r.some(x=>String(x.slot_type||x.role||'').toUpperCase().includes('INITIAL')))return r.some(x=>String(x.slot_type||x.role||'').toUpperCase().includes('END'))?'initial_end':'initial';return r.length>1?'multi_ref':'reference';}
function effectiveAudio(input:CreditPricingInput){return input.audio_enabled===undefined?DEFAULT_AUDIO_MODELS.has(input.model_id):Boolean(input.audio_enabled);}
function isImageMode(mode:GenerationMode){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';}
function baseDuration(modelId:string,requested:number){const model=STUDIO_FALLBACK_MODELS.find(m=>m.model_id===modelId),values=(model?.supported_durations||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0);return values.length?Math.min(...values):Math.max(1,Math.round(requested||1));}
function cachedCandidate(row:any){return{provider_id:String(row?.provider_id||'persisted-pricing'),provider_name:String(row?.provider_name||'Snapshot persistido'),provider_cost_usd:Number(row?.provider_cost_usd||0),provider_cost_cents:Number(row?.provider_cost_brl_cents||0),safe_cost_cents:Number(row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),fully_loaded_safe_cogs_cents:Number(row?.fully_loaded_safe_cogs_cents||row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),billing_policy:'UNKNOWN',quoted_at:String(row?.checked_at||new Date(0).toISOString()),quote_estimated:true,is_healthy:row?.status==='OK'};}
async function persistedDecision(input:CreditPricingInput,unitSignature:PricingSignature){
 const snapshot=await pricingSyncService.getLatestSnapshot();
 const rows=(snapshot.rows||[]).filter((r:any)=>r.status==='OK'&&r.model_id===input.model_id&&r.mode===input.mode&&String(r.resolution).toLowerCase()===String(input.resolution).toLowerCase());
 const exact=rows.find((r:any)=>r.pricing_signature_hash===unitSignature.hash),row=exact||rows.sort((a:any,b:any)=>Number(a.fully_loaded_safe_cogs_cents||Infinity)-Number(b.fully_loaded_safe_cogs_cents||Infinity))[0];
 if(row){const selected=cachedCandidate(row);return{selected,candidates:[selected],strategy:'PERSISTED_30M_SNAPSHOT',reason:'Preço e custo lidos do último snapshot persistido; nenhuma consulta ao provider foi feita nesta prévia.'};}
 const legacy=(await catalogRepository.listPricing()).filter((r:any)=>r.active&&r.model_id===input.model_id&&(!r.mode||r.mode===input.mode)&&(String(r.resolution||'ANY').toLowerCase()==='any'||String(r.resolution).toLowerCase()===String(input.resolution).toLowerCase())).sort((a:any,b:any)=>Number(a.provider_cost_cents||Infinity)-Number(b.provider_cost_cents||Infinity))[0];
 if(!legacy)throw Object.assign(new Error('Preço persistido indisponível para esta configuração.'),{code:'PERSISTED_PRICING_UNAVAILABLE'});
 const selected=cachedCandidate({provider_id:legacy.provider_id,provider_name:legacy.provider_id,provider_cost_brl_cents:legacy.provider_cost_cents,safe_cost_brl_cents:legacy.provider_cost_cents,fully_loaded_safe_cogs_cents:legacy.provider_cost_cents,checked_at:legacy.updated_at,status:'OK'});
 return{selected,candidates:[selected],strategy:'PERSISTED_CATALOG_FALLBACK',reason:'Preço lido do catálogo persistido; nenhuma consulta ao provider foi feita nesta prévia.'};
}
async function persistedRetail(unitSignature:PricingSignature,input:CreditPricingInput,retailBaseDuration:number,image:boolean,settings:any):Promise<RetailPricingVersion>{
 const existing=await retailPricingService.get(unitSignature.hash);if(existing?.active)return existing;
 const rows=(await catalogRepository.listPricing()).filter((r:any)=>r.active&&r.model_id===input.model_id&&(!r.mode||r.mode===input.mode)&&(String(r.resolution||'ANY').toLowerCase()==='any'||String(r.resolution).toLowerCase()===String(input.resolution).toLowerCase()));
 if(!rows.length)throw Object.assign(new Error('Preço comercial persistido indisponível para esta configuração.'),{code:'PERSISTED_PRICING_UNAVAILABLE'});
 const best=rows.sort((a:any,b:any)=>Number(a.customer_price_cents||Infinity)-Number(b.customer_price_cents||Infinity))[0],duration=Math.max(1,Number(best.duration_seconds||retailBaseDuration)),basePrice=image?Math.max(1,Math.round(Number(best.customer_price_cents||0))):Math.max(1,Math.ceil(Number(best.customer_price_cents||0)*(retailBaseDuration/duration))),now=String(best.updated_at||new Date(0).toISOString());
 return{retail_pricing_id:`catalog:${best.pricing_id}`,pricing_signature_hash:unitSignature.hash,signature:unitSignature,retail_credit_price:basePrice,target_margin_percent:settings.target_margin_percent,normal_floor_margin_percent:settings.normal_floor_margin_percent,emergency_floor_margin_percent:settings.emergency_floor_margin_percent,yellow_policy:'BLOCK',yellow_ttl_minutes:0,effective_from:String(best.effective_from||now),effective_until:best.effective_until||null,version:0,active:true,created_at:now,updated_at:now};
}
export const creditPricingService={
 async preview(input:CreditPricingInput){
  const audio_enabled=effectiveAudio(input),model_variant=input.model_variant||'default',pricing_options=input.pricing_options||{},image=isImageMode(input.mode),normalizedInput={...input,audio_enabled,model_variant,pricing_options};
  const signature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:image?1:input.duration_seconds,aspect_ratio:input.aspect_ratio,number_of_outputs:input.number_of_outputs,audio_enabled,reference_mode:referenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const retailBaseDuration=image?1:baseDuration(input.model_id,input.duration_seconds);
  const unitSignature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:retailBaseDuration,aspect_ratio:input.aspect_ratio,number_of_outputs:1,audio_enabled,reference_mode:referenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const settings=await pricingSettingsService.get(false),useLive=input.force_live_quote===true;
  const unitInput={...normalizedInput,duration_seconds:retailBaseDuration,number_of_outputs:1};
  const preliminary:any=useLive?await smartRouterService.selectProvider({...unitInput,force_live_quote:true}):await persistedDecision(input,unitSignature);
  const retailVersion=useLive?await retailPricingService.resolveOrBootstrap(unitSignature,preliminary.selected.fully_loaded_safe_cogs_cents):await persistedRetail(unitSignature,input,retailBaseDuration,image,settings);
  const unitCreditPrice=image?retailVersion.retail_credit_price:Math.max(1,Math.ceil(retailVersion.retail_credit_price/retailBaseDuration));
  const billingUnits=image?Math.max(1,input.number_of_outputs):Math.max(1,input.duration_seconds)*Math.max(1,input.number_of_outputs),totalCreditPrice=unitCreditPrice*billingUnits;
  const retail={...retailVersion,retail_credit_price:totalCreditPrice,unit_credit_price:unitCreditPrice,pricing_unit:image?'PER_OUTPUT':'PER_SECOND',base_duration_seconds:retailBaseDuration,billing_units:billingUnits};
  const account=await creditWalletService.getAccount(input.userId),simulation=await creditWalletService.simulateReserve(input.userId,totalCreditPrice),fallbackBacking=totalCreditPrice*settings.conservative_credit_value_micros,backingMicros=simulation.has_sufficient_credits?simulation.authorized_net_backing_micros:fallbackBacking,backingCents=Math.max(0,Math.floor(backingMicros/10000)),normalFloor=Math.max(retailVersion.normal_floor_margin_percent,settings.normal_floor_margin_percent)/100,maxAllowed=Math.max(0,Math.floor(backingCents*(1-normalFloor)));
  const routed:any=useLive?await smartRouterService.selectProvider({...normalizedInput,max_allowed_cogs_cents:maxAllowed,incurred_cogs_cents:0,force_live_quote:true}):preliminary,realizedPreview=backingCents>0?Math.max(-999,100*(1-Number(routed.selected.fully_loaded_safe_cogs_cents||0)/backingCents)):0;
  return{signature,unit_signature:unitSignature,retail,settings,account,simulation,authorized_net_backing_micros:backingMicros,conservative_net_revenue_cents:backingCents,max_allowed_cogs_cents:maxAllowed,decision:routed,margin_percent:realizedPreview,health:realizedPreview>=retailVersion.normal_floor_margin_percent?'GREEN':realizedPreview>=retailVersion.emergency_floor_margin_percent?'YELLOW':'RED'};
 }
};
