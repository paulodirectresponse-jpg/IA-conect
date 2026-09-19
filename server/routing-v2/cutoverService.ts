import { routingV2Repository } from './repository.js';
import { routingV2MigrationService } from './migrationService.js';

export type RoutingV2CutoverMode='HYBRID'|'V2_ONLY';

export const routingV2CutoverService={
  async get(){
    const[state,audit]=await Promise.all([
      routingV2Repository.getCutoverState(),
      routingV2MigrationService.audit(),
    ]);
    return{...state,readiness:audit.coverage};
  },

  async set(mode:RoutingV2CutoverMode,updatedBy?:string|null){
    if(!['HYBRID','V2_ONLY'].includes(mode))throw new Error('Modo de cutover inválido.');
    const audit=await routingV2MigrationService.audit();
    if(mode==='V2_ONLY'){
      const ready=Number(audit.coverage.ready_model_capabilities||0);
      const required=Number(audit.coverage.required_model_capabilities||0);
      if(required<=0||ready!==required){
        throw Object.assign(new Error('V2_ONLY exige cobertura READY completa para todas as model-capabilities ativas do V1.'),{
          code:'ROUTING_V2_CUTOVER_NOT_READY',
          details:audit.coverage,
        });
      }
    }
    const state={mode,updated_at:new Date().toISOString(),updated_by:updatedBy||null};
    await routingV2Repository.saveCutoverState(state);
    return{...state,readiness:audit.coverage};
  },

  async shouldUseV2(modelId:string,capabilityId:string){
    const state=await routingV2Repository.getCutoverState();
    const routes=(await routingV2Repository.listRoutes()).filter(route=>
      route.model_id===modelId&&route.capability_id===capabilityId&&route.status==='READY'
    );
    if(state.mode==='V2_ONLY')return{use_v2:true,require_v2:true,ready:routes.length>0,state};
    return{use_v2:routes.length>0,require_v2:false,ready:routes.length>0,state};
  },
};
