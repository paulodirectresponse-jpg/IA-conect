import { CapabilityId, capabilityIdsForModel } from '../beta/capabilityRegistry.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { providerPricingCatalogService, ProviderPricingRule } from '../services/providerPricingCatalogService.js';
import { defaultPricingUnit, pricingCapabilities } from '../services/routePricingProfileService.js';
import { RoutingV2BillingConfig } from './domain.js';
import { routingV2ProviderService } from './providerService.js';
import { routingV2ModelService } from './modelService.js';
import { routingV2RouteService } from './routeService.js';
import { routingV2Repository } from './repository.js';
import { routingV2Candidate } from './routerService.js';

function billingFromRule(rule:ProviderPricingRule|null,capabilityId:string):RoutingV2BillingConfig{
  if(!rule||!rule.verified){
    const unit=defaultPricingUnit(capabilityId);
    if(unit==='OUTPUT')return{type:'PER_OUTPUT',currency:'USD',price_per_output:0};
    if(unit==='SECOND')return{type:'PER_SECOND',currency:'USD',price_per_second:0};
    if(unit==='MINUTE')return{type:'PER_MINUTE',currency:'USD',price_per_minute:0};
    if(unit==='CHARACTER')return{type:'PER_CHARACTER',currency:'USD',price_per_unit:0,characters_per_unit:1000};
    return{type:'PER_GENERATION',currency:'USD',price_per_generation:0};
  }
  const price=Math.max(0,Number(rule.unit_price_usd||0));
  if(rule.unit==='OUTPUT')return{type:'PER_OUTPUT',currency:'USD',price_per_output:price};
  if(rule.unit==='SECOND')return{type:'PER_SECOND',currency:'USD',price_per_second:price};
  if(rule.unit==='MINUTE')return{type:'PER_MINUTE',currency:'USD',price_per_minute:price};
  if(rule.unit==='CHARACTER')return{type:'PER_CHARACTER',currency:'USD',price_per_unit:price*1000,characters_per_unit:1000};
  return{type:'PER_GENERATION',currency:'USD',price_per_generation:price};
}

export interface RoutingV2MigrationReport{
  checked_at:string;
  providers:{created:number;existing:number;skipped:string[]};
  models:{created:number;existing:number;skipped:string[]};
  routes:{created:number;existing:number;with_verified_v1_price:number;pending_price:number;skipped:string[]};
}

export const routingV2MigrationService={
  async audit(){
    const[v1Providers,v1Models,v1Mappings,v2Providers,v2Models,v2Routes]=await Promise.all([
      catalogRepository.listProviders(),catalogRepository.listModels(),catalogRepository.listMappings(),
      routingV2Repository.listProviders(),routingV2Repository.listModels(),routingV2Repository.listRoutes(),
    ]);
    const activeModels=v1Models.filter(model=>model.status!=='INACTIVE');
    const targets=activeModels.flatMap(model=>capabilityIdsForModel(model).map(capability_id=>({model_id:model.model_id,capability_id})));
    const currentTime=new Date().toISOString();
    const ready=new Set(v2Routes.filter(route=>routingV2Candidate(route,currentTime)).map(route=>`${route.model_id}|${route.capability_id}`));
    return{
      checked_at:new Date().toISOString(),
      v1:{providers:v1Providers.length,models:activeModels.length,mappings:v1Mappings.filter(m=>m.status==='ACTIVE').length,model_capabilities:targets.length},
      v2:{providers:v2Providers.length,models:v2Models.length,routes:v2Routes.length,ready_routes:v2Routes.filter(route=>routingV2Candidate(route,currentTime)).length},
      coverage:{
        required_model_capabilities:targets.length,
        ready_model_capabilities:targets.filter(target=>ready.has(`${target.model_id}|${target.capability_id}`)).length,
        missing:targets.filter(target=>!ready.has(`${target.model_id}|${target.capability_id}`)),
      },
    };
  },

  async migrate():Promise<RoutingV2MigrationReport>{
    const report:RoutingV2MigrationReport={
      checked_at:new Date().toISOString(),
      providers:{created:0,existing:0,skipped:[]},
      models:{created:0,existing:0,skipped:[]},
      routes:{created:0,existing:0,with_verified_v1_price:0,pending_price:0,skipped:[]},
    };
    const[v1Providers,v1Models,v1Mappings]=await Promise.all([
      catalogRepository.listProviders(),catalogRepository.listModels(),catalogRepository.listMappings(),
    ]);

    for(const provider of v1Providers){
      try{
        if(await routingV2Repository.getProvider(provider.provider_id)){report.providers.existing++;continue;}
        const adapter=providerRegistry.getAdapter(provider.provider_id);
        if(!adapter){report.providers.skipped.push(`${provider.provider_id}: adapter V1 ausente`);continue;}
        await routingV2ProviderService.create({
          provider_id:provider.provider_id,
          name:provider.name,
          type:'AGGREGATOR',
          adapter_id:`legacy:${provider.provider_id}`,
          priority:Number(provider.priority||100),
        });
        report.providers.created++;
      }catch(error:any){report.providers.skipped.push(`${provider.provider_id}: ${error?.message||error}`);}
    }

    for(const model of v1Models.filter(item=>item.status!=='INACTIVE')){
      try{
        if(await routingV2Repository.getModel(model.model_id)){report.models.existing++;continue;}
        const capabilities=capabilityIdsForModel(model);
        if(!capabilities.length){report.models.skipped.push(`${model.model_id}: sem capability migrável`);continue;}
        await routingV2ModelService.create({
          model_id:model.model_id,
          name:model.name,
          vendor:'Migrated V1',
          category:model.category,
          description:model.description||'',
          capabilities,
          supported_controls:{
            supported_resolutions:model.supported_resolutions||[],
            supported_durations:model.supported_durations||[],
            supported_aspect_ratios:model.supported_aspect_ratios||[],
          },
        });
        report.models.created++;
      }catch(error:any){report.models.skipped.push(`${model.model_id}: ${error?.message||error}`);}
    }

    const modelsById=new Map(v1Models.map(model=>[model.model_id,model]));
    for(const mapping of v1Mappings.filter(item=>item.status==='ACTIVE')){
      const model=modelsById.get(mapping.model_id);
      if(!model||model.status==='INACTIVE')continue;
      const capabilities=pricingCapabilities(model,mapping);
      for(const capabilityId of capabilities){
        try{
          const existing=(await routingV2RouteService.listByModelCapability(model.model_id,capabilityId as CapabilityId))
            .find(route=>route.provider_id===mapping.provider_id&&route.provider_model_identifier===mapping.provider_model_identifier);
          if(existing){report.routes.existing++;continue;}
          const rule=await providerPricingCatalogService.getVerified(mapping.provider_id,mapping.provider_model_identifier,capabilityId);
          await routingV2RouteService.create({
            model_id:model.model_id,
            capability_id:capabilityId as CapabilityId,
            provider_id:mapping.provider_id,
            provider_model_identifier:mapping.provider_model_identifier,
            billing_config:billingFromRule(rule,capabilityId),
            priority:100,
          });
          report.routes.created++;
          if(rule)report.routes.with_verified_v1_price++;else report.routes.pending_price++;
        }catch(error:any){report.routes.skipped.push(`${mapping.model_id}/${capabilityId}/${mapping.provider_id}: ${error?.message||error}`);}
      }
    }
    return report;
  },
};
