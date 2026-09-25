import { describe,expect,it } from 'vitest';
import { RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';
import { deriveRoutingV2RouteStatus, reconcileRoutingV2Route } from './routeReconciler.js';
import { DEFAULT_ROUTING_V2_PRICING_SETTINGS } from './pricingSettingsService.js';
import fs from 'fs';
import path from 'path';

const now='2026-09-18T20:00:00.000Z';
const future='2026-09-18T21:30:00.000Z';
const past='2026-09-18T19:30:00.000Z';

const provider:RoutingV2Provider={
  provider_id:'provider-test',name:'Test',slug:'test',type:'AGGREGATOR',status:'ACTIVE',priority:100,
  adapter_id:'adapter-test',supports_catalog_sync:false,supports_pricing_sync:true,supports_balance:false,
  health_status:'HEALTHY',created_at:now,updated_at:now,
};

function route(validUntil=future):RoutingV2ProviderRoute{
  return{
    route_id:'route_v2_test',model_id:'model-test',capability_id:'text-to-video',provider_id:provider.provider_id,
    provider_model_identifier:'model/test',mapping_source:'PROVIDER_DOCS',mapping_source_reference:'https://example.test/model',mapping_verified_at:now,status:'PRICED',pricing_status:'CURRENT',runtime_status:'HEALTHY',
    billing_type:'PER_SECOND',billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},
    pricing_snapshot:{
      billing_config:{type:'PER_SECOND',currency:'USD',price_per_second:0.1},source:'PROVIDER_CATALOG_API',source_reference:'https://example.test/pricing',
      provider_cost_reference:0.1,safe_cogs_brl:0.55,retail_price_credits:102,expected_margin_percent:40,
      fx_rate_usd_brl:5.2,fetched_at:now,valid_until:validUntil,
    },
    priority:100,last_price_sync_at:now,last_runtime_check_at:now,created_at:now,updated_at:now,
  };
}

describe('Routing Core V2 Part 4 — price sync and reconciliation',()=>{
  it('promotes only fresh priced healthy routes to READY',()=>{
    expect(deriveRoutingV2RouteStatus({route:route(),provider,now})).toBe('READY');
    expect(reconcileRoutingV2Route({route:route(),provider,now}).status).toBe('READY');
  });

  it('degrades a route when its saved price is stale',()=>{
    expect(deriveRoutingV2RouteStatus({route:route(past),provider,now})).toBe('DEGRADED');
  });

  it('degrades a route when runtime health is not healthy',()=>{
    expect(deriveRoutingV2RouteStatus({route:{...route(),runtime_status:'DEGRADED'},provider,now})).toBe('DEGRADED');
  });

  it('disables operational use when the provider itself is disabled',()=>{
    expect(deriveRoutingV2RouteStatus({route:route(),provider:{...provider,status:'DISABLED'},now})).toBe('DISABLED');
  });

  it('uses the approved launch economics defaults',()=>{
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.target_margin_percent).toBe(55);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.safety_buffer_percent).toBe(8);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.reference_credit_value_brl).toBe(0.01);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.price_sync_interval_minutes).toBe(30);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.price_freshness_ttl_minutes).toBe(120);
  });

  it('keeps price sync outside the request path and bounded for Cloudflare',()=>{
    const source=fs.readFileSync(path.join(process.cwd(),'server/routing-v2/priceSyncService.ts'),'utf8');
    const wrangler=fs.readFileSync(path.join(process.cwd(),'wrangler.jsonc'),'utf8');
    const worker=fs.readFileSync(path.join(process.cwd(),'worker/index.ts'),'utf8');
    const scheduled=fs.readFileSync(path.join(process.cwd(),'server/routing-v2/scheduledSyncService.ts'),'utf8');
    expect(source).toContain('Math.min(10');
    expect(source).toContain('eligible.slice(cursor,cursor+limit)');
    expect(source).toContain('adapter.getPrice');
    expect(source).toContain('price.billing_config.type!==route.billing_type');
    expect(source).toContain('calculateRoutingV2Economics');
    expect(wrangler).toContain('"*/30 * * * *"');
    expect(worker).toContain('routingV2ScheduledSyncService.run');
    expect(scheduled).toContain('getPriceSyncCursor');
    expect(scheduled).toContain('savePriceSyncCursor');
  });
});
