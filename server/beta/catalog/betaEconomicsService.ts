import crypto from 'crypto';
import { GenerationMode } from '../../../src/types/index.js';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { billingControlService } from '../../services/billingControlService.js';
import { creditPricingService, CreditPricingInput } from '../../services/creditPricingService.js';
import { betaCatalogPolicyService } from './catalogPolicyService.js';
import { catalogPolicyRepository } from './catalogPolicyRepository.js';
import { BetaEconomicLedgerEvent, BetaPricingPolicy } from './catalogPolicyTypes.js';

export interface BetaResolvedQuote {
  selected_model_id:string;
  routing_mode:'MANUAL'|'AUTO';
  pricing_policy:BetaPricingPolicy;
  preview:any;
}

export const betaEconomicsService={
  async assertExecutionEnabled(){
    await billingControlService.assertNewGenerationAllowed();
    const flag=await catalogRepository.getFeatureFlag('beta.execution.enabled');
    if(!flag?.is_enabled)throw Object.assign(new Error('Novas execuções Beta estão temporariamente pausadas.'),{code:'BETA_EXECUTION_DISABLED'});
  },

  async resolveQuote(params:{
    userId:string;
    requestedModelId:string;
    capabilityId:string;
    mode:GenerationMode;
    pricingInput:Omit<CreditPricingInput,'userId'|'model_id'|'mode'>;
    requestedControls?:string[];
  }):Promise<BetaResolvedQuote>{
    await this.assertExecutionEnabled();
    if(params.requestedModelId!=='AUTO'){
      const resolved=await betaCatalogPolicyService.resolveModel(params.requestedModelId,params.capabilityId,false);
      const preview=await creditPricingService.preview({
        ...params.pricingInput,userId:params.userId,model_id:resolved.model.model_id,mode:params.mode,
      });
      return{selected_model_id:resolved.model.model_id,routing_mode:'MANUAL',pricing_policy:resolved.pricingPolicy,preview};
    }

    const autoFlag=await catalogRepository.getFeatureFlag('beta.auto_router.enabled');
    if(!autoFlag?.is_enabled)throw Object.assign(new Error('AUTO router temporariamente indisponível.'),{code:'AUTO_ROUTER_DISABLED'});
    const candidates=await betaCatalogPolicyService.eligibleModels(params.capabilityId,params.requestedControls||[]);
    if(!candidates.length)throw Object.assign(new Error('Nenhum modelo elegível para esta capability.'),{code:'AUTO_NO_ELIGIBLE_MODEL'});
    const billing=await billingControlService.get(false);
    const quoted=await Promise.all(candidates.map(async candidate=>{
      try{
        const preview=await creditPricingService.preview({
          ...params.pricingInput,userId:params.userId,model_id:candidate.model.model_id,mode:params.mode,
        });
        return{candidate,preview};
      }catch{return null;}
    }));
    const eligible=quoted.filter((row):row is NonNullable<typeof row>=>Boolean(row)).filter(row=>{
      if(row.preview?.health==='RED')return false;
      if(row.preview?.health==='YELLOW'&&!billing.yellow_execution_enabled)return false;
      return true;
    });
    if(!eligible.length)throw Object.assign(new Error('Nenhum modelo AUTO possui rota econômica segura agora.'),{code:'AUTO_NO_SAFE_MODEL'});
    eligible.sort((a,b)=>{
      const healthRank=(value:string)=>value==='GREEN'?0:value==='YELLOW'?1:2;
      return healthRank(String(a.preview.health))-healthRank(String(b.preview.health))
        ||Number(a.preview.retail?.retail_credit_price||Infinity)-Number(b.preview.retail?.retail_credit_price||Infinity)
        ||Number(a.preview.decision?.selected?.fully_loaded_safe_cogs_cents||Infinity)-Number(b.preview.decision?.selected?.fully_loaded_safe_cogs_cents||Infinity)
        ||a.candidate.model.model_id.localeCompare(b.candidate.model.model_id);
    });
    const selected=eligible[0];
    return{
      selected_model_id:selected.candidate.model.model_id,
      routing_mode:'AUTO',
      pricing_policy:selected.candidate.pricingPolicy,
      preview:selected.preview,
    };
  },

  quoteExpiry(policy:BetaPricingPolicy,quotedAt=new Date()){
    return new Date(quotedAt.getTime()+policy.quote_ttl_seconds*1000).toISOString();
  },

  assertQuoteFresh(quote:{expires_at?:string|null}){
    const expires=Date.parse(String(quote.expires_at||''));
    if(!Number.isFinite(expires)||expires<=Date.now()){
      throw Object.assign(new Error('A cotação expirou. Faça uma nova cotação antes de executar.'),{code:'QUOTE_EXPIRED'});
    }
  },

  async assertQuotedModelEligible(quote:{selected_model_id:string;routing_mode:'MANUAL'|'AUTO';pricing_policy_id:string},capabilityId:string){
    if(quote.routing_mode==='AUTO'){
      const autoFlag=await catalogRepository.getFeatureFlag('beta.auto_router.enabled');
      if(!autoFlag?.is_enabled)throw Object.assign(new Error('AUTO router temporariamente indisponível.'),{code:'AUTO_ROUTER_DISABLED'});
    }
    const resolved=await betaCatalogPolicyService.resolveModel(quote.selected_model_id,capabilityId,quote.routing_mode==='AUTO');
    if(resolved.modelPolicy.pricing_policy_id!==quote.pricing_policy_id){
      throw Object.assign(new Error('A política do modelo mudou. Faça uma nova cotação.'),{code:'QUOTE_POLICY_CHANGED'});
    }
    return resolved;
  },

  async recordLedgerEvent(input:Omit<BetaEconomicLedgerEvent,'event_id'|'created_at'> & {event_id?:string}){
    const event:BetaEconomicLedgerEvent={
      ...input,
      event_id:input.event_id||`becon_${crypto.randomUUID()}`,
      created_at:new Date().toISOString(),
    };
    return catalogPolicyRepository.recordEconomicEvent(event);
  },

  async listLedger(limit=100){return catalogPolicyRepository.listEconomicLedger(limit);},
};
