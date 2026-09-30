import { resolveRoutingV2ProviderAdapter } from './adapterResolver.js';
import { calculateRoutingV2ProviderCost } from './billingEngine.js';
import { calculateRoutingV2Economics } from './economicsEngine.js';
import { RoutingV2BillingConfig, RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { routingV2PricingSettingsService } from './pricingSettingsService.js';
import { reconcileRoutingV2Route } from './routeReconciler.js';
import { routingV2Repository } from './repository.js';
import { getUsdBrlRate } from './fxRateService.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { routingV2CapabilityMappingRepairService, RoutingV2MappingRepairRow } from './capabilityMappingRepairService.js';
import { assertIdentifierMatchesCapability } from './capabilityMappingValidation.js';
import { routingV2ProviderModelMigrationService, RoutingV2ProviderModelMigrationResult } from './providerModelMigrationService.js';
import { checkProviderHealth } from './healthAdapter.js';
import { canReuseRoutingV2PriceAfterTransientFailure, hasFreshRoutingV2ProviderHealth, shouldReuseRoutingV2PriceSnapshot, shouldSkipRoutingV2PriceRefresh } from './priceSyncPolicy.js';

export interface RoutingV2PriceSyncRow{
  route_id:string;
  model_id:string;
  capability_id:string;
  provider_model_identifier:string;
  provider_id:string;
  ok:boolean;
  status:string;
  pricing_status:string;
  runtime_status:string;
  retail_price_credits:number|null;
  error?:string|null;
}

export interface RoutingV2PriceSyncResult{
  checked_at:string;
  cursor:number;
  next_cursor:number|null;
  done:boolean;
  total_routes:number;
  processed:number;
  updated:number;
  failed:number;
  mapping_repairs?:{examined:number;repaired:number;blocked:number;rows:RoutingV2MappingRepairRow[]}|null;
  provider_migrations?:RoutingV2ProviderModelMigrationResult|null;
  rows:RoutingV2PriceSyncRow[];
}

type PendingRoutingV2PriceSyncRow=Omit<RoutingV2PriceSyncRow,'model_id'|'capability_id'|'provider_model_identifier'>;

function referenceInput(config:RoutingV2BillingConfig){
  if(config.type==='PER_OUTPUT')return{number_of_outputs:1};
  if(config.type==='PER_SECOND')return{duration_seconds:1};
  if(config.type==='PER_MINUTE')return{duration_seconds:60};
  if(config.type==='PER_CHARACTER')return{character_count:config.characters_per_unit};
  if(config.type==='FIXED_MATRIX')return{dimensions:config.entries[0]?.match||{}};
  if(config.type==='CUSTOM_FORMULA'&&config.formula_id==='runware-catalog-pricing-v1'){
    return{
      duration_seconds:Number(config.parameters?.default_duration_seconds||1),
      number_of_outputs:1,
      dimensions:{
        resolution:String(config.parameters?.default_resolution||'1K'),
        image_reference_count:Number(config.parameters?.default_image_reference_count||0),
        video_reference_count:Number(config.parameters?.default_video_reference_count||0),
      },
    };
  }
  return{};
}

async function providerRuntime(provider:RoutingV2Provider,checkedAt:string,healthFreshnessMinutes:number){
  if(!isOfficialRoutingV2Provider(provider.provider_id))return{adapter:null,runtime_status:'UNAVAILABLE' as const};
  const adapter=resolveRoutingV2ProviderAdapter(provider);
  if(!adapter||!adapter.isConfigured(provider))return{adapter:null,runtime_status:'UNAVAILABLE' as const};
  try{
    const healthIsFresh=hasFreshRoutingV2ProviderHealth(provider,checkedAt,healthFreshnessMinutes);
    const health=healthIsFresh
      ?{status:provider.health_status,checked_at:provider.last_health_check_at||checkedAt}
      :await checkProviderHealth(provider);
    return{adapter,runtime_status:health.status,health};
  }catch{
    return{adapter,runtime_status:'UNAVAILABLE' as const};
  }
}

export function assertOperationalRouteSupported(
  adapter:NonNullable<Awaited<ReturnType<typeof providerRuntime>>['adapter']>,
  provider:RoutingV2Provider,
  route:RoutingV2ProviderRoute,
){
  if(!adapter.supportsRoute)return;
  if(adapter.supportsRoute(provider,route.model_id,route.capability_id as CapabilityId,route.provider_model_identifier))return;
  throw Object.assign(new Error(`Rota incompatível: ${provider.name} não aceita ${route.capability_id} para ${route.provider_model_identifier}.`),{
    code:'ROUTING_V2_PROVIDER_ROUTE_UNSUPPORTED',
  });
}

export const routingV2PriceSyncService={
  async runBatch(input:{cursor?:number;limit?:number;fx_rate_usd_brl?:number}={}):Promise<RoutingV2PriceSyncResult>{
    const checkedAt=new Date().toISOString();
    const cursor=Math.max(0,Math.floor(Number(input.cursor)||0));
    const limit=Math.min(10,Math.max(1,Math.floor(Number(input.limit)||5)));
    const providerMigrations=cursor===0?await routingV2ProviderModelMigrationService.migrateDeprecatedRunwareModels():null;
    const mappingRepairs=cursor===0?await routingV2CapabilityMappingRepairService.repair():null;
    const[routes,models,settings]=await Promise.all([
      routingV2Repository.listRoutes(),
      routingV2Repository.listModels(),
      routingV2PricingSettingsService.get(),
    ]);
    const fxRate=Number.isFinite(Number(input.fx_rate_usd_brl))&&Number(input.fx_rate_usd_brl)>0?Number(input.fx_rate_usd_brl):await getUsdBrlRate();
    const activeModels=new Set(models.filter(model=>model.status==='ACTIVE').map(model=>model.model_id));
    const eligible=routes.filter(route=>route.status!=='DISABLED'&&activeModels.has(route.model_id)).sort((a,b)=>a.route_id.localeCompare(b.route_id));
    const batch=eligible.slice(cursor,cursor+limit);
    const providerCache=new Map<string,RoutingV2Provider|null>();
    const runtimeCache=new Map<string,Awaited<ReturnType<typeof providerRuntime>>>();
    const rows:PendingRoutingV2PriceSyncRow[]=[];

    for(const route of batch){
      try{
        assertIdentifierMatchesCapability(route.provider_model_identifier,route.capability_id);
        let provider=providerCache.get(route.provider_id);
        if(provider===undefined){
          provider=await routingV2Repository.getProvider(route.provider_id);
          providerCache.set(route.provider_id,provider);
        }
        if(!provider){
          const next=reconcileRoutingV2Route({route,provider:null,pricing_status:'INVALID',runtime_status:'UNAVAILABLE',now:checkedAt});
          await routingV2Repository.saveRoute(next);
          rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:false,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:null,error:'Provider V2 não encontrado.'});
          continue;
        }
        if(provider.status==='DISABLED'){
          const next=reconcileRoutingV2Route({route,provider,now:checkedAt});
          await routingV2Repository.saveRoute(next);
          rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:false,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:next.pricing_snapshot?.retail_price_credits||null,error:'Provider V2 desativado.'});
          continue;
        }

        let runtime=runtimeCache.get(provider.provider_id);
        if(!runtime){
          runtime=await providerRuntime(provider,checkedAt,settings.price_sync_interval_minutes);
          runtimeCache.set(provider.provider_id,runtime);
          const health=runtime.health;
          const nextProvider:RoutingV2Provider={...provider,health_status:runtime.runtime_status,last_health_check_at:health?.checked_at||checkedAt,updated_at:checkedAt};
          const balanceCheckedAt=Date.parse(provider.balance_updated_at||'');
          const balanceAge=Date.parse(checkedAt)-balanceCheckedAt;
          const balanceIsFresh=Number.isFinite(balanceCheckedAt)&&Number.isFinite(balanceAge)&&balanceAge>=0&&balanceAge<Math.max(1,settings.price_sync_interval_minutes)*60_000;
          if(runtime.runtime_status==='HEALTHY'&&runtime.adapter?.balance&&!balanceIsFresh){
            try{
              const balance=await runtime.adapter.balance(provider);
              nextProvider.balance_amount=balance.amount;
              nextProvider.balance_currency=balance.currency;
              nextProvider.balance_updated_at=balance.checked_at;
            }catch{}
          }
          provider=await routingV2Repository.saveProvider(nextProvider);
          providerCache.set(provider.provider_id,provider);
        }

        const adapter=runtime.adapter;
        if(!adapter?.getPrice){
          const next=reconcileRoutingV2Route({route,provider,pricing_status:'INVALID',runtime_status:runtime.runtime_status,now:checkedAt});
          await routingV2Repository.saveRoute(next);
          rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:false,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:null,error:'Adapter V2 não oferece sincronização de preço.'});
          continue;
        }

        assertOperationalRouteSupported(adapter,provider,route);

        if(shouldReuseRoutingV2PriceSnapshot(route,checkedAt,settings.price_sync_interval_minutes)){
          const retained=reconcileRoutingV2Route({
            route:{...route,runtime_status:runtime.runtime_status,last_runtime_check_at:checkedAt,
              last_runtime_error:runtime.runtime_status==='HEALTHY'?null:(runtime.health?.message||`Runtime do provider ${runtime.runtime_status}; rota mantida fora de READY.`),
              last_runtime_error_at:checkedAt,updated_at:checkedAt},
            provider,pricing_status:route.pricing_status==='INVALID'?'CURRENT':route.pricing_status,runtime_status:runtime.runtime_status,now:checkedAt,
          });
          await routingV2Repository.saveRoute(retained);
          rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:!route.last_sync_error,status:retained.status,pricing_status:retained.pricing_status,runtime_status:retained.runtime_status,retail_price_credits:retained.pricing_snapshot?.retail_price_credits||null,error:route.last_sync_error||null});
          continue;
        }

        if(shouldSkipRoutingV2PriceRefresh(route,checkedAt,settings.price_sync_interval_minutes)){
          const retained=reconcileRoutingV2Route({
            route:{...route,runtime_status:runtime.runtime_status,last_runtime_check_at:checkedAt,
              last_runtime_error:runtime.runtime_status==='HEALTHY'?null:(runtime.health?.message||`Runtime do provider ${runtime.runtime_status}; rota mantida fora de READY.`),
              last_runtime_error_at:checkedAt,updated_at:checkedAt},
            provider,pricing_status:'CURRENT',runtime_status:runtime.runtime_status,now:checkedAt,
          });
          await routingV2Repository.saveRoute(retained);
          rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:true,status:retained.status,pricing_status:retained.pricing_status,runtime_status:retained.runtime_status,retail_price_credits:retained.pricing_snapshot?.retail_price_credits||null});
          continue;
        }

        const price=await adapter.getPrice(provider,route.provider_model_identifier,route.capability_id);
        if(!price.source_reference?.trim())throw new Error('Provider não retornou source_reference verificável para pricing.');
        if(route.provider_id==='provider-runware'&&route.pricing_status!=='CURRENT'&&!route.pricing_snapshot){
          route.billing_type=price.billing_config.type;
          route.billing_config=price.billing_config;
        }
        if(price.billing_config.type!==route.billing_type)throw new Error(`Billing type divergente: route=${route.billing_type}, provider=${price.billing_config.type}.`);

        const reference=calculateRoutingV2ProviderCost(price.billing_config,referenceInput(price.billing_config));
        const economics=calculateRoutingV2Economics({
          provider_cost:reference.amount,
          provider_currency:reference.currency,
          fx_rate_usd_brl:fxRate,
          settings,
        });
        const fetchedAt=price.fetched_at||checkedAt;
        const validUntil=new Date(Date.parse(fetchedAt)+settings.price_freshness_ttl_minutes*60_000).toISOString();
        const priced:RoutingV2ProviderRoute={
          ...route,
          billing_config:price.billing_config,
          billing_type:price.billing_config.type,
          pricing_status:'CURRENT',
          runtime_status:runtime.runtime_status,
          pricing_snapshot:{
            billing_config:price.billing_config,
            source:price.source,
            source_reference:price.source_reference||null,
            provider_cost_reference:reference.amount,
            safe_cogs_brl:economics.safe_cogs_brl,
            retail_price_credits:economics.retail_credits,
            expected_margin_percent:economics.expected_margin_percent,
            fx_rate_usd_brl:reference.currency==='USD'?fxRate:null,
            fetched_at:fetchedAt,
            valid_until:validUntil,
          },
          last_price_sync_at:checkedAt,
          last_runtime_check_at:checkedAt,
          last_sync_error:null,
          last_sync_error_at:null,
          last_runtime_error:runtime.runtime_status==='HEALTHY'?null:(runtime.health?.message||`Runtime do provider ${runtime.runtime_status}; rota mantida fora de READY.`),
          last_runtime_error_at:checkedAt,
          updated_at:checkedAt,
        };
        const next=reconcileRoutingV2Route({route:priced,provider,now:checkedAt});
        await routingV2Repository.saveRoute(next);
        rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:true,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:next.pricing_snapshot?.retail_price_credits||null});
      }catch(err:any){
        const provider=providerCache.get(route.provider_id)||null;
        const runtimeStatus=runtimeCache.get(route.provider_id)?.runtime_status||provider?.health_status||route.runtime_status;
        const errorMessage=String(err?.message||err);
        const runtimeMessage=runtimeCache.get(route.provider_id)?.health?.message;
        const keepFreshPrice=canReuseRoutingV2PriceAfterTransientFailure(route,checkedAt,errorMessage);
        const pricingStatus=keepFreshPrice?'CURRENT':'INVALID';
        const next=reconcileRoutingV2Route({route,provider,pricing_status:pricingStatus,runtime_status:runtimeStatus,now:checkedAt});
        await routingV2Repository.saveRoute({...next,last_sync_error:errorMessage,last_sync_error_at:checkedAt,last_runtime_error:runtimeStatus==='HEALTHY'?null:(runtimeMessage||`Runtime do provider ${runtimeStatus}; rota mantida fora de READY.`),last_runtime_error_at:checkedAt}).catch(()=>{});
        rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:false,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:next.pricing_snapshot?.retail_price_credits||null,error:errorMessage});
      }
    }

    const nextCursor=cursor+batch.length<eligible.length?cursor+batch.length:null;
    const routesById=new Map(eligible.map(route=>[route.route_id,route]));
    return{
      checked_at:checkedAt,
      cursor,
      next_cursor:nextCursor,
      done:nextCursor===null,
      total_routes:eligible.length,
      processed:rows.length,
      updated:rows.filter(row=>row.ok).length,
      failed:rows.filter(row=>!row.ok).length,
      mapping_repairs:mappingRepairs?{examined:mappingRepairs.examined,repaired:mappingRepairs.repaired,blocked:mappingRepairs.blocked,rows:mappingRepairs.rows}:null,
      provider_migrations:providerMigrations,
      rows:rows.map(row=>{
        const route=routesById.get(row.route_id);
        return{
          ...row,
          model_id:route?.model_id||'',
          capability_id:route?.capability_id||'',
          provider_model_identifier:route?.provider_model_identifier||'',
        };
      }),
    };
  },
};
