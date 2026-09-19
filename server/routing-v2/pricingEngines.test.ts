import { describe,expect,it } from 'vitest';
import { calculateRoutingV2ProviderCost } from './billingEngine.js';
import { calculateRoutingV2Economics, validateRoutingV2PricingSettings } from './economicsEngine.js';
import { RoutingV2PricingSettings } from './domain.js';
import { routingV2CustomFormulaRegistry } from './customFormulaRegistry.js';

const settings:RoutingV2PricingSettings={
  settings_id:'default',
  target_margin_percent:40,
  safety_buffer_percent:5,
  reference_credit_value_brl:0.009,
  price_sync_interval_minutes:30,
  price_freshness_ttl_minutes:90,
  stale_grace_minutes:60,
  updated_at:'2026-09-18T00:00:00.000Z',
};

describe('Routing Core V2 billing engine',()=>{
  it('calculates image/output billing',()=>{
    const result=calculateRoutingV2ProviderCost({type:'PER_OUTPUT',currency:'USD',price_per_output:0.05},{number_of_outputs:2});
    expect(result.amount).toBeCloseTo(0.10,10);
    expect(result.quantity).toBe(2);
  });

  it('calculates video by exact duration in seconds',()=>{
    const result=calculateRoutingV2ProviderCost({type:'PER_SECOND',currency:'USD',price_per_second:0.04},{duration_seconds:10});
    expect(result.amount).toBeCloseTo(0.40,10);
    expect(result.quantity).toBe(10);
  });

  it('calculates TTS by configured character unit',()=>{
    const result=calculateRoutingV2ProviderCost({type:'PER_CHARACTER',currency:'USD',price_per_unit:0.06,characters_per_unit:1000},{character_count:2500});
    expect(result.amount).toBeCloseTo(0.15,10);
    expect(result.quantity).toBeCloseTo(2.5,10);
  });

  it('calculates minute billing without media-specific logic',()=>{
    const result=calculateRoutingV2ProviderCost({type:'PER_MINUTE',currency:'USD',price_per_minute:0.10},{duration_seconds:120});
    expect(result.amount).toBeCloseTo(0.20,10);
  });

  it('uses an exact fixed matrix and refuses unknown combinations',()=>{
    const config={type:'FIXED_MATRIX' as const,currency:'USD' as const,entries:[
      {match:{resolution:'720p',duration_seconds:5},price:0.25},
      {match:{resolution:'1080p',duration_seconds:5},price:0.50},
    ]};
    expect(calculateRoutingV2ProviderCost(config,{dimensions:{resolution:'1080p',duration_seconds:5}}).amount).toBe(0.50);
    expect(()=>calculateRoutingV2ProviderCost(config,{dimensions:{resolution:'4K',duration_seconds:5}})).toThrow(/matriz/);
  });

  it('executes custom formulas only through an explicit registered formula',()=>{
    routingV2CustomFormulaRegistry.clearForTests();
    expect(()=>calculateRoutingV2ProviderCost({type:'CUSTOM_FORMULA',currency:'USD',formula_id:'future-formula'},{})).toThrow(/CUSTOM_FORMULA/);
    routingV2CustomFormulaRegistry.register('provider-special',(_config,input)=>({
      amount:Number(input.duration_seconds||0)*0.07,
      quantity:Number(input.duration_seconds||0),
      unit_label:'provider-special-second',
    }));
    const result=calculateRoutingV2ProviderCost({type:'CUSTOM_FORMULA',currency:'USD',formula_id:'provider-special'},{duration_seconds:4});
    expect(result.amount).toBeCloseTo(0.28,10);
    expect(result.quantity).toBe(4);
    expect(result.unit_label).toBe('provider-special-second');
    routingV2CustomFormulaRegistry.clearForTests();
  });
});

describe('Routing Core V2 economics engine',()=>{
  it('applies FX, safety buffer, true gross margin and credit conversion',()=>{
    const result=calculateRoutingV2Economics({provider_cost:0.05,provider_currency:'USD',fx_rate_usd_brl:5.2,settings});
    expect(result.provider_cost_brl).toBeCloseTo(0.26,6);
    expect(result.safe_cogs_brl).toBeCloseTo(0.273,6);
    expect(result.selling_price_brl).toBeCloseTo(0.455,6);
    expect(result.retail_credits).toBe(51);
    expect(result.expected_margin_percent).toBeGreaterThanOrEqual(40);
  });

  it('does not require FX for provider cost already in BRL',()=>{
    const result=calculateRoutingV2Economics({provider_cost:1,provider_currency:'BRL',settings});
    expect(result.provider_cost_brl).toBe(1);
  });

  it('rejects unsafe economic settings',()=>{
    expect(()=>validateRoutingV2PricingSettings({...settings,target_margin_percent:100})).toThrow(/Margem/);
    expect(()=>validateRoutingV2PricingSettings({...settings,reference_credit_value_brl:0})).toThrow(/crédito/);
    expect(()=>calculateRoutingV2Economics({provider_cost:1,provider_currency:'USD',settings})).toThrow(/FX/);
  });
});
