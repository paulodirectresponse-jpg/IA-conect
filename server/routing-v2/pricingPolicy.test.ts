import {describe,expect,it} from 'vitest';
import {calculateRoutingV2Economics} from './economicsEngine.js';
import {DEFAULT_ROUTING_V2_PRICING_SETTINGS,LEGACY_ROUTING_V2_PRICING_SETTINGS} from './pricingSettingsService.js';

describe('Routing V2 approved economics policy',()=>{
  it('uses the approved launch policy defaults',()=>{
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.target_margin_percent).toBe(55);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.safety_buffer_percent).toBe(8);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.reference_credit_value_brl).toBe(0.01);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.price_sync_interval_minutes).toBe(30);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.price_freshness_ttl_minutes).toBe(120);
    expect(DEFAULT_ROUTING_V2_PRICING_SETTINGS.stale_grace_minutes).toBe(0);
  });

  it('keeps the previous baseline identifiable for one-time migration',()=>{
    expect(LEGACY_ROUTING_V2_PRICING_SETTINGS.target_margin_percent).toBe(40);
    expect(LEGACY_ROUTING_V2_PRICING_SETTINGS.safety_buffer_percent).toBe(5);
    expect(LEGACY_ROUTING_V2_PRICING_SETTINGS.reference_credit_value_brl).toBe(0.009);
    expect(LEGACY_ROUTING_V2_PRICING_SETTINGS.price_freshness_ttl_minutes).toBe(90);
  });

  it('calculates safe COGS, selling price and credits from one policy source',()=>{
    const result=calculateRoutingV2Economics({
      provider_cost:0.10,
      provider_currency:'USD',
      fx_rate_usd_brl:5,
      settings:DEFAULT_ROUTING_V2_PRICING_SETTINGS,
    });
    expect(result.provider_cost_brl).toBe(0.5);
    expect(result.safe_cogs_brl).toBe(0.54);
    expect(result.selling_price_brl).toBe(1.2);
    expect(result.retail_credits).toBe(120);
    expect(result.expected_margin_percent).toBe(55);
    expect(result.credit_value_brl).toBe(0.01);
  });
});
