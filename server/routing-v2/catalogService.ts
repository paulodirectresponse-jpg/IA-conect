import { CapabilityId } from '../beta/capabilityRegistry.js';
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
};
