import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerPricingCatalogService } from './providerPricingCatalogService.js';
import { providerFinanceService, ProviderFinanceSnapshot } from './providerFinanceService.js';
import { quoteCacheService } from './quoteCacheService.js';
import { retailPricingService } from './retailPricingService.js';
import { pricingSignatureService } from './pricingSignatureService.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { capabilityIdsForModel, CapabilityId } from '../beta/capabilityRegistry.js';
import { routePricingProfile } from './routePricingProfileService.js';

export type PricingAuditStage='MODEL'|'CAPABILITY'|'MAPPING'|'PROVIDER'|'IDENTIFIER'|'PRICING'|'QUOTE'|'SMART_ROUTER'|'RETAIL_PRICING';
export interface PricingAuditAttempt{
 provider_id:string;provider_name:string;provider_model_identifier:string;
 provider_active:boolean;provider_configured:boolean;identifier_valid:boolean;
 pricing_verified:boolean;pricing_unit?:string|null;pricing_source?:string|null;quote_mode?:string|null;
 quote_ok:boolean;quote_error?:string|null;provider_cost_usd?:number|null;safe_cogs_cents?:number|null;
 smart_router_eligible:boolean;smart_router_reason?:string|null;
}
export interface PricingAuditRow{
 model_id:string;model_name:string;category:string;capability_id:string;mode:string|null;
 price_available:boolean;failed_stage:PricingAuditStage|null;failure_reason:string|null;
 stages:Record<PricingAuditStage,{ok:boolean;detail:string}>;
 retail_pricing_id?:string|null;retail_credit_price?:number|null;retail_version?:number|null;
 attempts:PricingAuditAttempt[];
}
export interface PricingAuditResult{checked_at:string;models_checked:number;routes_checked:number;missing_price_count:number;priced_count:number;stage_counts:Record<string,number>;rows:PricingAuditRow[];cursor:number;next_cursor:number|null;done:boolean;total_targets:number;}

const STAGES:PricingAuditStage[]=['MODEL','CAPABILITY','MAPPING','PROVIDER','IDENTIFIER','PRICING','QUOTE','SMART_ROUTER','RETAIL_PRICING'];
const statusRecord=()=>Object.fromEntries(STAGES.map(stage=>[stage,{ok:false,detail:'Não avaliado.'}])) as PricingAuditRow['stages'];
function signatureFor(profile:NonNullable<ReturnType<typeof routePricingProfile>>){const p=profile.params;return pricingSignatureService.create({model_id:p.model_id,mode:p.mode,resolution:p.resolution,duration_seconds:p.mode==='TEXT_TO_SPEECH'?1:p.duration_seconds,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,reference_mode:p.references.length?'reference':'none',reference_count:p.references.length,model_variant:p.model_variant,pricing_options:p.pricing_options});}
function quoteInput(modelId:string,capabilityId:string,identifier:string,profile:NonNullable<ReturnType<typeof routePricingProfile>>){const p=profile.params;return{userId:'pricing-audit',model_id:modelId,mode:p.mode,capability_id:capabilityId,provider_model_identifier:identifier,prompt:p.prompt,duration_seconds:p.duration_seconds,resolution:p.resolution,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,model_variant:p.model_variant,pricing_options:p.pricing_options,provider_references:p.references};}

