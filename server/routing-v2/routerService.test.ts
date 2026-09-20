import { describe,expect,it } from 'vitest';
import { RoutingV2ProviderRoute } from './domain.js';
import { routingV2Candidate,selectRoutingV2Candidate } from './routerService.js';

const NOW='2026-09-18T20:00:00.000Z';
const FUTURE='2026-09-18T21:30:00.000Z';
const PAST='2026-09-18T19:00:00.000Z';

function route(overrides:Partial<RoutingV2ProviderRoute>={}):RoutingV2ProviderRoute{
  return{
    route_id:'route-v2-a',
    model_id:'veo-3-1',
    capability_id:'text-to-video',
    provider_id:'provider-a',
    provider_model_identifier:'veo-3.1',
    mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:new Date().toISOString(),
    status:'READY',
    pricing_status:'CURRENT',
    runtime_status:'HEALTHY',
    billing_type:'PER_SECOND',
    billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
    pricing_snapshot:{
      billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
      source:'PROVIDER_CATALOG_API',
      source_reference:'https://example.test/pricing',
      provider_cost_reference:0.1,
      safe_cogs_brl:0.50,
      retail_price_credits:100,
      expected_margin_percent:40,
      fx_rate_usd_brl:5,
      fetched_at:NOW,
      valid_until:FUTURE,
    },
    metrics:{},
    priority:100,
    last_price_sync_at:NOW,
    last_runtime_check_at:NOW,
    created_at:NOW,
    updated_at:NOW,
    ...overrides,
  };
}

describe('Routing Core V2 Smart Router',()=>{
  it('accepts only READY, healthy, current and fresh routes',()=>{
    expect(routingV2Candidate(route(),NOW)).not.toBeNull();
    expect(routingV2Candidate(route({status:'DEGRADED'}),NOW)).toBeNull();
    expect(routingV2Candidate(route({runtime_status:'DEGRADED'}),NOW)).toBeNull();
    expect(routingV2Candidate(route({pricing_status:'STALE'}),NOW)).toBeNull();
    const stale=route();
    stale.pricing_snapshot={...stale.pricing_snapshot!,valid_until:PAST};
    expect(routingV2Candidate(stale,NOW)).toBeNull();
  });

  it('selects lowest safe COGS and uses priority only as tie breaker',()=>{
    const expensive=route({route_id:'expensive',provider_id:'provider-expensive',priority:999,pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:0.70}});
    const cheap=route({route_id:'cheap',provider_id:'provider-cheap',priority:1,pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:0.40}});
    const decision=selectRoutingV2Candidate([expensive,cheap],{now:NOW});
    expect(decision.selected.route_id).toBe('cheap');

    const tieLow=route({route_id:'tie-low',provider_id:'provider-low',priority:10,pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:0.40}});
    const tieHigh=route({route_id:'tie-high',provider_id:'provider-high',priority:20,pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:0.40}});
    expect(selectRoutingV2Candidate([tieLow,tieHigh],{now:NOW}).selected.route_id).toBe('tie-high');
  });

  it('supports retry exclusions without provider-specific logic',()=>{
    const a=route({route_id:'a',provider_id:'provider-a'});
    const b=route({route_id:'b',provider_id:'provider-b',pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:0.55}});
    expect(selectRoutingV2Candidate([a,b],{now:NOW,exclude_route_ids:['a']}).selected.route_id).toBe('b');
    expect(selectRoutingV2Candidate([a,b],{now:NOW,exclude_provider_ids:['provider-a']}).selected.route_id).toBe('b');
  });

  it('enforces optional safe COGS budget locally',()=>{
    const a=route({pricing_snapshot:{...route().pricing_snapshot!,safe_cogs_brl:1.20}});
    expect(()=>selectRoutingV2Candidate([a],{now:NOW,max_safe_cogs_brl:1})).toThrow(/Nenhuma Route V2 READY/);
  });

  it('contains no model/vendor/provider hardcodes',()=>{
    const source=selectRoutingV2Candidate.toString()+routingV2Candidate.toString();
    for(const forbidden of ['seedance','kling','veo','wavespeed','runware','atlas','google'])expect(source.toLowerCase()).not.toContain(forbidden);
  });
});
