import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerPricingCatalogService, ProviderPricingRule, ProviderPricingUnit } from './providerPricingCatalogService.js';
import { quoteCacheService } from './quoteCacheService.js';
import { retailPricingService } from './retailPricingService.js';
import { pricingSignatureService } from './pricingSignatureService.js';
import { routePricingProfile } from './routePricingProfileService.js';
import { capabilityIdsForModel, CapabilityId } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { catalogPolicyRepository } from '../beta/catalog/catalogPolicyRepository.js';

export type PricingRepairAction='RETAIL_BOOTSTRAPPED'|'PRICING_VERIFIED'|'CAPABILITY_ENABLED'|'CAPABILITY_DISABLED'|'MAPPING_DISABLED'|'ALREADY_HEALTHY';
export interface PricingRepairRow{model_id:string;model_name:string;capability_id:string;actions:PricingRepairAction[];quote_successes:number;quote_failures:number;best_safe_cogs_cents:number|null;retail_credit_price:number|null;remaining_enabled_capabilities:string[];notes:string[];}
export interface PricingRepairResult{checked_at:string;cursor:number;next_cursor:number|null;done:boolean;total_targets:number;processed:number;fixed:number;disabled:number;rows:PricingRepairRow[];}

function signatureFor(profile:NonNullable<ReturnType<typeof routePricingProfile>>){const p=profile.params;return pricingSignatureService.create({model_id:p.model_id,mode:p.mode,resolution:p.resolution,duration_seconds:p.mode==='TEXT_TO_SPEECH'?1:p.duration_seconds,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,reference_mode:p.references.length?'reference':'none',reference_count:p.references.length,model_variant:p.model_variant,pricing_options:p.pricing_options});}
function quoteInput(modelId:string,capabilityId:string,identifier:string,profile:NonNullable<ReturnType<typeof routePricingProfile>>){const p=profile.params;return{userId:'pricing-repair',model_id:modelId,mode:p.mode,capability_id:capabilityId,provider_model_identifier:identifier,prompt:p.prompt,duration_seconds:p.duration_seconds,resolution:p.resolution,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,model_variant:p.model_variant,pricing_options:p.pricing_options,provider_references:p.references};}
function normalizeUnitPrice(total:number,unit:ProviderPricingUnit,quantity:number){return quantity>0&&['CHARACTER','SECOND','MINUTE'].includes(unit)?total/quantity:total;}
function liveRule(providerId:string,identifier:string,capabilityId:string,profile:NonNullable<ReturnType<typeof routePricingProfile>>,total:number):Omit<ProviderPricingRule,'pricing_id'|'updated_at'>{return{provider_id:providerId,provider_model_identifier:identifier,capability_id:capabilityId,unit:profile.pricing_unit,unit_price_usd:normalizeUnitPrice(total,profile.pricing_unit,profile.baseline_quantity),minimum_usd:null,verified:true,source:'LIVE_CATALOG',quote_mode:'LIVE_PROVIDER',base_price_usd:total,verified_at:new Date().toISOString()};}

