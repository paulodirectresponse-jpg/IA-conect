import { describe,expect,it } from 'vitest';
import { RoutingV2ProviderRoute } from './domain.js';
import { canReuseRoutingV2PriceAfterTransientFailure,hasFreshRoutingV2PriceSnapshot,hasFreshRoutingV2ProviderHealth,isRoutingV2PriceRateLimited,isRoutingV2PriceSyncCoolingDown,isTransientRoutingV2PriceFailure,routingV2PriceSyncCooldownUntil,shouldReuseRoutingV2PriceSnapshot,shouldSkipRoutingV2PriceRefresh } from './priceSyncPolicy.js';

const quoteAt='2026-09-29T19:00:00.000Z';
const now='2026-09-29T19:40:00.000Z';
const future='2026-09-29T21:00:00.000Z';

function route(overrides:Partial<RoutingV2ProviderRoute>={}):RoutingV2ProviderRoute{
  return{
    route_id:'route_v2_test',model_id:'model-test',capability_id:'text-to-video',provider_id:'provider-atlas',
    provider_model_identifier:'model/test',mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://provider.example/models/test',
    mapping_verified_at:quoteAt,status:'READY',pricing_status:'CURRENT',runtime_status:'HEALTHY',billing_type:'PER_SECOND',
    billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
    pricing_snapshot:{billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_QUOTE_API',
      source_reference:'https://provider.example/pricing',provider_cost_reference:0.5,safe_cogs_brl:2.7,
      retail_price_credits:600,expected_margin_percent:40,fx_rate_usd_brl:5.4,fetched_at:quoteAt,valid_until:future},
    priority:100,last_price_sync_at:quoteAt,last_runtime_check_at:quoteAt,created_at:quoteAt,updated_at:quoteAt,
    ...overrides,
  };
}

