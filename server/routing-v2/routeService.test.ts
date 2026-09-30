import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const repositoryMocks=vi.hoisted(()=>(
  {routes:[] as RoutingV2ProviderRoute[],providers:[] as RoutingV2Provider[],listRoutes:vi.fn(),listProviders:vi.fn(),getModel:vi.fn(),getProvider:vi.fn(),saveRoute:vi.fn()}
));
vi.mock('./repository.js',()=>({routingV2Repository:{listRoutes:repositoryMocks.listRoutes,listProviders:repositoryMocks.listProviders,getModel:repositoryMocks.getModel,getProvider:repositoryMocks.getProvider,saveRoute:repositoryMocks.saveRoute}}));

const checkedAt='2026-09-29T12:00:00.000Z';
const route=(providerId:string):RoutingV2ProviderRoute=>({
  route_id:`route-${providerId}`,model_id:'model-video',capability_id:'text-to-video',provider_id:providerId,provider_model_identifier:'example/video',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:checkedAt,
  status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
  pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_DOCS',source_reference:'https://example.test/price',provider_cost_reference:0.1,safe_cogs_brl:0.5,retail_price_credits:50,expected_margin_percent:55,fetched_at:checkedAt,valid_until:'2026-09-29T13:00:00.000Z'},
  priority:100,created_at:checkedAt,updated_at:checkedAt,
});
const provider=(id:string,health:RoutingV2Provider['health_status'],status:RoutingV2Provider['status']='ACTIVE'):RoutingV2Provider=>({
  provider_id:id,name:id,slug:id,type:'AGGREGATOR',status,priority:100,adapter_id:`wrapper:${id}`,supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,
  health_status:health,created_at:checkedAt,updated_at:checkedAt,
});

describe('Routing V2 ready route health gate',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    repositoryMocks.routes=[route('provider-wavespeed'),route('provider-atlas'),route('provider-runware'),route('provider-fal')];
    repositoryMocks.providers=[provider('provider-wavespeed','HEALTHY'),provider('provider-atlas','UNAVAILABLE'),provider('provider-runware','HEALTHY'),provider('provider-fal','HEALTHY')];
    repositoryMocks.listRoutes.mockImplementation(async()=>repositoryMocks.routes);
    repositoryMocks.listProviders.mockImplementation(async()=>repositoryMocks.providers);
  });

  it('returns only READY routes for official providers whose runtime is currently healthy',async()=>{
    const {routingV2RouteService}=await import('./routeService.js');
    const ready=await routingV2RouteService.listReady();
    expect(ready.map(row=>row.provider_id)).toEqual(['provider-wavespeed','provider-runware']);
  });

  it('rejects route creation for a legacy non-official provider',async()=>{
    const {routingV2RouteService}=await import('./routeService.js');
    await expect(routingV2RouteService.create({
      model_id:'model-video',capability_id:'text-to-video',provider_id:'provider-fal',provider_model_identifier:'fal-ai/model',
      mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:checkedAt,
      billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
    })).rejects.toThrow('Somente WaveSpeed AI, Atlas Cloud e Runware podem receber novas rotas.');
    expect(repositoryMocks.getModel).not.toHaveBeenCalled();
    expect(repositoryMocks.getProvider).not.toHaveBeenCalled();
  });
});
