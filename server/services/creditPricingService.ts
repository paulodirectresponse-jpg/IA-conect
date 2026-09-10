import { GenerationMode } from '../../src/types/index.js';
import { smartRouterService } from './smartRouterService.js';
import { pricingSignatureService, PricingSignature } from './pricingSignatureService.js';
import { retailPricingService, RetailPricingVersion } from './retailPricingService.js';
import { creditWalletService } from './creditWalletService.js';
import { pricingSettingsService } from './pricingSettingsService.js';
import { pricingSyncService } from './pricingSyncService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { generationExecutionEconomics } from './generationEconomicsPolicy.js';
import { pricingReferenceMode } from '../../src/utils/generationReferenceMode.js';
import { getModelCapabilities } from '../../src/services/modelCapabilities.js';
import { assertGenerationCapability } from './generationCapabilityGuard.js';

export interface CreditPricingInput{
 userId:string;model_id:string;mode:GenerationMode;prompt?:string;negative_prompt?:string;duration_seconds:number;resolution:string;aspect_ratio:string;number_of_outputs:number;seed?:number|null;motion_strength?:number|null;references?:Array<{asset_id:string;slot_type?:string;role?:string}>;force_live_quote?:boolean;audio_enabled?:boolean;model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
}
function isImageMode(mode:GenerationMode){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';}
function cachedCandidate(row:any){return{provider_id:String(row?.provider_id||'persisted-pricing'),provider_name:String(row?.provider_name||'Snapshot persistido'),provider_cost_usd:Number(row?.provider_cost_usd||0),provider_cost_cents:Number(row?.provider_cost_brl_cents||0),safe_cost_cents:Number(row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),fully_loaded_safe_cogs_cents:Number(row?.fully_loaded_safe_cogs_cents||row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),billing_policy:'UNKNOWN',quoted_at:String(row?.checked_at||new Date(0).toISOString()),quote_estimated:true,is_healthy:row?.status==='OK'};}
async function persistedDecision(input:CreditPricingInput,unitSignature:PricingSignature){
 const snapshot=await pricingSyncService.getLatestSnapshot();
 const rows=(snapshot.rows||[]).filter((r:any)=>r.status==='OK'&&r.model_id===input.model_id&&r.mode===input.mode&&String(r.resolution).toLowerCase()===String(input.resolution).toLowerCase());
 const exact=rows.find((r:any)=>r.pricing_signature_hash===unitSignature.hash),row=exact||rows.sort((a:any,b:any)=>Number(a.fully_loaded_safe_cogs_cents||Infinity)-Number(b.fully_loaded_safe_cogs_cents||Infinity))[0];
 if(!row)throw Object.assign(new Error('Cotação operacional persistida indisponível para esta configuração.'),{code:'PERSISTED_PRICING_UNAVAILABLE'});
 const selected=cachedCandidate(row);
 return{selected,candidates:[selected],strategy:'PERSISTED_PRICING_SNAPSHOT',reason:'Custo operacional lido do snapshot persistido.'};
}
export const creditPricingService={
 async preview(input:CreditPricingInput){
  const catalogModel=await catalogRepository.getModel(input.model_id);
  if(!catalogModel)throw Object.assign(new Error('IA indisponível.'),{code:'MODEL_NOT_AVAILABLE'});
  const caps=getModelCapabilities(catalogModel),image=isImageMode(input.mode),audioMode=caps.audio_generation_mode||(caps.supports_audio_generation?'OPTIONAL':'NONE');
  const audio_enabled=Boolean(!image&&(audioMode==='ALWAYS'||(audioMode==='OPTIONAL'&&(input.audio_enabled===undefined?(caps.default_audio_enabled??true):input.audio_enabled))));
  const model_variant=input.model_variant||'default',pricing_options=input.pricing_options||{},normalizedInput={...input,audio_enabled,model_variant,pricing_options};
  await assertGenerationCapability({...input,audio_enabled});
  const signature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:image?1:input.duration_seconds,aspect_ratio:input.aspect_ratio,number_of_outputs:input.number_of_outputs,audio_enabled,reference_mode:pricingReferenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const supportedDurations=(catalogModel.supported_durations||[]).map(Number).filter((value)=>Number.isFinite(value)&&value>0);
  const retailBaseDuration=image?1:(supportedDurations.length?Math.min(...supportedDurations):Math.max(1,Math.round(input.duration_seconds||1)));
  const unitSignature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:retailBaseDuration,aspect_ratio:input.aspect_ratio,number_of_outputs:1,audio_enabled,reference_mode:pricingReferenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const settings=await pricingSettingsService.get(false),useLive=input.force_live_quote===true;
  const unitInput={...normalizedInput,duration_seconds:retailBaseDuration,number_of_outputs:1};
  let preliminary:any;
  if(useLive)preliminary=await smartRouterService.selectProvider({...unitInput,force_live_quote:true});
  else{
   try{preliminary=await persistedDecision(input,unitSignature);}
   catch(err:any){
    if(err?.code!=='PERSISTED_PRICING_UNAVAILABLE')throw err;
    preliminary=await smartRouterService.selectProvider({...unitInput,force_live_quote:true});
   }
  }
  const existingRetail=await retailPricingService.get(unitSignature.hash);
  const retailVersion=existingRetail?.active
   ?existingRetail
   :await retailPricingService.resolveOrBootstrap(unitSignature,preliminary.selected.fully_loaded_safe_cogs_cents);
  const unitCreditPrice=image?retailVersion.retail_credit_price:Math.max(1,Math.ceil(retailVersion.retail_credit_price/retailBaseDuration));
  const billingUnits=image?Math.max(1,input.number_of_outputs):Math.max(1,input.duration_seconds)*Math.max(1,input.number_of_outputs),totalCreditPrice=unitCreditPrice*billingUnits;
  const retail={...retailVersion,retail_credit_price:totalCreditPrice,unit_credit_price:unitCreditPrice,pricing_unit:image?'PER_OUTPUT':'PER_SECOND',base_duration_seconds:retailBaseDuration,billing_units:billingUnits};
  const account=await creditWalletService.getAccount(input.userId),simulation=await creditWalletService.simulateReserve(input.userId,totalCreditPrice),fallbackBacking=totalCreditPrice*settings.conservative_credit_value_micros,backingMicros=simulation.has_sufficient_credits?simulation.authorized_net_backing_micros:fallbackBacking,economics=generationExecutionEconomics(totalCreditPrice,backingMicros),backingCents=economics.cash_backing_cents,maxAllowed=economics.execution_cogs_cap_cents;
  const routed:any=useLive?await smartRouterService.selectProvider({...normalizedInput,max_allowed_cogs_cents:maxAllowed,incurred_cogs_cents:0,force_live_quote:true}):preliminary,realizedPreview=backingCents>0?Math.max(-999,100*(1-Number(routed.selected.fully_loaded_safe_cogs_cents||0)/backingCents)):0;
  return{signature,unit_signature:unitSignature,retail,settings,account,simulation,authorized_net_backing_micros:backingMicros,conservative_net_revenue_cents:backingCents,max_allowed_cogs_cents:maxAllowed,subsidy_gap_cents:economics.subsidy_gap_cents,decision:routed,margin_percent:realizedPreview,health:realizedPreview>=retailVersion.normal_floor_margin_percent?'GREEN':realizedPreview>=retailVersion.emergency_floor_margin_percent?'YELLOW':'RED'};
 }
};