describe('Routing V2 price-sync resilience policy',()=>{
  it('refreshes the provider after the sync interval even when the snapshot TTL is still valid',()=>{
    const value=route();
    expect(hasFreshRoutingV2PriceSnapshot(value,now)).toBe(true);
    expect(shouldReuseRoutingV2PriceSnapshot(value,now,30)).toBe(false);
    expect(shouldSkipRoutingV2PriceRefresh(value,now,30)).toBe(false);
    expect(shouldReuseRoutingV2PriceSnapshot(route({pricing_snapshot:{...value.pricing_snapshot!,valid_until:quoteAt}}),now,30)).toBe(false);
  });

  it('avoids another provider quote while a clean price snapshot is inside the configured sync interval',()=>{
    const checkedAt='2026-09-29T19:15:00.000Z';
    expect(shouldSkipRoutingV2PriceRefresh(route(),checkedAt,30)).toBe(true);
    expect(shouldSkipRoutingV2PriceRefresh(route({last_sync_error:'error code: 1015'}),checkedAt,30)).toBe(false);
    expect(shouldSkipRoutingV2PriceRefresh(route({pricing_status:'INVALID'}),checkedAt,30)).toBe(false);
    expect(shouldSkipRoutingV2PriceRefresh(route({pricing_snapshot:{...route().pricing_snapshot!,valid_until:quoteAt}}),checkedAt,30)).toBe(false);
  });

  it('reuses a still-fresh quote briefly after Atlas rate limiting while keeping the failure visible',()=>{
    const value=route({pricing_status:'INVALID',status:'DEGRADED',last_sync_error:'error code: 1015',last_sync_error_at:'2026-09-29T19:30:00.000Z'});
    expect(isTransientRoutingV2PriceFailure(value.last_sync_error)).toBe(true);
    expect(shouldReuseRoutingV2PriceSnapshot(value,now,30)).toBe(true);
    expect(canReuseRoutingV2PriceAfterTransientFailure(value,now,'error code: 1015')).toBe(true);
    expect(shouldReuseRoutingV2PriceSnapshot({...value,pricing_status:'CURRENT',status:'READY'},now,30)).toBe(true);
    expect(shouldReuseRoutingV2PriceSnapshot(value,'2026-09-29T20:00:00.000Z',30)).toBe(false);
  });

  it('keeps a fresh quote usable after a local AbortError while leaving the failure visible',()=>{
    const value=route({pricing_status:'INVALID',status:'DEGRADED',last_sync_error:'The operation was aborted',last_sync_error_at:'2026-09-29T19:30:00.000Z'});
    expect(isTransientRoutingV2PriceFailure(value.last_sync_error)).toBe(true);
    expect(shouldReuseRoutingV2PriceSnapshot(value,now,30)).toBe(true);
    expect(canReuseRoutingV2PriceAfterTransientFailure(value,now,value.last_sync_error)).toBe(true);
  });

  it('applies a persistent, progressive cooldown after provider rate limiting',()=>{
    const first=routingV2PriceSyncCooldownUntil({price_sync_cooldown_failures:0},now,'Atlas pricing HTTP 1015');
    const second=routingV2PriceSyncCooldownUntil({price_sync_cooldown_failures:1},now,'Atlas pricing HTTP 429');
    expect(isRoutingV2PriceRateLimited('Atlas pricing HTTP 1015')).toBe(true);
    expect(isRoutingV2PriceRateLimited('tarifa variável sem pré-cotação exata')).toBe(false);
    expect(first).toBe('2026-09-29T19:41:00.000Z');
    expect(second).toBe('2026-09-29T19:42:00.000Z');
    expect(isRoutingV2PriceSyncCoolingDown({price_sync_cooldown_until:first!},now)).toBe(true);
    expect(isRoutingV2PriceSyncCoolingDown({price_sync_cooldown_until:first!},first!)).toBe(false);
  });

  it('honors a longer Retry-After value without retrying earlier',()=>{
    const until=routingV2PriceSyncCooldownUntil(
      {price_sync_cooldown_failures:0},now,'Atlas pricing HTTP 429 · Retry-After 180',
    );
    expect(until).toBe('2026-09-29T19:43:00.000Z');
  });

  it('does not reuse a snapshot after a dynamic-price or permanent provider error',()=>{
    const value=route({pricing_status:'INVALID',status:'DEGRADED',last_sync_error:'tarifa variável sem pré-cotação exata',last_sync_error_at:'2026-09-29T19:30:00.000Z'});
    expect(isTransientRoutingV2PriceFailure(value.last_sync_error)).toBe(false);
    expect(shouldReuseRoutingV2PriceSnapshot(value,now,30)).toBe(false);
    expect(canReuseRoutingV2PriceAfterTransientFailure(route(),now,'Modelo não encontrado (HTTP 404)')).toBe(false);
  });

  it('requires a verified source and complete economics before reusing a price',()=>{
    const value=route();
    expect(hasFreshRoutingV2PriceSnapshot(route({pricing_snapshot:{...value.pricing_snapshot!,source_reference:null}}),now)).toBe(false);
    expect(hasFreshRoutingV2PriceSnapshot(route({pricing_snapshot:{...value.pricing_snapshot!,retail_price_credits:null}}),now)).toBe(false);
  });

  it('reuses recent provider health within the configured sync interval',()=>{
    const healthNow='2026-09-29T20:00:00.000Z';
    expect(hasFreshRoutingV2ProviderHealth({health_status:'HEALTHY',last_health_check_at:'2026-09-29T19:45:00.000Z'},healthNow,30)).toBe(true);
    expect(hasFreshRoutingV2ProviderHealth({health_status:'HEALTHY',last_health_check_at:'2026-09-29T19:29:59.000Z'},healthNow,30)).toBe(false);
    expect(hasFreshRoutingV2ProviderHealth({health_status:'UNKNOWN',last_health_check_at:'2026-09-29T19:59:59.000Z'},healthNow,30)).toBe(false);
  });
});
