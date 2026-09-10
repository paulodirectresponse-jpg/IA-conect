import { GenerationMode } from '../../src/types/index.js';
import { STUDIO_FALLBACK_MODELS } from '../../src/config/studioCatalog.js';
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
function isImageMode(mode:GenerationMode){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';}
function baseDuration(modelId:string,requested:number){const model=STUDIO_FALLBACK_MODELS.find(m=>m.model_id===modelId),values=(model?.supported_durations||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0);return values.length?Math.min(...values):Math.max(1,Math.round(requested||1));}
export const creditPricingService={
 async preview(input:CreditPricingInput){
  const audio_enabled=effectiveAudio(input),model_variant=input.model_variant||'default',pricing_options=input.pricing_options||{},image=isImageMode(input.mode),normalizedInput={...input,audio_enabled,model_variant,pricing_options};
  const signature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:image?1:input.duration_seconds,aspect_ratio:input.aspect_ratio,number_of_outputs:input.number_of_outputs,audio_enabled,reference_mode:referenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});

  // Retail é precificado por unidade. Imagem usa preço por output; vídeo usa preço por segundo.
  // A PricingSignature completa continua sendo usada para COGS/roteamento e autorização econômica.
  const retailBaseDuration=image?1:baseDuration(input.model_id,input.duration_seconds);
  const unitSignature=pricingSignatureService.create({model_id:input.model_id,mode:input.mode,resolution:input.resolution,duration_seconds:retailBaseDuration,aspect_ratio:input.aspect_ratio,number_of_outputs:1,audio_enabled,reference_mode:referenceMode(input.references),reference_count:(input.references||[]).length,model_variant,pricing_options});
  const unitInput={...normalizedInput,duration_seconds:retailBaseDuration,number_of_outputs:1};
  const preliminary=await smartRouterService.selectProvider({...unitInput,force_live_quote:input.force_live_quote});
  const retailVersion=await retailPricingService.resolveOrBootstrap(unitSignature,preliminary.selected.fully_loaded_safe_cogs_cents);
  const unitCreditPrice=image?retailVersion.retail_credit_price:Math.max(1,Math.ceil(retailVersion.retail_credit_price/retailBaseDuration));
  const billingUnits=image?Math.max(1,input.number_of_outputs):Math.max(1,input.duration_seconds)*Math.max(1,input.number_of_outputs);
  const totalCreditPrice=unitCreditPrice*billingUnits;
  const retail={...retailVersion,retail_credit_price:totalCreditPrice,unit_credit_price:unitCreditPrice,pricing_unit:image?'PER_OUTPUT':'PER_SECOND',base_duration_seconds:retailBaseDuration,billing_units:billingUnits};

  const settings=await pricingSettingsService.get(false),account=await creditWalletService.getAccount(input.userId),simulation=await creditWalletService.simulateReserve(input.userId,totalCreditPrice);
  const fallbackBacking=totalCreditPrice*settings.conservative_credit_value_micros,backingMicros=simulation.has_sufficient_credits?simulation.authorized_net_backing_micros:fallbackBacking,backingCents=Math.max(0,Math.floor(backingMicros/10000)),normalFloor=Math.max(retailVersion.normal_floor_margin_percent,settings.normal_floor_margin_percent)/100,maxAllowed=Math.max(0,Math.floor(backingCents*(1-normalFloor)));
  const routed=await smartRouterService.selectProvider({...normalizedInput,max_allowed_cogs_cents:maxAllowed,incurred_cogs_cents:0,force_live_quote:input.force_live_quote}),realizedPreview=backingCents>0?Math.max(-999,100*(1-routed.selected.fully_loaded_safe_cogs_cents/backingCents)):0;
  return{signature,unit_signature:unitSignature,retail,settings,account,simulation,authorized_net_backing_micros:backingMicros,conservative_net_revenue_cents:backingCents,max_allowed_cogs_cents:maxAllowed,decision:routed,margin_percent:realizedPreview,health:realizedPreview>=retailVersion.normal_floor_margin_percent?'GREEN':realizedPreview>=retailVersion.emergency_floor_margin_percent?'YELLOW':'RED'};
 }
};
