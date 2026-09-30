import { CapabilityId } from '../beta/capabilityRegistry.js';
import { RoutingV2BillingConfig, RoutingV2ProviderRoute, routingV2RouteId } from './domain.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { routingV2Repository } from './repository.js';
import { resolveRoutingV2ProviderAdapter } from './adapterResolver.js';
import { routingV2RouteService } from './routeService.js';

const OLD_GEMINI_OMNI_FLASH='google:gemini@omni-flash';
const GEMINI_OMNI_FLASH_11='google:gemini@omni-flash-1.1';
const GEMINI_OMNI_FLASH_DOCS='https://runware.ai/docs/models/google-gemini-omni-flash-1-1';
const GEMINI_CAPABILITIES=new Set<CapabilityId>(['image-to-video','text-to-video']);
const ATLAS_GPT_IMAGE_2_MODEL='gpt-image-2';
const ATLAS_GPT_IMAGE_2_CAPABILITY:CapabilityId='text-to-image';
const ATLAS_GPT_IMAGE_2_OLD='openai/gpt-image-2';
const ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE='openai/gpt-image-2/text-to-image';
const ATLAS_GPT_IMAGE_2_DOCS='https://www.atlascloud.ai/models/openai/gpt-image-2/text-to-image';
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

    const atlasModel=modelById.get(ATLAS_GPT_IMAGE_2_MODEL);
    const atlasProvider=providerById.get('provider-atlas');
    const atlasOldRoutes=routes.filter(route=>route.model_id===ATLAS_GPT_IMAGE_2_MODEL&&route.capability_id===ATLAS_GPT_IMAGE_2_CAPABILITY&&route.provider_id==='provider-atlas'&&route.provider_model_identifier===ATLAS_GPT_IMAGE_2_OLD);
    const atlasReplacementRouteId=routingV2RouteId(ATLAS_GPT_IMAGE_2_MODEL,ATLAS_GPT_IMAGE_2_CAPABILITY,'provider-atlas',ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE);
    let atlasReplacement=routeById.get(atlasReplacementRouteId)||await routingV2Repository.getRoute(atlasReplacementRouteId);
    let atlasMigrationAllowed=true;
    let createdAtlasReplacement=false;
    const shouldEnsureAtlasRoute=Boolean(atlasModel&&atlasModel.status==='ACTIVE'&&atlasModel.capabilities.includes(ATLAS_GPT_IMAGE_2_CAPABILITY));
    if(shouldEnsureAtlasRoute){
      const blocked=async(message:string)=>{
        atlasMigrationAllowed=false;
        for(const route of atlasOldRoutes){
          if(route.status!=='DISABLED')await routingV2Repository.saveRoute({
            ...route,status:'DEGRADED',pricing_status:'INVALID',last_sync_error:message,last_sync_error_at:checkedAt,updated_at:checkedAt,
          });
          rows.push({route_id:route.route_id,replacement_route_id:atlasReplacementRouteId,model_id:route.model_id,capability_id:route.capability_id,provider_id:route.provider_id,previous_identifier:route.provider_model_identifier,replacement_identifier:ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE,result:'BLOCKED',message});
        }
        if(!atlasOldRoutes.length)rows.push({route_id:atlasReplacementRouteId,replacement_route_id:atlasReplacementRouteId,model_id:ATLAS_GPT_IMAGE_2_MODEL,capability_id:ATLAS_GPT_IMAGE_2_CAPABILITY,provider_id:'provider-atlas',previous_identifier:'',replacement_identifier:ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE,result:'BLOCKED',message});
      };

      if(!atlasProvider||!isOfficialRoutingV2Provider('provider-atlas')||atlasProvider.status==='DISABLED'){
        await blocked('Migração bloqueada: Atlas não está ativo como provider oficial.');
      }else if(atlasReplacement?.status==='DISABLED'){
        await blocked(`Migração bloqueada: a rota Atlas substituta ${atlasReplacementRouteId} já está desativada.`);
      }else if(!atlasReplacement&&atlasOldRoutes.some(route=>route.status==='DISABLED')){
        await blocked('Migração bloqueada: a rota Atlas anterior foi desativada; nenhuma rota substituta será reativada automaticamente.');
      }else if(!atlasReplacement){
        try{
          const adapter=resolveRoutingV2ProviderAdapter(atlasProvider!);
          if(!adapter?.listModels||!adapter.isConfigured(atlasProvider!))throw new Error('Atlas não está configurado para validar o catálogo oficial.');
          const catalog=await adapter.listModels(atlasProvider!);
          if(!catalog.some(model=>model.provider_model_identifier===ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE))throw new Error('Atlas não publicou o endpoint oficial GPT Image 2 Text-to-Image no catálogo autenticado.');
          const created=await routingV2RouteService.create({
            model_id:ATLAS_GPT_IMAGE_2_MODEL,
            capability_id:ATLAS_GPT_IMAGE_2_CAPABILITY,
            provider_id:'provider-atlas',
            provider_model_identifier:ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE,
            mapping_source:'PROVIDER_DOCS',
            mapping_source_reference:ATLAS_GPT_IMAGE_2_DOCS,
            mapping_verified_at:checkedAt,
            billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:0},
            priority:atlasOldRoutes[0]?.priority||atlasProvider!.priority,
          });
          atlasReplacement=created;
          createdAtlasReplacement=true;
          routeById.set(created.route_id,created);
          routes.push(created);
        }catch(error:any){
          await blocked(`Migração Atlas não concluída: ${String(error?.message||error)}`);
        }
      }

      if(atlasMigrationAllowed&&atlasReplacement&&atlasReplacement.status!=='DISABLED'){
        const note=`Endpoint Atlas corrigido de ${ATLAS_GPT_IMAGE_2_OLD} para ${ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE}, conforme catálogo e documentação oficiais. A substituta requer sincronização de preço antes de ficar READY.`;
        for(const route of atlasOldRoutes){
          if(route.status==='DISABLED')continue;
          const archived={...route,status:'DISABLED' as const,pricing_status:'INVALID' as const,last_sync_error:`Rota substituída por endpoint Atlas documentado: ${ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE}.`,last_sync_error_at:checkedAt,provider_migration_note:`Rota arquivada por mapping Atlas incorreto. ${note}`,updated_at:checkedAt};
          await routingV2Repository.saveRoute(archived);
          routeById.set(route.route_id,archived);
          rows.push({route_id:route.route_id,replacement_route_id:atlasReplacement.route_id,model_id:route.model_id,capability_id:route.capability_id,provider_id:route.provider_id,previous_identifier:route.provider_model_identifier,replacement_identifier:ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE,result:'MIGRATED',message:note});
        }
        if(createdAtlasReplacement&&!atlasOldRoutes.length){
          rows.push({route_id:atlasReplacement.route_id,replacement_route_id:atlasReplacement.route_id,model_id:ATLAS_GPT_IMAGE_2_MODEL,capability_id:ATLAS_GPT_IMAGE_2_CAPABILITY,provider_id:'provider-atlas',previous_identifier:'',replacement_identifier:ATLAS_GPT_IMAGE_2_TEXT_TO_IMAGE,result:'MIGRATED',message:`Rota Atlas GPT Image 2 Text-to-Image criada com identifier confirmado no catálogo oficial. ${note}`});
        }
      }
    }

    return{checked_at:checkedAt,examined:rows.length,migrated:rows.filter(row=>row.result==='MIGRATED').length,blocked:rows.filter(row=>row.result==='BLOCKED').length,rows};
  },
};