export const pricingRepairService={
 async run(cursor=0,limit=2):Promise<PricingRepairResult>{
  const checkedAt=new Date().toISOString();
  const[models,mappings,providers]=await Promise.all([catalogRepository.listModels(),catalogRepository.listMappings(),providerCatalogService.listProviders()]);
  const published=models.filter(model=>model.status==='ACTIVE'&&model.beta_only!==true);
  const targets=published.flatMap(model=>capabilityIdsForModel(model).map(capability_id=>({model,capability_id})));
  const safeCursor=Math.max(0,Math.floor(Number(cursor)||0)),safeLimit=Math.min(2,Math.max(1,Math.floor(Number(limit)||2))),batch=targets.slice(safeCursor,safeCursor+safeLimit);
  const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider] as const));
  const adapterById=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter] as const));
  const rows:PricingRepairRow[]=[];
  for(const target of batch){
   const {model}=target,capabilityId=target.capability_id as CapabilityId,actions:PricingRepairAction[]=[],notes:string[]=[];
   const policy=await betaCatalogPolicyService.ensureModelPolicy(model);
   const activeMappings=mappings.filter(mapping=>mapping.model_id===model.model_id&&mapping.status==='ACTIVE'&&(!mapping.capabilities?.length||mapping.capabilities.includes(capabilityId)));
   let quoteSuccesses=0,quoteFailures=0,bestSafe:number|null=null,bestSignature:ReturnType<typeof signatureFor>|null=null;
   for(const mapping of activeMappings){
    const providerId=String(mapping.provider_id),provider=providerById.get(providerId),adapter=adapterById.get(providerId),identifier=String(mapping.provider_model_identifier||'').trim();
    const profile=routePricingProfile(model,mapping,capabilityId);
    if(!provider||provider.status!=='ACTIVE'||!adapter?.isConfigured()||!adapter.quoteCostUsd||!identifier||!profile||!adapter.supports(model.model_id,profile.mode,identifier)){quoteFailures++;continue;}
    try{
     const quote=await quoteCacheService.getOrQuote(adapter,quoteInput(model.model_id,capabilityId,identifier,profile),true);
     const total=Number(quote.provider_cost_usd),safe=Number(quote.fully_loaded_safe_cogs_cents||quote.safe_cost_brl_cents);
     if(!Number.isFinite(total)||total<0||!Number.isFinite(safe)||safe<=0){quoteFailures++;continue;}
     quoteSuccesses++;
     const existingPricing=await providerPricingCatalogService.getVerified(providerId,identifier,capabilityId);
     if(!existingPricing){await providerPricingCatalogService.save(liveRule(providerId,identifier,capabilityId,profile,total));actions.push('PRICING_VERIFIED');}
     const signature=signatureFor(profile);
     if(bestSafe===null||safe<bestSafe){bestSafe=safe;bestSignature=signature;}
    }catch(err:any){quoteFailures++;notes.push(`${providerId}: ${String(err?.code||err?.message||'quote failed')}`);}
   }
   let nextCaps=[...(policy.capability_ids||[])];let retailCredit:number|null=null;
   if(bestSafe!==null&&bestSignature){
    if(!nextCaps.includes(capabilityId)){nextCaps=Array.from(new Set([...nextCaps,capabilityId]));actions.push('CAPABILITY_ENABLED');}
    const before=await retailPricingService.get(bestSignature.hash);const retail=await retailPricingService.resolveOrBootstrap(bestSignature,bestSafe);retailCredit=retail.retail_credit_price;if(!before)actions.push('RETAIL_BOOTSTRAPPED');
   }else{
    if(nextCaps.includes(capabilityId)){nextCaps=nextCaps.filter(id=>id!==capabilityId);actions.push('CAPABILITY_DISABLED');notes.push('Nenhuma rota ativa retornou quote válida; capability removida da exposição pública.');}
    for(const mapping of activeMappings){
      const caps=(mapping.capabilities||[]).map(String);
      if(caps.length>1){await catalogRepository.saveMapping({...mapping,capabilities:caps.filter(id=>id!==capabilityId) as any,updated_at:new Date().toISOString()});}
      else{await catalogRepository.saveMapping({...mapping,status:'INACTIVE',updated_at:new Date().toISOString()});}
      actions.push('MAPPING_DISABLED');
    }
   }
   const changed=nextCaps.length!==policy.capability_ids.length||nextCaps.some(id=>!policy.capability_ids.includes(id));
   if(changed){await catalogPolicyRepository.saveModelPolicy({...policy,capability_ids:nextCaps,enabled:nextCaps.length>0,auto_routing_enabled:nextCaps.length>0,updated_by:'system:pricing-repair'});}
   if(!actions.length)actions.push('ALREADY_HEALTHY');
   rows.push({model_id:model.model_id,model_name:model.name,capability_id:capabilityId,actions:Array.from(new Set(actions)),quote_successes:quoteSuccesses,quote_failures:quoteFailures,best_safe_cogs_cents:bestSafe,retail_credit_price:retailCredit,remaining_enabled_capabilities:nextCaps,notes});
  }
  const next=safeCursor+batch.length<targets.length?safeCursor+batch.length:null;
  return{checked_at:checkedAt,cursor:safeCursor,next_cursor:next,done:next===null,total_targets:targets.length,processed:rows.length,fixed:rows.filter(row=>row.actions.some(action=>['RETAIL_BOOTSTRAPPED','PRICING_VERIFIED','CAPABILITY_ENABLED'].includes(action))).length,disabled:rows.filter(row=>row.actions.includes('CAPABILITY_DISABLED')).length,rows};
 }
};