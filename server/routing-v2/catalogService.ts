import { CapabilityId, getCapabilityDefinition } from '../beta/capabilityRegistry.js';
import { RoutingV2Model, RoutingV2ProviderRoute } from './domain.js';
import { routingV2Repository } from './repository.js';
import { routingV2RouteService } from './routeService.js';

export interface RoutingV2PublicModel extends RoutingV2Model{
  available_capabilities:CapabilityId[];
}

export const routingV2CatalogService={
  async listPublicModels():Promise<RoutingV2PublicModel[]>{
    const[models,routes]=await Promise.all([
      routingV2Repository.listModels(),
      routingV2RouteService.listReady(),
    ]);
    const readyByModel=new Map<string,Set<CapabilityId>>();
    for(const route of routes){
      const set=readyByModel.get(route.model_id)||new Set<CapabilityId>();
      set.add(route.capability_id);
      readyByModel.set(route.model_id,set);
    }
    return models
      .filter(model=>model.status==='ACTIVE')
      .map(model=>({...model,available_capabilities:[...(readyByModel.get(model.model_id)||new Set<CapabilityId>())]}))
      .filter(model=>model.available_capabilities.length>0);
  },

  async listPublicRoutes(capabilityId?:CapabilityId):Promise<RoutingV2ProviderRoute[]>{
    const routes=await routingV2RouteService.listReady(undefined,capabilityId);
    const models=new Map((await routingV2Repository.listModels()).map(model=>[model.model_id,model] as const));
    return routes.filter(route=>models.get(route.model_id)?.status==='ACTIVE');
  },

  async hasReadyRoute(modelId:string,capabilityId:CapabilityId){
    return (await routingV2RouteService.listReady(modelId,capabilityId)).length>0;
  },

  async listGeneratorModels(){
    const models=await this.listPublicModels();
    return models.map(model=>({model_id:model.model_id,name:model.name,slug:model.slug,category:model.category,description:model.description,status:'ACTIVE',supported_modes:model.available_capabilities.map(capability=>String(capability).replace(/-/g,'_').toUpperCase()),beta_capability_ids:model.available_capabilities,created_at:model.created_at,updated_at:model.updated_at}));
  },

  async listGeneratorRoutes(capabilityId?:CapabilityId){
    const[routes,providers]=await Promise.all([this.listPublicRoutes(capabilityId),routingV2Repository.listProviders()]);
    const names=new Map(providers.map(provider=>[provider.provider_id,provider.name]));
    return routes.map(route=>({model_id:route.model_id,provider_id:route.provider_id,provider_name:names.get(route.provider_id)||route.provider_id,provider_model_identifier:route.provider_model_identifier,capabilities:[route.capability_id]}));
  },

  async listCapabilityModels(capabilityIds:CapabilityId[]){
    const wanted=new Set(capabilityIds);
    const[models,routes,providers]=await Promise.all([routingV2Repository.listModels(),routingV2RouteService.listReady(),routingV2Repository.listProviders()]);
    const providerNames=new Map(providers.map(provider=>[provider.provider_id,provider.name]));
    return models.filter(model=>model.status==='ACTIVE').flatMap(model=>{
      const modelRoutes=routes.filter(route=>route.model_id===model.model_id&&wanted.has(route.capability_id));
      if(!modelRoutes.length)return[];
      const capabilities=[...new Set(modelRoutes.map(route=>route.capability_id))].map(id=>{
        const definition=getCapabilityDefinition(id)!;
        const controls=model.supported_controls||{};
        const durations=Array.isArray(controls.supported_durations)?controls.supported_durations.map(Number).filter(Number.isFinite):[];
        const resolutions=Array.isArray(controls.supported_resolutions)?controls.supported_resolutions.map(String):[];
        const ratios=Array.isArray(controls.supported_aspect_ratios)?controls.supported_aspect_ratios.map(String):[];
        return{id,inputs:definition.inputs,outputs:definition.outputs,controls:definition.controls,supported_durations:durations,supported_resolutions:resolutions,supported_aspect_ratios:ratios};
      });
      const providerRoutes=new Map<string,Set<CapabilityId>>();
      for(const route of modelRoutes){const set=providerRoutes.get(route.provider_id)||new Set<CapabilityId>();set.add(route.capability_id);providerRoutes.set(route.provider_id,set);}
      const providerOptions=[...providerRoutes].map(([provider_id,ids])=>({provider_id,name:providerNames.get(provider_id)||provider_id,capability_ids:[...ids]}));
      const controls=model.supported_controls||{};
      return[{model_id:model.model_id,name:model.name,category:model.category,supported_durations:Array.isArray(controls.supported_durations)?controls.supported_durations:[],supported_resolutions:Array.isArray(controls.supported_resolutions)?controls.supported_resolutions:[],supported_aspect_ratios:Array.isArray(controls.supported_aspect_ratios)?controls.supported_aspect_ratios:[],capabilities,providers:providerOptions}];
    });
  },
};
