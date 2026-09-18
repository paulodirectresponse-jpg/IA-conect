import { ModelRegistryItem } from '../../../src/types/index.js';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { capabilityIdsForModel, CapabilityId, isCapabilityId, validateModelCapability } from '../capabilityRegistry.js';
import { catalogPolicyRepository } from './catalogPolicyRepository.js';
import { BetaModelPolicy, BetaPricingPolicy } from './catalogPolicyTypes.js';

const DEFAULT_POLICY_ID='beta-default-v1';
const now=()=>new Date().toISOString();

function normalizeCapabilities(model:ModelRegistryItem,input:any):CapabilityId[]{
  const derived=capabilityIdsForModel(model);
  if(input===undefined||input===null)return derived;
  const requested=Array.isArray(input)?input.map(String):[];
  const invalid=requested.find(id=>!isCapabilityId(id)||!derived.includes(id as CapabilityId));
  if(invalid)throw Object.assign(new Error(`Capability inválida para o modelo: ${invalid}.`),{code:'CAPABILITY_NOT_SUPPORTED'});
  return Array.from(new Set(requested)) as CapabilityId[];
}

async function defaultModelPolicy(model:ModelRegistryItem):Promise<BetaModelPolicy>{
  const timestamp=now();
  const mappings=await catalogRepository.listMappings();
  const hasActiveMapping=mappings.some(mapping=>mapping.model_id===model.model_id&&mapping.status==='ACTIVE');
  return{
    model_id:model.model_id,
    pricing_policy_id:DEFAULT_POLICY_ID,
    capability_ids:capabilityIdsForModel(model),
    enabled:model.status!=='INACTIVE'&&hasActiveMapping,
    auto_routing_enabled:model.status==='ACTIVE'&&hasActiveMapping,
    created_at:timestamp,
    updated_at:timestamp,
    updated_by:null,
  };
}

