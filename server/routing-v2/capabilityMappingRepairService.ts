import { CapabilityId } from '../beta/capabilityRegistry.js';
import { RoutingV2Model, RoutingV2ProviderRoute, routingV2RouteId } from './domain.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { routingV2Repository } from './repository.js';
import { identifierCapabilityMismatch, suggestedCapabilityForMismatch } from './capabilityMappingValidation.js';

export interface RoutingV2MappingRepairRow{
  route_id:string;
  replacement_route_id?:string|null;
  model_id:string;
  capability_id:string;
  suggested_capability_id?:string|null;
  provider_id:string;
  provider_model_identifier:string;
  result:'REPAIRED'|'BLOCKED';
  message:string;
}

export interface RoutingV2MappingRepairResult{
  checked_at:string;
  examined:number;
  repaired:number;
  blocked:number;
  rows:RoutingV2MappingRepairRow[];
}

const now=()=>new Date().toISOString();

export const routingV2CapabilityMappingRepairService={
  async repair():Promise<RoutingV2MappingRepairResult>{
    const checkedAt=now();
    const [routes,models]=await Promise.all([routingV2Repository.listRoutes(),routingV2Repository.listModels()]);
    const modelById=new Map(models.map(model=>[model.model_id,model]));
    const routeById=new Map(routes.map(route=>[route.route_id,route]));
    const rows:RoutingV2MappingRepairRow[]=[];

    for(const route of routes){
      if(route.status==='DISABLED'||route.mapping_repair_note)continue;
      const mismatch=identifierCapabilityMismatch(route.provider_model_identifier,route.capability_id);
      if(!mismatch)continue;
      const suggested=suggestedCapabilityForMismatch(route.provider_model_identifier,route.capability_id);
      const model=modelById.get(route.model_id);
      if(!suggested||!isOfficialRoutingV2Provider(route.provider_id)||model?.category!=='IMAGE')continue;

      const replacementId=routingV2RouteId(route.model_id,suggested as CapabilityId,route.provider_id,route.provider_model_identifier);
      const existing=routeById.get(replacementId)||await routingV2Repository.getRoute(replacementId);
      const label=`Identifier ${route.provider_model_identifier} representa ${suggested}, mas estava classificado como ${route.capability_id}.`;
      if(existing?.status==='DISABLED'){
        const message=`Correção automática bloqueada: já existe a rota correta ${replacementId}, mas ela está DISABLED. ${label}`;
        await routingV2Repository.saveRoute({...route,mapping_repair_note:message,updated_at:checkedAt});
        rows.push({route_id:route.route_id,replacement_route_id:replacementId,model_id:route.model_id,capability_id:route.capability_id,suggested_capability_id:suggested,provider_id:route.provider_id,provider_model_identifier:route.provider_model_identifier,result:'BLOCKED',message});
        continue;
      }

      let updatedModel=model!;
      if(!updatedModel.capabilities.includes(suggested as CapabilityId)){
        updatedModel={...updatedModel,capabilities:Array.from(new Set([...updatedModel.capabilities,suggested as CapabilityId])),updated_at:checkedAt};
        await routingV2Repository.saveModel(updatedModel);
        modelById.set(updatedModel.model_id,updatedModel);
      }

      let replacement=existing;
      if(!replacement){
        const message=`Rota criada com a capability correta ${suggested}. Origem auditável: ${route.route_id}. ${label}`;
        replacement={
          ...route,
          route_id:replacementId,
          capability_id:suggested as CapabilityId,
          status:'MAPPED',
          pricing_status:'UNKNOWN',
          runtime_status:'UNKNOWN',
          pricing_snapshot:null,
          mapping_repair_note:message,
          last_price_sync_at:null,
          last_runtime_check_at:null,
          created_at:checkedAt,
          updated_at:checkedAt,
        };
        await routingV2Repository.saveRoute(replacement);
        routeById.set(replacementId,replacement);
      }

      const message=`Arquivada após correção de capability. Substituta: ${replacementId}. ${label}`;
      await routingV2Repository.saveRoute({...route,status:'DISABLED',pricing_status:'INVALID',mapping_repair_note:message,updated_at:checkedAt});
      routeById.set(route.route_id,{...route,status:'DISABLED',pricing_status:'INVALID',mapping_repair_note:message,updated_at:checkedAt});
      rows.push({route_id:route.route_id,replacement_route_id:replacementId,model_id:route.model_id,capability_id:route.capability_id,suggested_capability_id:suggested,provider_id:route.provider_id,provider_model_identifier:route.provider_model_identifier,result:'REPAIRED',message});
    }

    return{checked_at:checkedAt,examined:rows.length,repaired:rows.filter(row=>row.result==='REPAIRED').length,blocked:rows.filter(row=>row.result==='BLOCKED').length,rows};
  },
};
