import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Model, RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const repositoryMocks=vi.hoisted(()=>(
  {routes:[] as RoutingV2ProviderRoute[],providers:[] as RoutingV2Provider[],models:[] as RoutingV2Model[],listRoutes:vi.fn(),listProviders:vi.fn(),listModels:vi.fn(),getModel:vi.fn(),getProvider:vi.fn(),saveRoute:vi.fn()}
));
vi.mock('./repository.js',()=>({routingV2Repository:{listRoutes:repositoryMocks.listRoutes,listProviders:repositoryMocks.listProviders,listModels:repositoryMocks.listModels,getModel:repositoryMocks.getModel,getProvider:repositoryMocks.getProvider,saveRoute:repositoryMocks.saveRoute}}));

const checkedAt='2026-09-29T12:00:00.000Z';
const route=(providerId:string):RoutingV2ProviderRoute=>({
  route_id:`route-${providerId}`,model_id:'model-video',capability_id:'text-to-video',provider_id:providerId,provider_model_identifier:'example/video',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:checkedAt,
  status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
  pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_DOCS',source_reference:'https://example.test/price',provider_cost_reference:0.1,safe_cogs_brl:0.5,retail_price_credits:50,expected_margin_percent:55,fetched_at:checkedAt,valid_until:new Date(Date.now()+60*60_000).toISOString()},
  priority:100,created_at:checkedAt,updated_at:checkedAt,
});
const model:RoutingV2Model={model_id:'model-video',name:'Model Video',slug:'model-video',vendor:'Test',category:'VIDEO',description:'',capabilities:['text-to-video'],status:'ACTIVE',created_at:checkedAt,updated_at:checkedAt};
const provider=(id:string,health:RoutingV2Provider['health_status'],status:RoutingV2Provider['status']='ACTIVE'):RoutingV2Provider=>({
  provider_id:id,name:id,slug:id,type:'AGGREGATOR',status,priority:100,adapter_id:`wrapper:${id}`,supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,
  health_status:health,created_at:checkedAt,updated_at:checkedAt,
});

describe('Routing V2 ready route health gate',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    repositoryMocks.routes=[route('provider-wavespeed'),route('provider-atlas'),route('provider-runware'),route('provider-fal')];
    repositoryMocks.providers=[provider('provider-wavespeed','HEALTHY'),provider('provider-atlas','UNAVAILABLE'),provider('provider-runware','HEALTHY'),provider('provider-fal','HEALTHY')];
    repositoryMocks.models=[model];
    repositoryMocks.listRoutes.mockImplementation(async()=>repositoryMocks.routes);
    repositoryMocks.listProviders.mockImplementation(async()=>repositoryMocks.providers);
    repositoryMocks.listModels.mockImplementation(async()=>repositoryMocks.models);
  });

  it('returns only READY routes for official healthy providers and active compatible models',async()=>{
    const {routingV2RouteService}=await import('./routeService.js');
    const ready=await routingV2RouteService.listReady();
    expect(ready.map(row=>row.provider_id)).toEqual(['provider-wavespeed','provider-runware']);
  });

  it('rejects stale prices, disabled providers, disabled models, and unsupported model capabilities',async()=>{
    const stale=route('provider-wavespeed');
    stale.route_id='stale';stale.pricing_snapshot={...stale.pricing_snapshot!,valid_until:'2026-09-29T11:00:00.000Z'};
    const disabledProviderRoute=route('provider-atlas');disabledProviderRoute.route_id='disabled-provider';
    const incompatible=route('provider-wavespeed');incompatible.route_id='incompatible';incompatible.capability_id='image-to-video';
    repositoryMocks.routes.push(stale,disabledProviderRoute);
    repositoryMocks.routes.push(incompatible);
    repositoryMocks.providers=repositoryMocks.providers.map(row=>row.provider_id==='provider-atlas'?{...row,status:'DISABLED'}:row);
    const {routingV2RouteService}=await import('./routeService.js');
    expect((await routingV2RouteService.listReady()).map(row=>row.route_id)).toEqual(['route-provider-wavespeed','route-provider-runware']);
    repositoryMocks.models=[{...model,status:'DISABLED'}];
    expect(await routingV2RouteService.listReady()).toEqual([]);
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
