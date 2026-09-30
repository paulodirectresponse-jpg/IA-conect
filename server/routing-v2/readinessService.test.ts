import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingV2Model, RoutingV2ProviderRoute } from './domain.js';

const mocks=vi.hoisted(()=>(
  {models:[] as RoutingV2Model[],routes:[] as RoutingV2ProviderRoute[],readyRoutes:[] as RoutingV2ProviderRoute[],listModels:vi.fn(),listRoutes:vi.fn(),listReady:vi.fn()}
));
vi.mock('./repository.js',()=>({routingV2Repository:{listModels:mocks.listModels,listRoutes:mocks.listRoutes}}));
vi.mock('./routeService.js',()=>({routingV2RouteService:{listReady:mocks.listReady}}));

const timestamp='2026-09-30T12:00:00.000Z';
const model:RoutingV2Model={model_id:'video-model',name:'Video model',slug:'video-model',vendor:'Test',category:'VIDEO',description:'',capabilities:['text-to-video','image-to-video'],status:'ACTIVE',created_at:timestamp,updated_at:timestamp};
const route=(provider_id:string,capability_id:string):RoutingV2ProviderRoute=>({
  route_id:`${provider_id}-${capability_id}`,model_id:'video-model',capability_id:capability_id as any,provider_id,provider_model_identifier:'vendor/model',
  mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:timestamp,
  status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
  pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_DOCS',source_reference:'https://example.test/pricing',provider_cost_reference:0.1,safe_cogs_brl:0.5,retail_price_credits:50,expected_margin_percent:45,fetched_at:timestamp,valid_until:'2026-10-01T12:00:00.000Z'},
  priority:100,created_at:timestamp,updated_at:timestamp,
});

describe('Routing V2 readiness audit',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    const wavespeed=route('provider-wavespeed','text-to-video');
    const retiredProvider=route('provider-fal','image-to-video');
    const disabledOfficial=route('provider-atlas','image-to-video');
    mocks.models=[model];
    mocks.routes=[wavespeed,retiredProvider,disabledOfficial];
    mocks.readyRoutes=[wavespeed];
    mocks.listModels.mockImplementation(async()=>mocks.models);
    mocks.listRoutes.mockImplementation(async()=>mocks.routes);
    mocks.listReady.mockImplementation(async()=>mocks.readyRoutes);
  });

  it('counts only routes the official, healthy router can actually select',async()=>{
    const {routingV2ReadinessService}=await import('./readinessService.js');
    const result=await routingV2ReadinessService.audit();
    expect(result.v2).toMatchObject({routes:2,ready_routes:1});
    expect(result.coverage).toMatchObject({required_model_capabilities:2,ready_model_capabilities:1});
    expect(result.coverage.missing).toEqual([{model_id:'video-model',capability_id:'image-to-video'}]);
  });
});