export const betaCatalogPolicyService={
  async ensureModelPolicy(model:ModelRegistryItem){
    const existing=await catalogPolicyRepository.getModelPolicy(model.model_id);
    if(existing)return existing;
    const seeded=await defaultModelPolicy(model);
    try{return await catalogPolicyRepository.saveModelPolicy(seeded);}
    catch{return (await catalogPolicyRepository.getModelPolicy(model.model_id))||seeded;}
  },

  async reconcileModelPolicy(model:ModelRegistryItem){
    const existing=await catalogPolicyRepository.getModelPolicy(model.model_id);
    if(!existing)return this.ensureModelPolicy(model);
    // Policies changed explicitly by an admin remain authoritative. Automatic
    // reconciliation is only for system-seeded policies that became stale
    // after a mapping was approved.
    if(existing.updated_by)return existing;
    const mappings=await catalogRepository.listMappings();
    const hasActiveMapping=mappings.some(mapping=>mapping.model_id===model.model_id&&mapping.status==='ACTIVE');
    const next={
      ...existing,
      capability_ids:capabilityIdsForModel(model),
      enabled:model.status!=='INACTIVE'&&hasActiveMapping,
      auto_routing_enabled:model.status==='ACTIVE'&&hasActiveMapping,
    };
    if(next.enabled===existing.enabled&&next.auto_routing_enabled===existing.auto_routing_enabled&&
      next.capability_ids.length===existing.capability_ids.length&&next.capability_ids.every(id=>existing.capability_ids.includes(id)))return existing;
    return catalogPolicyRepository.saveModelPolicy(next);
  },

  async listCatalog(){
    // Read path must stay cheap under Cloudflare: load models, mappings and
    // policies in bulk. Missing policies are derived in memory instead of
    // performing one Firestore read/write per model.
    const[models,storedPolicies,mappings,pricingPolicies]=await Promise.all([
      catalogRepository.listModels(),
      catalogPolicyRepository.listModelPolicies(),
      catalogRepository.listMappings(),
      catalogPolicyRepository.listPricingPolicies(),
    ]);
    const policyByModel=new Map(storedPolicies.map(policy=>[policy.model_id,policy]));
    const activeMappingModels=new Set(mappings.filter(mapping=>mapping.status==='ACTIVE').map(mapping=>mapping.model_id));
    const pricingById=new Map(pricingPolicies.map(policy=>[policy.pricing_policy_id,policy]));
    return models.map(model=>{
      const derivedCapabilities=capabilityIdsForModel(model);
      const stored=policyByModel.get(model.model_id);
      const hasActiveMapping=activeMappingModels.has(model.model_id);
      const policy=stored||{
        model_id:model.model_id,
        pricing_policy_id:DEFAULT_POLICY_ID,
        capability_ids:derivedCapabilities,
        enabled:model.status!=='INACTIVE'&&hasActiveMapping,
        auto_routing_enabled:model.status==='ACTIVE'&&hasActiveMapping,
        created_at:now(),
        updated_at:now(),
        updated_by:null,
      };
      const pricing=pricingById.get(policy.pricing_policy_id)||null;
      return{
        model_id:model.model_id,
        name:model.name,
        category:model.category,
        status:model.status,
        capability_ids:policy.capability_ids,
        supported_capability_ids:derivedCapabilities,
        pricing_policy_id:policy.pricing_policy_id,
        enabled:policy.enabled,
        eligible:policy.enabled&&Boolean(pricing?.active)&&policy.capability_ids.length>0,
        auto_routing_enabled:policy.auto_routing_enabled,
        quote_ttl_seconds:pricing?.quote_ttl_seconds||0,
      };
    });
  },

  async resolveModel(modelId:string,capabilityId:string,forAuto=false){
    const model=await catalogRepository.getModel(modelId);
    if(!model)throw Object.assign(new Error('Modelo indisponível.'),{code:'MODEL_NOT_FOUND'});
    const policy=await this.ensureModelPolicy(model);
    if(!policy.enabled)throw Object.assign(new Error('Modelo desabilitado para o Beta.'),{code:'MODEL_NOT_ELIGIBLE'});
    if(forAuto&&!policy.auto_routing_enabled)throw Object.assign(new Error('Modelo fora do AUTO router.'),{code:'MODEL_NOT_AUTO_ELIGIBLE'});
    if(!isCapabilityId(capabilityId)||!policy.capability_ids.includes(capabilityId as CapabilityId)){
      throw Object.assign(new Error('Capability incompatível com a política do modelo.'),{code:'CAPABILITY_NOT_SUPPORTED'});
    }
    const pricingPolicy=await catalogPolicyRepository.getPricingPolicy(policy.pricing_policy_id);
    if(!pricingPolicy?.active)throw Object.assign(new Error('Política de preço indisponível.'),{code:'PRICING_POLICY_INACTIVE'});
    return{model,modelPolicy:policy,pricingPolicy};
  },

  async eligibleModels(capabilityId:string,requestedControls:string[]=[]){
    const models=await catalogRepository.listModels();
    const resolved=[];
    for(const model of models){
      try{
        const item=await this.resolveModel(model.model_id,capabilityId,true);
        if(!validateModelCapability(item.model,capabilityId,requestedControls).valid)continue;
        resolved.push(item);
      }catch{}
    }
    return resolved;
  },

  async listPricingPolicies(){return catalogPolicyRepository.listPricingPolicies();},

  async savePricingPolicy(input:any,updatedBy?:string):Promise<BetaPricingPolicy>{
    const id=String(input?.pricing_policy_id||'').trim();
    const name=String(input?.name||'').trim();
    if(!id||!name)throw Object.assign(new Error('ID e nome da política são obrigatórios.'),{code:'VALIDATION_ERROR'});
    const ttl=Math.round(Number(input?.quote_ttl_seconds));
    if(!Number.isFinite(ttl)||ttl<30||ttl>3600)throw Object.assign(new Error('TTL da quote deve ficar entre 30 e 3600 segundos.'),{code:'VALIDATION_ERROR'});
    const existing=await catalogPolicyRepository.getPricingPolicy(id);
    return catalogPolicyRepository.savePricingPolicy({
      pricing_policy_id:id,
      name:name.slice(0,80),
      quote_ttl_seconds:ttl,
      active:input?.active!==false,
      created_at:existing?.created_at||now(),
      updated_at:now(),
      updated_by:updatedBy||null,
    });
  },

  async saveModelPolicy(modelId:string,input:any,updatedBy?:string){
    const model=await catalogRepository.getModel(modelId);
    if(!model)throw Object.assign(new Error('Modelo não encontrado.'),{code:'MODEL_NOT_FOUND'});
    const pricingPolicyId=String(input?.pricing_policy_id||DEFAULT_POLICY_ID);
    const pricingPolicy=await catalogPolicyRepository.getPricingPolicy(pricingPolicyId);
    if(!pricingPolicy)throw Object.assign(new Error('Política de preço não encontrada.'),{code:'PRICING_POLICY_NOT_FOUND'});
    const existing=await this.ensureModelPolicy(model);
    return catalogPolicyRepository.saveModelPolicy({
      ...existing,
      pricing_policy_id:pricingPolicyId,
      capability_ids:normalizeCapabilities(model,input?.capability_ids),
      enabled:input?.enabled===undefined?existing.enabled:Boolean(input.enabled),
      auto_routing_enabled:input?.auto_routing_enabled===undefined?existing.auto_routing_enabled:Boolean(input.auto_routing_enabled),
      updated_by:updatedBy||null,
    });
  },
};
