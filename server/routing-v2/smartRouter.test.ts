import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Model, RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const mocks=vi.hoisted(()=>(
  {routes:[] as RoutingV2ProviderRoute[],providers:[] as RoutingV2Provider[],models:[] as RoutingV2Model[],readyRoutes:[] as RoutingV2ProviderRoute[],listRoutes:vi.fn(),listProviders:vi.fn(),listModels:vi.fn(),listReady:vi.fn()}
));
vi.mock('./repository.js',()=>({routingV2Repository:{listRoutes:mocks.listRoutes,listProviders:mocks.listProviders,listModels:mocks.listModels}}));
vi.mock('./routeService.js',()=>({routingV2RouteService:{listReady:mocks.listReady}}));

const timestamp='2026-09-30T12:00:00.000Z';
const route=(provider_id:string,route_id:string):RoutingV2ProviderRoute=>({
  route_id,model_id:'video-model',capability_id:'text-to-video',provider_id,provider_model_identifier:'vendor/model',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:timestamp,
  status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
  pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_DOCS',source_reference:'https://example.test/pricing',provider_cost_reference:0.1,safe_cogs_brl:0.5,retail_price_credits:50,expected_margin_percent:45,fetched_at:timestamp,valid_until:'2026-10-01T12:00:00.000Z'},
  priority:100,created_at:timestamp,updated_at:timestamp,
});
const provider=(provider_id:string,status:RoutingV2Provider['status']):RoutingV2Provider=>({
  provider_id,name:provider_id,slug:provider_id,type:'AGGREGATOR',status,priority:100,adapter_id:`wrapper:${provider_id}`,supports_catalog_sync:true,supports_pricing_sync:true,supports_balance:false,
  health_status:'HEALTHY',created_at:timestamp,updated_at:timestamp,
});
const model:RoutingV2Model={model_id:'video-model',name:'Video model',slug:'video-model',vendor:'Test',category:'VIDEO',description:'',capabilities:['text-to-video'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp};

describe('Routing V2 readiness summary',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    const wave=route('provider-wavespeed','wave-ready');
    mocks.routes=[wave,route('provider-atlas','atlas-disabled'),route('provider-runware','runware-expired'),route('provider-fal','legacy-ready')];
    mocks.providers=[provider('provider-wavespeed','ACTIVE'),provider('provider-atlas','DISABLED'),provider('provider-runware','ACTIVE'),provider('provider-fal','DISABLED')];
    mocks.models=[model];
    mocks.readyRoutes=[wave];
    mocks.listRoutes.mockImplementation(async()=>mocks.routes);
    mocks.listProviders.mockImplementation(async()=>mocks.providers);
    mocks.listModels.mockImplementation(async()=>mocks.models);
    mocks.listReady.mockImplementation(async()=>mocks.readyRoutes);
  });

  it('omits retired providers and reports disabled or stale READY rows as unavailable',async()=>{
    const {routingV2SmartRouter}=await import('./smartRouter.js');
    const result=await routingV2SmartRouter.getReadinessStatus();
    expect(result).toMatchObject({total_routes:3,ready:1,by_status:{READY:1,DISABLED:1,DEGRADED:1}});
    expect(result.ready_routes.map(row=>row.provider_id)).toEqual(['provider-wavespeed']);
    expect(result.ready_routes.some(row=>row.provider_id==='provider-fal')).toBe(false);
  });
});
