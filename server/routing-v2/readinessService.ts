import { routingV2Repository } from './repository.js';
import { routingV2RouteService } from './routeService.js';
import { isOfficialRoutingV2Provider } from './providerService.js';

export const routingV2ReadinessService={
  async audit(){
    const[models,routes,availableRoutes]=await Promise.all([
      routingV2Repository.listModels(),
      routingV2Repository.listRoutes(),
      routingV2RouteService.listReady(),
    ]);
    const activeModels=models.filter(model=>model.status==='ACTIVE');
    const activeModelIds=new Set(activeModels.map(model=>model.model_id));
    const officialRoutes=routes.filter(route=>isOfficialRoutingV2Provider(route.provider_id));
    const required=activeModels.flatMap(model=>(model.capabilities||[]).map(capability_id=>({model_id:model.model_id,capability_id})));
    const readyRoutes=availableRoutes.filter(route=>activeModelIds.has(route.model_id));
    const ready=new Set(readyRoutes.map(route=>`${route.model_id}|${route.capability_id}`));
    const missing=required.filter(target=>!ready.has(`${target.model_id}|${target.capability_id}`));
    return{
      checked_at:new Date().toISOString(),
      v2:{
        models:models.length,
        active_models:activeModels.length,
        routes:officialRoutes.length,
        ready_routes:readyRoutes.length,
      },
      coverage:{
        required_model_capabilities:required.length,
        ready_model_capabilities:required.length-missing.length,
        missing,
      },
    };
  },
};
