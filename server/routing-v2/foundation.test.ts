import { describe,expect,it } from 'vitest';
import {
  RoutingV2ProviderRoute,
  assertRoutingV2BillingConfig,
  assertRoutingV2Route,
  routingV2RouteId,
} from './domain.js';
import { routingV2Repository } from './repository.js';

function readyRoute():RoutingV2ProviderRoute{
  const now='2026-09-18T00:00:00.000Z';
  return{
    route_id:routingV2RouteId('veo-3-1','text-to-video','provider-google-direct','veo-3.1'),
    model_id:'veo-3-1',
    capability_id:'text-to-video',
    provider_id:'provider-google-direct',
    provider_model_identifier:'veo-3.1',
    status:'READY',
    pricing_status:'CURRENT',
    runtime_status:'HEALTHY',
    billing_type:'PER_SECOND',
    billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
    pricing_snapshot:{
      billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
      source:'PROVIDER_CATALOG_API',
      provider_cost_reference:0.1,
      safe_cogs_brl:0.55,
      retail_price_credits:110,
      expected_margin_percent:40,
      fx_rate_usd_brl:5.2,
      fetched_at:now,
      valid_until:'2026-09-18T01:30:00.000Z',
    },
    priority:100,
    last_price_sync_at:now,
    last_runtime_check_at:now,
    created_at:now,
    updated_at:now,
  };
}

describe('Routing Core V2 foundation',()=>{
  it('uses deterministic provider-route identity instead of model duplication',()=>{
    const a=routingV2RouteId('veo-3-1','text-to-video','provider-google-direct','veo-3.1');
    const b=routingV2RouteId('veo-3-1','text-to-video','provider-google-direct','veo-3.1');
    const c=routingV2RouteId('veo-3-1','image-to-video','provider-google-direct','veo-3.1');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('accepts the initial billing families without inferring them from media category',()=>{
    expect(()=>assertRoutingV2BillingConfig({type:'PER_GENERATION',currency:'USD',price_per_generation:0.04})).not.toThrow();
    expect(()=>assertRoutingV2BillingConfig({type:'PER_OUTPUT',currency:'USD',price_per_output:0.04})).not.toThrow();
    expect(()=>assertRoutingV2BillingConfig({type:'PER_SECOND',currency:'USD',price_per_second:0.04})).not.toThrow();
    expect(()=>assertRoutingV2BillingConfig({type:'PER_MINUTE',currency:'USD',price_per_minute:0.1})).not.toThrow();
    expect(()=>assertRoutingV2BillingConfig({type:'PER_CHARACTER',currency:'USD',price_per_unit:0.06,characters_per_unit:1000})).not.toThrow();
    expect(()=>assertRoutingV2BillingConfig({type:'FIXED_MATRIX',currency:'USD',entries:[{match:{resolution:'1080p',duration_seconds:5},price:0.5}]})).not.toThrow();
  });

  it('makes READY a strict derived operational state',()=>{
    const route=readyRoute();
    expect(()=>assertRoutingV2Route(route)).not.toThrow();
    expect(()=>assertRoutingV2Route({...route,pricing_status:'STALE'})).toThrow(/READY exige/);
    expect(()=>assertRoutingV2Route({...route,runtime_status:'DEGRADED'})).toThrow(/READY exige/);
    expect(()=>assertRoutingV2Route({...route,pricing_snapshot:null})).toThrow(/READY exige/);
  });

  it('keeps V2 persistence isolated from every V1 collection',()=>{
    expect(routingV2Repository.collections).toEqual({
      providers:'routing_v2_providers',
      models:'routing_v2_models',
      routes:'routing_v2_routes',
      settings:'routing_v2_pricing_settings',
    });
  });
});
