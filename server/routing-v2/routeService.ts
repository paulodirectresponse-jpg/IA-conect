import { CapabilityId } from '../beta/capabilityRegistry.js';
import {
  RoutingV2BillingConfig,
  RoutingV2ProviderRoute,
  assertRoutingV2BillingConfig,
  routingV2RouteId,
} from './domain.js';
import { routingV2Repository } from './repository.js';
import { assertIdentifierMatchesCapability } from './capabilityMappingValidation.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { routingV2Candidate } from './routeCandidate.js';

const now=()=>new Date().toISOString();

export interface CreateRoutingV2RouteInput{
  model_id:string;
  capability_id:CapabilityId;
  provider_id:string;
  provider_model_identifier:string;
  mapping_source:'PROVIDER_CATALOG_API'|'PROVIDER_DOCS'|'MANUAL_VERIFIED';
  mapping_source_reference:string;
  mapping_verified_at:string;
  billing_config:RoutingV2BillingConfig;
  priority?:number;
}

export interface UpdateRoutingV2RouteInput{
  billing_config?:RoutingV2BillingConfig;
  priority?:number;
}

async function validateRouteReferences(input:CreateRoutingV2RouteInput){
  if(!isOfficialRoutingV2Provider(input.provider_id))throw new Error('Somente WaveSpeed AI, Atlas Cloud e Runware podem receber novas rotas.');
  const[model,provider]=await Promise.all([
    routingV2Repository.getModel(input.model_id),
    routingV2Repository.getProvider(input.provider_id),
  ]);
  if(!model)throw new Error('Model V2 não encontrado.');
  if(model.status!=='ACTIVE')throw new Error('Model V2 está desativado.');
  if(!model.capabilities.includes(input.capability_id))throw new Error('Capability não pertence ao Model V2.');
  if(!provider)throw new Error('Provider V2 não encontrado.');
  if(provider.status==='DISABLED')throw new Error('Provider V2 está desativado.');
  return{model,provider};
}

export const routingV2RouteService={
  async list(){
    return routingV2Repository.listRoutes();
  },

  async get(routeId:string){
    return routingV2Repository.getRoute(routeId);
  },

  async listByProvider(providerId:string){
    return (await routingV2Repository.listRoutes()).filter(route=>route.provider_id===providerId);
  },

  async listByModelCapability(modelId:string,capabilityId:CapabilityId){
    return (await routingV2Repository.listRoutes()).filter(route=>route.model_id===modelId&&route.capability_id===capabilityId);
  },

  async listReady(modelId?:string,capabilityId?:CapabilityId){
    const[routes,providers,models]=await Promise.all([routingV2Repository.listRoutes(),routingV2Repository.listProviders(),routingV2Repository.listModels()]);
    const providerById=new Map(providers.map(provider=>[provider.provider_id,provider]));
    const modelById=new Map(models.map(model=>[model.model_id,model]));
    const now=new Date().toISOString();
    return routes.filter(route=>{
      if(modelId&&route.model_id!==modelId)return false;
      if(capabilityId&&route.capability_id!==capabilityId)return false;
      if(route.status!=='READY')return false;
      if(!isOfficialRoutingV2Provider(route.provider_id))return false;
      const provider=providerById.get(route.provider_id);
      if(!provider||provider.status!=='ACTIVE'||provider.health_status!=='HEALTHY')return false;
      const model=modelById.get(route.model_id);
      if(!model||model.status!=='ACTIVE'||!model.capabilities.includes(route.capability_id))return false;
      return Boolean(routingV2Candidate(route,now));
    });
  },

  async create(input:CreateRoutingV2RouteInput){
    const modelId=String(input.model_id||'').trim();
    const providerId=String(input.provider_id||'').trim();
    const identifier=String(input.provider_model_identifier||'').trim();
    if(!modelId||!providerId||!identifier)throw new Error('Model, provider e provider_model_identifier são obrigatórios.');
    if(!input.mapping_source_reference?.trim()||!Number.isFinite(Date.parse(input.mapping_verified_at)))throw new Error('Route V2 exige prova verificável do mapping.');
    assertIdentifierMatchesCapability(identifier,input.capability_id);
    assertRoutingV2BillingConfig(input.billing_config);
    await validateRouteReferences({...input,model_id:modelId,provider_id:providerId,provider_model_identifier:identifier});
    const routeId=routingV2RouteId(modelId,input.capability_id,providerId,identifier);
    if(await routingV2Repository.getRoute(routeId))throw new Error('Route V2 já existe.');
    const timestamp=now();
    const route:RoutingV2ProviderRoute={
      route_id:routeId,
      model_id:modelId,
      capability_id:input.capability_id,
      provider_id:providerId,
      provider_model_identifier:identifier,
      mapping_source:input.mapping_source,
      mapping_source_reference:input.mapping_source_reference.trim(),
      mapping_verified_at:new Date(input.mapping_verified_at).toISOString(),
      status:'MAPPED',
      pricing_status:'UNKNOWN',
      runtime_status:'UNKNOWN',
      billing_type:input.billing_config.type,
      billing_config:input.billing_config,
      pricing_snapshot:null,
      metrics:{},
      priority:Number.isFinite(Number(input.priority))?Number(input.priority):100,
      last_price_sync_at:null,
      last_runtime_check_at:null,
      created_at:timestamp,
      updated_at:timestamp,
    };
    return routingV2Repository.saveRoute(route);
  },

  async update(routeId:string,input:UpdateRoutingV2RouteInput){
    const current=await routingV2Repository.getRoute(routeId);
    if(!current)throw new Error('Route V2 não encontrada.');
    const billingConfig=input.billing_config||current.billing_config;
    assertRoutingV2BillingConfig(billingConfig);
    const priority=input.priority===undefined?current.priority:Number(input.priority);
    if(!Number.isFinite(priority))throw new Error('Prioridade da Route V2 inválida.');
    const billingChanged=JSON.stringify(billingConfig)!==JSON.stringify(current.billing_config);
    const next:RoutingV2ProviderRoute={
      ...current,
      billing_type:billingConfig.type,
      billing_config:billingConfig,
      priority,
      ...(billingChanged?{
        status:'MAPPED' as const,
        pricing_status:'UNKNOWN' as const,
        pricing_snapshot:null,
        last_price_sync_at:null,
      }:{}),
      updated_at:now(),
    };
    return routingV2Repository.saveRoute(next);
  },

  async disable(routeId:string){
    const current=await routingV2Repository.getRoute(routeId);
    if(!current)throw new Error('Route V2 não encontrada.');
    return routingV2Repository.saveRoute({...current,status:'DISABLED',updated_at:now()});
  },
};
