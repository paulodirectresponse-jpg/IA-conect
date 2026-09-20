import { routingV2Repository } from './repository.js';
import { routingV2ReadinessService } from './readinessService.js';

export type RoutingV2CutoverMode='HYBRID'|'V2_ONLY';

const isPreview=()=>String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()==='true';

export const routingV2CutoverService={
  async get(){
    const[state,audit]=await Promise.all([
      routingV2Repository.getCutoverState(),
      routingV2ReadinessService.audit(),
    ]);
    return{...state,preview:isPreview(),readiness:audit.coverage};
  },

  async set(mode:RoutingV2CutoverMode,updatedBy?:string|null){
    if(!['HYBRID','V2_ONLY'].includes(mode))throw new Error('Modo de cutover inválido.');
    if(mode==='V2_ONLY')throw Object.assign(new Error('V2_ONLY permanece proibido; HYBRID e fallback V1 são obrigatórios.'),{code:'ROUTING_V2_V2_ONLY_BLOCKED'});
    const audit=await routingV2ReadinessService.audit();
    const state={mode,updated_at:new Date().toISOString(),updated_by:updatedBy||null};
    await routingV2Repository.saveCutoverState(state);
    return{...state,preview:isPreview(),readiness:audit.coverage};
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