export const pricingChainAuditService={
 async run(cursor=0,limit=2):Promise<PricingAuditResult>{
  const checkedAt=new Date().toISOString();
  const[models,mappings,providers,catalog,finance]=await Promise.all([catalogRepository.listModels(),catalogRepository.listMappings(),providerCatalogService.listProviders(),betaCatalogPolicyService.listCatalog(),providerFinanceService.getAll(false).catch(()=>[] as ProviderFinanceSnapshot[])]);
  const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider] as const));
  const policyByModel=new Map(catalog.map(item=>[item.model_id,item] as const));
  const financeById=new Map<string,ProviderFinanceSnapshot>(finance.map(item=>[String(item.provider_id),item] as const));
  const adapterById=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter] as const));
  const published=models.filter(model=>model.status==='ACTIVE'&&model.beta_only!==true);
  const targets=published.flatMap(model=>capabilityIdsForModel(model).map(capability_id=>({model,capability_id})));
  const safeCursor=Math.max(0,Math.floor(Number(cursor)||0)),safeLimit=Math.min(3,Math.max(1,Math.floor(Number(limit)||2)));
  const batch=targets.slice(safeCursor,safeCursor+safeLimit);
  const rows:PricingAuditRow[]=[];
  for(const target of batch){
   const model=target.model,capabilityId=target.capability_id;
   const policy=policyByModel.get(model.model_id);
    const stages=statusRecord();
    stages.MODEL={ok:true,detail:'Modelo ACTIVE e publicado no Stable.'};
    const capabilityEnabled=Boolean(policy?.enabled&&policy?.eligible&&policy.capability_ids.includes(capabilityId));
    stages.CAPABILITY={ok:capabilityEnabled,detail:capabilityEnabled?'Capability habilitada pela policy do modelo.':'Capability ausente/desabilitada na policy ou pricing policy inativa.'};
    if(!capabilityEnabled){rows.push({model_id:model.model_id,model_name:model.name,category:model.category,capability_id:capabilityId,mode:null,price_available:false,failed_stage:'CAPABILITY',failure_reason:stages.CAPABILITY.detail,stages,attempts:[]});continue;}
    const activeMappings=mappings.filter(mapping=>mapping.model_id===model.model_id&&mapping.status==='ACTIVE'&&(!mapping.capabilities?.length||mapping.capabilities.includes(capabilityId)));
    stages.MAPPING={ok:activeMappings.length>0,detail:activeMappings.length?`${activeMappings.length} mapping(s) ACTIVE para a capability.`:'Nenhum mapping ACTIVE para a capability.'};
    if(!activeMappings.length){rows.push({model_id:model.model_id,model_name:model.name,category:model.category,capability_id:capabilityId,mode:null,price_available:false,failed_stage:'MAPPING',failure_reason:stages.MAPPING.detail,stages,attempts:[]});continue;}
    const attempts:PricingAuditAttempt[]=[];let mode:string|null=null;let anyProvider=false,anyIdentifier=false,anyPricing=false,anyQuote=false,anyRouter=false;let retail:any=null;
    for(const mapping of activeMappings){
     const providerId=String(mapping.provider_id),provider=providerById.get(providerId),adapter=adapterById.get(providerId);
     const providerActive=Boolean(provider&&provider.status==='ACTIVE'),configured=Boolean(adapter?.isConfigured());
     anyProvider=anyProvider||(providerActive&&configured);
     const profile=routePricingProfile(model,mapping,capabilityId as CapabilityId);if(profile)mode=profile.mode;
     const identifier=String(mapping.provider_model_identifier||'').trim();
     const identifierValid=Boolean(profile&&identifier&&adapter?.supports(model.model_id,profile.mode,identifier));anyIdentifier=anyIdentifier||identifierValid;
     const verified=identifier?await providerPricingCatalogService.getVerified(providerId,identifier,capabilityId):null;anyPricing=anyPricing||Boolean(verified);
     let quoteOk=false,quoteError:string|null=null,providerCost:number|null=null,safeCogs:number|null=null,routerEligible=false,routerReason:string|null=null;
     if(providerActive&&configured&&identifierValid&&profile){
      try{const quote=await quoteCacheService.getOrQuote(adapter!,quoteInput(model.model_id,capabilityId,identifier,profile),false);quoteOk=true;providerCost=Number(quote.provider_cost_usd);safeCogs=Number(quote.fully_loaded_safe_cogs_cents||quote.safe_cost_brl_cents);anyQuote=true;const f=financeById.get(providerId);if(f?.balance_brl_cents!=null&&f.balance_brl_cents<Number(quote.provider_cost_brl_cents||0)){routerReason='Saldo do provider insuficiente para a cotação.';}else{routerEligible=true;routerReason='Rota elegível ao Smart Router.';anyRouter=true;const signature=signatureFor(profile);const candidateRetail=await retailPricingService.get(signature.hash);if(candidateRetail?.active&&(!retail||candidateRetail.retail_credit_price<retail.retail_credit_price))retail=candidateRetail;}}catch(err:any){quoteError=String(err?.code||err?.message||'Cotação falhou.');}
     }else if(!providerActive)quoteError='Provider inativo ou ausente.';else if(!configured)quoteError='Provider sem credencial/configuração runtime.';else if(!identifierValid)quoteError='provider_model_identifier ausente ou incompatível com o adapter.';
     attempts.push({provider_id:providerId,provider_name:provider?.name||providerId,provider_model_identifier:identifier,provider_active:providerActive,provider_configured:configured,identifier_valid:identifierValid,pricing_verified:Boolean(verified),pricing_unit:verified?.unit||null,pricing_source:verified?.source||null,quote_mode:verified?.quote_mode||null,quote_ok:quoteOk,quote_error:quoteError,provider_cost_usd:providerCost,safe_cogs_cents:safeCogs,smart_router_eligible:routerEligible,smart_router_reason:routerReason});
    }
    stages.PROVIDER={ok:anyProvider,detail:anyProvider?'Há provider ACTIVE e configurado.':'Nenhum mapping aponta para provider ACTIVE + configurado.'};
    stages.IDENTIFIER={ok:anyIdentifier,detail:anyIdentifier?'Há provider_model_identifier aceito pelo adapter.':'Nenhum identificador é aceito pelo adapter para esta capability.'};
    stages.PRICING={ok:anyPricing,detail:anyPricing?'Existe provider_pricing verificado para ao menos uma rota.':'Nenhuma rota possui provider_pricing verificado.'};
    stages.QUOTE={ok:anyQuote,detail:anyQuote?'Ao menos uma rota retornou cotação válida.':'Nenhuma rota retornou cotação válida.'};
    stages.SMART_ROUTER={ok:anyRouter,detail:anyRouter?'Ao menos uma rota cotada é elegível ao Smart Router.':'Nenhuma rota cotada ficou elegível ao Smart Router.'};
    stages.RETAIL_PRICING={ok:Boolean(retail),detail:retail?'Retail pricing ativo encontrado para a assinatura baseline.':'Retail pricing ativo não encontrado para a assinatura baseline.'};
    const failed=STAGES.find(stage=>!stages[stage].ok)||null;
    rows.push({model_id:model.model_id,model_name:model.name,category:model.category,capability_id:capabilityId,mode,price_available:!failed,failed_stage:failed,failure_reason:failed?stages[failed].detail:null,stages,retail_pricing_id:retail?.retail_pricing_id||null,retail_credit_price:retail?.retail_credit_price??null,retail_version:retail?.version??null,attempts});
  }
  const missing=rows.filter(row=>!row.price_available),stageCounts:Record<string,number>={};for(const row of missing)stageCounts[row.failed_stage||'UNKNOWN']=(stageCounts[row.failed_stage||'UNKNOWN']||0)+1;
  const next=safeCursor+batch.length<targets.length?safeCursor+batch.length:null;
  return{checked_at:checkedAt,models_checked:published.length,routes_checked:rows.length,missing_price_count:missing.length,priced_count:rows.length-missing.length,stage_counts:stageCounts,rows:missing.sort((a,b)=>a.model_name.localeCompare(b.model_name)||a.capability_id.localeCompare(b.capability_id)),cursor:safeCursor,next_cursor:next,done:next===null,total_targets:targets.length};
 }
};