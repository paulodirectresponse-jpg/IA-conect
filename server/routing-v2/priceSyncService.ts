import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { calculateRoutingV2ProviderCost } from './billingEngine.js';
import { calculateRoutingV2Economics } from './economicsEngine.js';
import { RoutingV2BillingConfig, RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';
import { routingV2PricingSettingsService } from './pricingSettingsService.js';
import { reconcileRoutingV2Route } from './routeReconciler.js';
import { routingV2Repository } from './repository.js';
import { providerHealthService } from './providerHealthService.js';

export interface RoutingV2PriceSyncRow{
  route_id:string;
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
  rows:RoutingV2PriceSyncRow[];
}

function referenceInput(config:RoutingV2BillingConfig){
  if(config.type==='PER_OUTPUT')return{number_of_outputs:1};
  if(config.type==='PER_SECOND')return{duration_seconds:1};
  if(config.type==='PER_MINUTE')return{duration_seconds:60};
  if(config.type==='PER_CHARACTER')return{character_count:config.characters_per_unit};
  if(config.type==='FIXED_MATRIX')return{dimensions:config.entries[0]?.match||{}};
  return{};
}

async function providerRuntime(provider:RoutingV2Provider){
  const adapter=routingV2AdapterRegistry.get(provider.adapter_id);
  if(!adapter||!adapter.isConfigured(provider))return{adapter:null,runtime_status:'UNAVAILABLE' as const};
  try{
    // Use new health service with persistence, fallback to adapter health if needed
    const healthResult=await providerHealthService.checkAndPersist(provider);
    const health={status:healthResult.health_status as any,checked_at:healthResult.checked_at,message:healthResult.message};
    return{adapter,runtime_status:health.status,health};
  }catch{
    return{adapter,runtime_status:'UNAVAILABLE' as const};
  }
}

export const routingV2PriceSyncService={
  async runBatch(input:{cursor?:number;limit?:number;fx_rate_usd_brl?:number}={}):Promise<RoutingV2PriceSyncResult>{
    const checkedAt=new Date().toISOString();
    const cursor=Math.max(0,Math.floor(Number(input.cursor)||0));
    const limit=Math.min(10,Math.max(1,Math.floor(Number(input.limit)||5)));
    const[routes,models,settings]=await Promise.all([
      routingV2Repository.listRoutes(),
      routingV2Repository.listModels(),
      routingV2PricingSettingsService.get(),
    ]);
    const activeModels=new Set(models.filter(model=>model.status==='ACTIVE').map(model=>model.model_id));
    const eligible=routes.filter(route=>route.status!=='DISABLED'&&activeModels.has(route.model_id));
    const batch=eligible.slice(cursor,cursor+limit);
    const providerCache=new Map<string,RoutingV2Provider|null>();
    const runtimeCache=new Map<string,Awaited<ReturnType<typeof providerRuntime>>>();
    const rows:RoutingV2PriceSyncRow[]=[];

    for(const route of batch){
      try{
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
          runtime=await providerRuntime(provider);
          runtimeCache.set(provider.provider_id,runtime);
          const health=runtime.health;
          const nextProvider:RoutingV2Provider={...provider,health_status:runtime.runtime_status,last_health_check_at:health?.checked_at||checkedAt,updated_at:checkedAt};
          if(runtime.adapter?.balance){
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

        const price=await adapter.getPrice(provider,route.provider_model_identifier,route.capability_id);
        if(!price.source_reference?.trim())throw new Error('Provider não retornou source_reference verificável para pricing.');
        if(price.billing_config.type!==route.billing_type)throw new Error(`Billing type divergente: route=${route.billing_type}, provider=${price.billing_config.type}.`);

        const reference=calculateRoutingV2ProviderCost(price.billing_config,referenceInput(price.billing_config));
        const economics=calculateRoutingV2Economics({
          provider_cost:reference.amount,
          provider_currency:reference.currency,
          fx_rate_usd_brl:input.fx_rate_usd_brl,
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
            fx_rate_usd_brl:reference.currency==='USD'?Number(input.fx_rate_usd_brl):null,
            fetched_at:fetchedAt,
            valid_until:validUntil,
          },
          last_price_sync_at:checkedAt,
          last_runtime_check_at:checkedAt,
          updated_at:checkedAt,
        };
        const next=reconcileRoutingV2Route({route:priced,provider,now:checkedAt});
        await routingV2Repository.saveRoute(next);
        rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:true,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:next.pricing_snapshot?.retail_price_credits||null});
      }catch(err:any){
        const provider=providerCache.get(route.provider_id)||null;
        const next=reconcileRoutingV2Route({route,provider,pricing_status:'INVALID',runtime_status:route.runtime_status,now:checkedAt});
        await routingV2Repository.saveRoute(next).catch(()=>{});
        rows.push({route_id:route.route_id,provider_id:route.provider_id,ok:false,status:next.status,pricing_status:next.pricing_status,runtime_status:next.runtime_status,retail_price_credits:next.pricing_snapshot?.retail_price_credits||null,error:String(err?.message||err)});
      }
    }

    const nextCursor=cursor+batch.length<eligible.length?cursor+batch.length:null;
    return{
      checked_at:checkedAt,
      cursor,
      next_cursor:nextCursor,
      done:nextCursor===null,
      total_routes:eligible.length,
      processed:rows.length,
      updated:rows.filter(row=>row.ok).length,
      failed:rows.filter(row=>!row.ok).length,
      rows,
    };
  },
};
