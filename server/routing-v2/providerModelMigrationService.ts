import { CapabilityId } from '../beta/capabilityRegistry.js';
import { RoutingV2BillingConfig, RoutingV2ProviderRoute, routingV2RouteId } from './domain.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { routingV2Repository } from './repository.js';

const OLD_GEMINI_OMNI_FLASH='google:gemini@omni-flash';
const GEMINI_OMNI_FLASH_11='google:gemini@omni-flash-1.1';
const GEMINI_OMNI_FLASH_DOCS='https://runware.ai/docs/models/google-gemini-omni-flash-1-1';
const GEMINI_CAPABILITIES=new Set<CapabilityId>(['image-to-video','text-to-video']);
const now=()=>new Date().toISOString();

export interface RoutingV2ProviderModelMigrationRow{
  route_id:string;
  replacement_route_id?:string|null;
  model_id:string;
  capability_id:string;
  provider_id:string;
  previous_identifier:string;
  replacement_identifier:string;
  result:'MIGRATED'|'BLOCKED';
  message:string;
}

export interface RoutingV2ProviderModelMigrationResult{
  checked_at:string;
  examined:number;
  migrated:number;
  blocked:number;
  rows:RoutingV2ProviderModelMigrationRow[];
}

function pendingRunwareBilling(identifier:string,capabilityId:string):RoutingV2BillingConfig{
  return{
    type:'CUSTOM_FORMULA',currency:'USD',formula_id:'runware-catalog-pricing-v1',
    parameters:{provider_model_identifier:identifier,capability_id:capabilityId,pricing_rates_json:'[]',default_resolution:'720p',default_duration_seconds:5},
  };
}

function annotate(route:RoutingV2ProviderRoute,message:string,checkedAt:string){
  return routingV2Repository.saveRoute({...route,last_sync_error:message,last_sync_error_at:checkedAt,updated_at:checkedAt});
}

export const routingV2ProviderModelMigrationService={
  async migrateDeprecatedRunwareModels():Promise<RoutingV2ProviderModelMigrationResult>{
    const checkedAt=now();
    const[routes,models,providers]=await Promise.all([
      routingV2Repository.listRoutes(),routingV2Repository.listModels(),routingV2Repository.listProviders(),
    ]);
    const modelById=new Map(models.map(model=>[model.model_id,model]));
    const providerById=new Map(providers.map(provider=>[provider.provider_id,provider]));
    const routeById=new Map(routes.map(route=>[route.route_id,route]));
    const rows:RoutingV2ProviderModelMigrationRow[]=[];

    for(const route of routes){
      if(route.status==='DISABLED'||route.provider_id!=='provider-runware'||route.provider_model_identifier!==OLD_GEMINI_OMNI_FLASH||!GEMINI_CAPABILITIES.has(route.capability_id))continue;
      const model=modelById.get(route.model_id);
      const provider=providerById.get(route.provider_id);
      const replacementRouteId=routingV2RouteId(route.model_id,route.capability_id,route.provider_id,GEMINI_OMNI_FLASH_11);
      const existing=routeById.get(replacementRouteId)||await routingV2Repository.getRoute(replacementRouteId);
      let blockedMessage='';
      if(!model||model.status!=='ACTIVE'||!model.capabilities.includes(route.capability_id))blockedMessage='Migração bloqueada: model/capability não está ativo no inventário.';
      else if(!provider||provider.status==='DISABLED'||!isOfficialRoutingV2Provider(provider.provider_id))blockedMessage='Migração bloqueada: Runware não está cadastrado como provider oficial ativo.';
      else if(existing?.status==='DISABLED')blockedMessage=`Migração bloqueada: a rota substituta ${replacementRouteId} já existe desativada.`;

      if(blockedMessage){
        await annotate(route,blockedMessage,checkedAt);
        rows.push({route_id:route.route_id,replacement_route_id:replacementRouteId,model_id:route.model_id,capability_id:route.capability_id,provider_id:route.provider_id,previous_identifier:route.provider_model_identifier,replacement_identifier:GEMINI_OMNI_FLASH_11,result:'BLOCKED',message:blockedMessage});
        continue;
      }

      const migrationNote=`Identificador Runware migrado de ${OLD_GEMINI_OMNI_FLASH} para ${GEMINI_OMNI_FLASH_11}; depreciação anunciada em ${GEMINI_OMNI_FLASH_DOCS}. A nova rota exige nova validação de preço e runtime antes de ficar READY.`;
      if(!existing){
        const replacement:RoutingV2ProviderRoute={
          ...route,
          route_id:replacementRouteId,
          provider_model_identifier:GEMINI_OMNI_FLASH_11,
          mapping_source:'PROVIDER_DOCS',
          mapping_source_reference:GEMINI_OMNI_FLASH_DOCS,
          mapping_verified_at:checkedAt,
          status:'MAPPED',
          pricing_status:'UNKNOWN',
          runtime_status:'UNKNOWN',
          billing_type:'CUSTOM_FORMULA',
          billing_config:pendingRunwareBilling(GEMINI_OMNI_FLASH_11,route.capability_id),
          pricing_snapshot:null,
          last_price_sync_at:null,
          last_runtime_check_at:null,
          last_sync_error:null,
          last_sync_error_at:null,
          last_runtime_error:null,
          last_runtime_error_at:null,
          provider_migration_note:migrationNote,
          created_at:checkedAt,
          updated_at:checkedAt,
        };
        await routingV2Repository.saveRoute(replacement);
        routeById.set(replacementRouteId,replacement);
      }

      const failureMessage=route.last_sync_error||'Modelo não encontrado no catálogo público atual do Runware (HTTP 404).';
      const archivedNote=`Rota arquivada por depreciação do identificador ${OLD_GEMINI_OMNI_FLASH}. Falha observada: ${failureMessage} Substituta: ${replacementRouteId}. ${migrationNote}`;
      const archived={...route,status:'DISABLED' as const,pricing_status:'INVALID' as const,last_sync_error:failureMessage,last_sync_error_at:route.last_sync_error_at||checkedAt,provider_migration_note:archivedNote,updated_at:checkedAt};
      await routingV2Repository.saveRoute(archived);
      routeById.set(route.route_id,archived);
      rows.push({route_id:route.route_id,replacement_route_id:replacementRouteId,model_id:route.model_id,capability_id:route.capability_id,provider_id:route.provider_id,previous_identifier:route.provider_model_identifier,replacement_identifier:GEMINI_OMNI_FLASH_11,result:'MIGRATED',message:migrationNote});
    }

    return{checked_at:checkedAt,examined:rows.length,migrated:rows.filter(row=>row.result==='MIGRATED').length,blocked:rows.filter(row=>row.result==='BLOCKED').length,rows};
  },
};
