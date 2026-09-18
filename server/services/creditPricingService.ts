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
import { ProviderGenerationReference } from '../adapters/videoProviderAdapter.js';

export interface CreditPricingInput{
 userId:string;model_id:string;mode:GenerationMode;capability_id?:string;prompt?:string;negative_prompt?:string;duration_seconds:number;resolution:string;aspect_ratio:string;number_of_outputs:number;seed?:number|null;motion_strength?:number|null;references?:Array<{asset_id:string;slot_type?:string;role?:string}>;provider_references?:ProviderGenerationReference[];force_live_quote?:boolean;audio_enabled?:boolean;model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
}
const DEFAULT_AUDIO_MODELS=new Set(['wan-3-0','wan-3-0-prime','seedance-2-5','seedance-2-0','kling-3-0']);
function effectiveAudio(input:CreditPricingInput){return input.audio_enabled===undefined?DEFAULT_AUDIO_MODELS.has(input.model_id):Boolean(input.audio_enabled);}
function isImageMode(mode:GenerationMode){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';}
function isPerRequestMode(mode:GenerationMode){return ['AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING','TEXT_TO_3D','IMAGE_TO_3D','MULTI_IMAGE_TO_3D'].includes(mode);}
function isCharacterPricing(input:CreditPricingInput){return input.mode==='TEXT_TO_SPEECH'||input.capability_id==='text-to-speech';}
function retailPricingOptions(input:CreditPricingInput){const options={...(input.pricing_options||{})};if(isCharacterPricing(input)){delete options.text_chars;options.billing_basis='CHARACTER_1000';}return options;}
function cachedCandidate(row:any){return{provider_id:String(row?.provider_id||'persisted-pricing'),provider_name:String(row?.provider_name||'Snapshot persistido'),provider_cost_usd:Number(row?.provider_cost_usd||0),provider_cost_cents:Number(row?.provider_cost_brl_cents||0),safe_cost_cents:Number(row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),fully_loaded_safe_cogs_cents:Number(row?.fully_loaded_safe_cogs_cents||row?.safe_cost_brl_cents||row?.provider_cost_brl_cents||0),billing_policy:'UNKNOWN',quoted_at:String(row?.checked_at||new Date(0).toISOString()),quote_estimated:true,is_healthy:row?.status==='OK'};}
async function persistedDecision(input:CreditPricingInput,unitSignature:PricingSignature){
 const snapshot=await pricingSyncService.getLatestSnapshot();
 const rows=(snapshot.rows||[]).filter((r:any)=>r.status==='OK'&&r.model_id===input.model_id&&r.mode===input.mode&&(!input.capability_id||!r.capability_id||r.capability_id===input.capability_id));
 const row=rows.find((r:any)=>r.pricing_signature_hash===unitSignature.hash);
 if(!row)throw Object.assign(new Error('Cotação operacional persistida indisponível para esta configuração exata.'),{code:'PERSISTED_PRICING_UNAVAILABLE'});
 const selected=cachedCandidate(row);
 return{selected,candidates:[selected],strategy:'PERSISTED_PRICING_SNAPSHOT',reason:'Custo operacional lido do snapshot persistido.'};
}
export const creditPricingService={
 async preview(input:CreditPricingInput){
  const audio_enabled=effectiveAudio(input),model_variant=input.model_variant||'default',pricing_options=retailPricingOptions(input),image=isImageMode(input.mode),perRequest=isPerRequestMode(input.mode),character=isCharacterPricing(input),normalizedInput={...input,audio_enabled,model_variant,pricing_options};
  const signature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:image||character?1:input.duration_seconds,aspect_ratio:input.aspect_ratio,number_of_outputs:input.number_of_outputs,audio_enabled,reference_mode:pricingReferenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const model=image?null:await catalogRepository.getModel(input.model_id);
  const supportedDurations=(model?.supported_durations||[]).map(Number).filter((value)=>Number.isFinite(value)&&value>0);
  const retailBaseDuration=image||perRequest||character?Math.max(1,Math.round(input.duration_seconds||1)):(supportedDurations.length?Math.min(...supportedDurations):Math.max(1,Math.round(input.duration_seconds||1)));
  const unitSignature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:character?1:retailBaseDuration,aspect_ratio:input.aspect_ratio,number_of_outputs:1,audio_enabled,reference_mode:pricingReferenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const settings=await pricingSettingsService.get(false),useLive=input.force_live_quote===true;
  const unitInput={...normalizedInput,prompt:character?'x'.repeat(1000):normalizedInput.prompt,duration_seconds:retailBaseDuration,number_of_outputs:1};
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
  const characterCount=Math.max(1,String(input.prompt||'').length),outputs=Math.max(1,input.number_of_outputs);
  const unitCreditPrice=character?retailVersion.retail_credit_price/1000:image||perRequest?retailVersion.retail_credit_price:Math.max(1,Math.ceil(retailVersion.retail_credit_price/retailBaseDuration));
  const billingUnits=character?characterCount*outputs:image?outputs:perRequest?1:Math.max(1,input.duration_seconds)*outputs;
  const totalCreditPrice=character?Math.max(1,Math.ceil(unitCreditPrice*billingUnits)):unitCreditPrice*billingUnits;
  const retail={...retailVersion,retail_credit_price:totalCreditPrice,unit_credit_price:unitCreditPrice,pricing_unit:character?'PER_CHARACTER':image?'PER_OUTPUT':perRequest?'PER_REQUEST':'PER_SECOND',base_duration_seconds:retailBaseDuration,billing_units:billingUnits,character_count:character?characterCount:undefined};
  const account=await creditWalletService.getAccount(input.userId),simulation=await creditWalletService.simulateReserve(input.userId,totalCreditPrice),fallbackBacking=totalCreditPrice*settings.conservative_credit_value_micros,backingMicros=simulation.has_sufficient_credits?simulation.authorized_net_backing_micros:fallbackBacking,economics=generationExecutionEconomics(totalCreditPrice,backingMicros),backingCents=economics.cash_backing_cents,maxAllowed=economics.execution_cogs_cap_cents;
  let routed:any=useLive?await smartRouterService.selectProvider({...normalizedInput,max_allowed_cogs_cents:maxAllowed,incurred_cogs_cents:0,force_live_quote:true}):preliminary;
  if(character&&!useLive&&routed?.selected){const factor=characterCount/1000;routed={...routed,selected:{...routed.selected,provider_cost_usd:Number(routed.selected.provider_cost_usd||0)*factor,provider_cost_cents:Math.ceil(Number(routed.selected.provider_cost_cents||0)*factor),safe_cost_cents:Math.ceil(Number(routed.selected.safe_cost_cents||0)*factor),fully_loaded_safe_cogs_cents:Math.ceil(Number(routed.selected.fully_loaded_safe_cogs_cents||0)*factor)}};}
  const realizedPreview=backingCents>0?Math.max(-999,100*(1-Number(routed.selected.fully_loaded_safe_cogs_cents||0)/backingCents)):0;
  return{signature,unit_signature:unitSignature,retail,settings,account,simulation,authorized_net_backing_micros:backingMicros,conservative_net_revenue_cents:backingCents,max_allowed_cogs_cents:maxAllowed,subsidy_gap_cents:economics.subsidy_gap_cents,decision:routed,margin_percent:realizedPreview,health:realizedPreview>=retailVersion.normal_floor_margin_percent?'GREEN':realizedPreview>=retailVersion.emergency_floor_margin_percent?'YELLOW':'RED'};
 }
};
