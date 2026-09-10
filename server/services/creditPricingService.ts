import { GenerationMode } from '../../src/types/index.js';
import { smartRouterService } from './smartRouterService.js';
import { pricingSignatureService } from './pricingSignatureService.js';
import { retailPricingService } from './retailPricingService.js';
import { creditWalletService } from './creditWalletService.js';
import { pricingSettingsService } from './pricingSettingsService.js';

export interface CreditPricingInput{
 userId:string;model_id:string;mode:GenerationMode;prompt?:string;negative_prompt?:string;duration_seconds:number;resolution:string;aspect_ratio:string;number_of_outputs:number;seed?:number|null;motion_strength?:number|null;references?:Array<{asset_id:string;slot_type?:string;role?:string}>;force_live_quote?:boolean;audio_enabled?:boolean;model_variant?:string;pricing_options?:Record<string,string|number|boolean|null|undefined>;
}
const DEFAULT_AUDIO_MODELS=new Set(['wan-3-0','wan-3-0-prime','seedance-2-5','seedance-2-0','kling-3-0']);
function referenceMode(refs:CreditPricingInput['references']){const r=refs||[];if(!r.length)return'none';if(r.some(x=>String(x.slot_type||x.role||'').toUpperCase().includes('INITIAL')))return r.some(x=>String(x.slot_type||x.role||'').toUpperCase().includes('END'))?'initial_end':'initial';return r.length>1?'multi_ref':'reference';}
function effectiveAudio(input:CreditPricingInput){return input.audio_enabled===undefined?DEFAULT_AUDIO_MODELS.has(input.model_id):Boolean(input.audio_enabled);}
export const creditPricingService={
 async preview(input:CreditPricingInput){
  const audio_enabled=effectiveAudio(input),model_variant=input.model_variant||'default',pricing_options=input.pricing_options||{};
  const signature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:input.duration_seconds,aspect_ratio:input.aspect_ratio,number_of_outputs:input.number_of_outputs,audio_enabled,reference_mode:referenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const normalizedInput={...input,audio_enabled,model_variant,pricing_options};
  const preliminary=await smartRouterService.selectProvider({...normalizedInput,force_live_quote:input.force_live_quote});
  const retail=await retailPricingService.resolveOrBootstrap(signature,preliminary.selected.fully_loaded_safe_cogs_cents);
  const settings=await pricingSettingsService.get(false);const account=await creditWalletService.getAccount(input.userId);const simulation=await creditWalletService.simulateReserve(input.userId,retail.retail_credit_price);
  const fallbackBacking=retail.retail_credit_price*settings.conservative_credit_value_micros;const backingMicros=simulation.has_sufficient_credits?simulation.authorized_net_backing_micros:fallbackBacking;const backingCents=Math.max(0,Math.floor(backingMicros/10000));const normalFloor=Math.max(retail.normal_floor_margin_percent,settings.normal_floor_margin_percent)/100;const maxAllowed=Math.max(0,Math.floor(backingCents*(1-normalFloor)));
  const routed=await smartRouterService.selectProvider({...normalizedInput,max_allowed_cogs_cents:maxAllowed,incurred_cogs_cents:0,force_live_quote:input.force_live_quote});const realizedPreview=backingCents>0?Math.max(-999,100*(1-routed.selected.fully_loaded_safe_cogs_cents/backingCents)):0;return{signature,retail,settings,account,simulation,authorized_net_backing_micros:backingMicros,conservative_net_revenue_cents:backingCents,max_allowed_cogs_cents:maxAllowed,decision:routed,margin_percent:realizedPreview,health:realizedPreview>=retail.normal_floor_margin_percent?'GREEN':realizedPreview>=retail.emergency_floor_margin_percent?'YELLOW':'RED'};
 }
};
