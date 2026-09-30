import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const mocks=vi.hoisted(()=>(
  {routes:[] as RoutingV2ProviderRoute[],listRoutes:vi.fn(),getProvider:vi.fn(),saveProvider:vi.fn(),saveRoute:vi.fn(),checkProviderHealth:vi.fn()}
));
vi.mock('./repository.js',()=>({routingV2Repository:{listRoutes:mocks.listRoutes,getProvider:mocks.getProvider,saveProvider:mocks.saveProvider,saveRoute:mocks.saveRoute}}));
vi.mock('./healthAdapter.js',()=>({checkProviderHealth:mocks.checkProviderHealth}));

const checkedAt='2026-09-29T12:00:00.000Z';
const provider:RoutingV2Provider={provider_id:'provider-runware',name:'Runware',slug:'runware',type:'AGGREGATOR',status:'ACTIVE',priority:95,adapter_id:'wrapper:provider-runware',supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,health_status:'HEALTHY',last_health_check_at:checkedAt,created_at:checkedAt,updated_at:checkedAt};
const route=():RoutingV2ProviderRoute=>({
  route_id:'route-ready',model_id:'model-video',capability_id:'text-to-video',provider_id:'provider-runware',provider_model_identifier:'example/video',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:checkedAt,
  status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
  pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_DOCS',source_reference:'https://example.test/price',provider_cost_reference:0.1,safe_cogs_brl:0.5,retail_price_credits:50,expected_margin_percent:55,fetched_at:checkedAt,valid_until:new Date(Date.now()+60_000).toISOString()},
  priority:100,created_at:checkedAt,updated_at:checkedAt,last_runtime_error:'Old runtime error',last_runtime_error_at:checkedAt,
});

describe('Routing V2 provider health propagation',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getProvider.mockResolvedValue(provider);
    mocks.routes=[route()];
    mocks.listRoutes.mockImplementation(async()=>mocks.routes);
    mocks.saveProvider.mockImplementation(async(value:RoutingV2Provider)=>value);
    mocks.saveRoute.mockImplementation(async(value:RoutingV2ProviderRoute)=>{mocks.routes=mocks.routes.map(row=>row.route_id===value.route_id?value:row);return value;});
  });

  it('takes provider routes out of READY and saves the live runtime failure',async()=>{
    mocks.checkProviderHealth.mockResolvedValue({status:'UNAVAILABLE',checked_at:checkedAt,message:'Runware API Key inválida ou expirada'});
    const {providerHealthService}=await import('./providerHealthService.js');
    const result=await providerHealthService.checkAndPersist(provider);
    expect(result).toMatchObject({health_status:'UNAVAILABLE',message:'Runware API Key inválida ou expirada'});
    expect(mocks.routes[0]).toMatchObject({status:'DEGRADED',runtime_status:'UNAVAILABLE',last_runtime_error:'Runware API Key inválida ou expirada',last_runtime_check_at:checkedAt});
  });

  it('restores READY only when a healthy probe and fresh verified price both exist',async()=>{
    mocks.checkProviderHealth.mockResolvedValue({status:'HEALTHY',checked_at:checkedAt});
    const {providerHealthService}=await import('./providerHealthService.js');
    await providerHealthService.checkAndPersist(provider);
    expect(mocks.routes[0]).toMatchObject({status:'READY',runtime_status:'HEALTHY',last_runtime_error:null});
  });

  it('reads the last provider health without issuing a live probe',async()=>{
    const {providerHealthService}=await import('./providerHealthService.js');
    const result=await providerHealthService.getLastHealth(provider.provider_id);

    expect(result).toEqual({provider_id:provider.provider_id,provider_name:provider.name,status:provider.health_status,checked_at:checkedAt});
    expect(mocks.checkProviderHealth).not.toHaveBeenCalled();
  });
});
