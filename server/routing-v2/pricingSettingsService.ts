import { RoutingV2PricingSettings } from './domain.js';
import { routingV2Repository } from './repository.js';
import { validateRoutingV2PricingSettings } from './economicsEngine.js';

export const DEFAULT_ROUTING_V2_PRICING_SETTINGS:RoutingV2PricingSettings={
  settings_id:'default',
  target_margin_percent:40,
  safety_buffer_percent:5,
  reference_credit_value_brl:0.009,
  price_sync_interval_minutes:30,
  price_freshness_ttl_minutes:90,
  stale_grace_minutes:0,
  updated_at:new Date(0).toISOString(),
};

export const routingV2PricingSettingsService={
  async get(){
    const stored=await routingV2Repository.getPricingSettings();
    const settings=stored||DEFAULT_ROUTING_V2_PRICING_SETTINGS;
    validateRoutingV2PricingSettings(settings);
    return settings;
  },

  async save(input:Omit<RoutingV2PricingSettings,'settings_id'|'updated_at'>){
    const next:RoutingV2PricingSettings={...input,settings_id:'default',updated_at:new Date().toISOString()};
    validateRoutingV2PricingSettings(next);
    return routingV2Repository.savePricingSettings(next);
  },
};
