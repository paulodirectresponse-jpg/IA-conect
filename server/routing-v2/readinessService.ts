import { routingV2Repository } from './repository.js';
import { routingV2Candidate } from './routerService.js';

export const routingV2ReadinessService={
  async audit(){
    const[models,routes]=await Promise.all([
      routingV2Repository.listModels(),
      routingV2Repository.listRoutes(),
    ]);
    const activeModels=models.filter(model=>model.status==='ACTIVE');
    const required=activeModels.flatMap(model=>(model.capabilities||[]).map(capability_id=>({model_id:model.model_id,capability_id})));
    const currentTime=new Date().toISOString();
    const readyRoutes=routes.filter(route=>routingV2Candidate(route,currentTime));
    const ready=new Set(readyRoutes.map(route=>`${route.model_id}|${route.capability_id}`));
    const missing=required.filter(target=>!ready.has(`${target.model_id}|${target.capability_id}`));
    return{
      checked_at:new Date().toISOString(),
      v2:{
        models:models.length,
        active_models:activeModels.length,
        routes:routes.length,
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
