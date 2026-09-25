import { RoutingV2PricingSettings } from './domain.js';
import { routingV2Repository } from './repository.js';
import { validateRoutingV2PricingSettings } from './economicsEngine.js';

export const LEGACY_ROUTING_V2_PRICING_SETTINGS:RoutingV2PricingSettings={
  settings_id:'default',
  target_margin_percent:40,
  safety_buffer_percent:5,
  reference_credit_value_brl:0.009,
  price_sync_interval_minutes:30,
  price_freshness_ttl_minutes:90,
  stale_grace_minutes:0,
  updated_at:new Date(0).toISOString(),
};

export const DEFAULT_ROUTING_V2_PRICING_SETTINGS:RoutingV2PricingSettings={
  settings_id:'default',
  target_margin_percent:55,
  safety_buffer_percent:8,
  reference_credit_value_brl:0.01,
  price_sync_interval_minutes:30,
  price_freshness_ttl_minutes:120,
  stale_grace_minutes:0,
  updated_at:new Date(0).toISOString(),
};

function economicallyEqual(a:RoutingV2PricingSettings,b:RoutingV2PricingSettings){
  return a.target_margin_percent===b.target_margin_percent&&
    a.safety_buffer_percent===b.safety_buffer_percent&&
    a.reference_credit_value_brl===b.reference_credit_value_brl&&
    a.price_sync_interval_minutes===b.price_sync_interval_minutes&&
    a.price_freshness_ttl_minutes===b.price_freshness_ttl_minutes&&
    a.stale_grace_minutes===b.stale_grace_minutes;
}

async function invalidateRoutePricing(){
  const routes=await routingV2Repository.listRoutes();
  const updatedAt=new Date().toISOString();
  let invalidated=0;
  for(const route of routes){
    if(route.status==='DISABLED')continue;
    const next={
      ...route,
      status:route.pricing_snapshot?'DEGRADED' as const:'MAPPED' as const,
      pricing_status:'STALE' as const,
      updated_at:updatedAt,
    };
    await routingV2Repository.saveRoute(next);
    invalidated++;
  }
  return invalidated;
}

export const routingV2PricingSettingsService={
  async get(){
    const stored=await routingV2Repository.getPricingSettings();
    if(!stored){
      validateRoutingV2PricingSettings(DEFAULT_ROUTING_V2_PRICING_SETTINGS);
      return DEFAULT_ROUTING_V2_PRICING_SETTINGS;
    }
    validateRoutingV2PricingSettings(stored);

    if(economicallyEqual(stored,LEGACY_ROUTING_V2_PRICING_SETTINGS)){
      const migrated:{settings:RoutingV2PricingSettings;invalidated_routes:number}={
        settings:{...DEFAULT_ROUTING_V2_PRICING_SETTINGS,updated_at:new Date().toISOString()},
        invalidated_routes:0,
      };
      migrated.settings=await routingV2Repository.savePricingSettings(migrated.settings);
      migrated.invalidated_routes=await invalidateRoutePricing();
      return migrated.settings;
    }

    return stored;
  },

  async save(input:Omit<RoutingV2PricingSettings,'settings_id'|'updated_at'>){
    const current=await routingV2Repository.getPricingSettings();
    const next:RoutingV2PricingSettings={...input,settings_id:'default',updated_at:new Date().toISOString()};
    validateRoutingV2PricingSettings(next);
    const saved=await routingV2Repository.savePricingSettings(next);
    if(!current||!economicallyEqual(current,saved))await invalidateRoutePricing();
    return saved;
  },
};
