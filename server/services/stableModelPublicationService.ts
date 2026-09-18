import { ModelRegistryItem } from '../../src/types/index.js';
import { capabilityIdsForModel, CapabilityId } from '../beta/capabilityRegistry.js';
import { betaCatalogPolicyService } from '../beta/catalog/catalogPolicyService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerPricingCatalogService } from './providerPricingCatalogService.js';

export interface StablePublicationStatus{
  model_id:string;
  name:string;
  status:string;
  beta_only:boolean;
  published:boolean;
  ready:boolean;
  supported_capability_ids:CapabilityId[];
  ready_capability_ids:CapabilityId[];
  missing_capability_ids:CapabilityId[];
  ready_routes:number;
}

function priceMatches(pricing:any[],providerId:string,identifier:string,capabilityId:string){
  return pricing.some(row=>row?.verified&&row.provider_id===providerId&&row.provider_model_identifier===identifier&&(!row.capability_id||row.capability_id===capabilityId));
}

async function snapshot(){
  const[models,providers,mappings,pricing]=await Promise.all([
    catalogRepository.listModels(),
    providerCatalogService.listProviders(),
    catalogRepository.listMappings(),
    providerPricingCatalogService.list(),
  ]);
  const providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
  const configured=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()]));
  return{models,providerById,configured,mappings,pricing};
}

function statusFor(model:ModelRegistryItem,data:Awaited<ReturnType<typeof snapshot>>):StablePublicationStatus{
  const supported=capabilityIdsForModel(model);
  const activeMappings=data.mappings.filter(mapping=>mapping.model_id===model.model_id&&mapping.status==='ACTIVE');
  const readyCaps=supported.filter(capability=>activeMappings.some(mapping=>{
    if(mapping.capabilities?.length&&!mapping.capabilities.includes(capability as any))return false;
    const provider=data.providerById.get(String(mapping.provider_id));
    if(!provider||provider.status!=='ACTIVE'||!data.configured.get(String(mapping.provider_id)))return false;
    return priceMatches(data.pricing,String(mapping.provider_id),mapping.provider_model_identifier,capability);
  }));
  const readySet=new Set(readyCaps);
  const missing=supported.filter(capability=>!readySet.has(capability));
  const readyRoutes=activeMappings.filter(mapping=>{
    const provider=data.providerById.get(String(mapping.provider_id));
    if(!provider||provider.status!=='ACTIVE'||!data.configured.get(String(mapping.provider_id)))return false;
    const caps=(mapping.capabilities?.length?mapping.capabilities:supported) as string[];
    return caps.some(capability=>supported.includes(capability as CapabilityId)&&priceMatches(data.pricing,String(mapping.provider_id),mapping.provider_model_identifier,capability));
  }).length;
  const published=model.status==='ACTIVE'&&model.beta_only!==true;
  return{
    model_id:model.model_id,name:model.name,status:model.status,beta_only:model.beta_only===true,published,
    ready:readyCaps.length>0,
    supported_capability_ids:supported,
    ready_capability_ids:readyCaps,
    missing_capability_ids:missing,
    ready_routes:readyRoutes,
  };
}

export const stableModelPublicationService={
  async listStatus(){
    const data=await snapshot();
    return data.models.map(model=>statusFor(model,data));
  },

  async publish(modelId:string,updatedBy?:string){
    const data=await snapshot();
    const model=data.models.find(row=>row.model_id===modelId);
    if(!model)throw Object.assign(new Error('Modelo não encontrado no runtime.'),{code:'MODEL_NOT_FOUND'});
    const status=statusFor(model,data);
    if(!status.ready)throw Object.assign(new Error('Modelo ainda não pode ser publicado: nenhuma capability possui rota segura com preço verificado.'),{code:'MODEL_NOT_STABLE_READY',details:status});

    const next=await catalogRepository.saveModel({...model,status:'ACTIVE',beta_only:false,beta_capability_ids:status.ready_capability_ids,updated_at:new Date().toISOString()});
    const policy=await betaCatalogPolicyService.saveModelPolicy(modelId,{
      capability_ids:status.ready_capability_ids,
      enabled:true,
      auto_routing_enabled:true,
    },'system:stable-publish');
    return{model:next,policy,status:{...status,status:'ACTIVE',beta_only:false,published:true}};
  },
};
