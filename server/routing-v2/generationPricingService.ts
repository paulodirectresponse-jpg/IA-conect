import { CapabilityId } from '../beta/capabilityRegistry.js';
import { calculateRoutingV2ProviderCost, RoutingV2BillingInput } from './billingEngine.js';
import { calculateRoutingV2Economics } from './economicsEngine.js';
import { RoutingV2ProviderRoute } from './domain.js';
import { routingV2PricingSettingsService } from './pricingSettingsService.js';
import { routingV2RouterService } from './routerService.js';

export interface RoutingV2GenerationPricingInput{
  model_id:string;
  capability_id:CapabilityId;
  duration_seconds?:number;
  number_of_outputs?:number;
  character_count?:number;
  dimensions?:Record<string,string|number|boolean|null|undefined>;
  exclude_route_ids?:string[];
  exclude_provider_ids?:string[];
  now?:string;
}

export interface RoutingV2GenerationPricePreview{
  route:RoutingV2ProviderRoute;
  provider_cost:number;
  provider_currency:'USD'|'BRL';
  provider_cost_brl:number;
  safe_cogs_brl:number;
  retail_credits:number;
  expected_margin_percent:number;
  pricing_fetched_at:string;
  pricing_valid_until:string;
}

export async function calculateRoutingV2GenerationPrice(
  route:RoutingV2ProviderRoute,
  input:RoutingV2BillingInput
):Promise<RoutingV2GenerationPricePreview>{
  if(!route.pricing_snapshot)throw Object.assign(new Error('Route V2 não possui pricing snapshot.'),{code:'ROUTING_V2_PRICE_UNAVAILABLE'});
  const billing=calculateRoutingV2ProviderCost(route.billing_config,input);
  const settings=await routingV2PricingSettingsService.get();
  const fx=billing.currency==='USD'?Number(route.pricing_snapshot.fx_rate_usd_brl):undefined;
  const economics=calculateRoutingV2Economics({
    provider_cost:billing.amount,
    provider_currency:billing.currency,
    fx_rate_usd_brl:fx,
    settings,
  });
  return{
    route,
    provider_cost:billing.amount,
    provider_currency:billing.currency,
    provider_cost_brl:economics.provider_cost_brl,
    safe_cogs_brl:economics.safe_cogs_brl,
    retail_credits:economics.retail_credits,
    expected_margin_percent:economics.expected_margin_percent,
    pricing_fetched_at:route.pricing_snapshot.fetched_at,
    pricing_valid_until:route.pricing_snapshot.valid_until,
  };
}

export const routingV2GenerationPricingService={
  async preview(input:RoutingV2GenerationPricingInput){
    const decision=await routingV2RouterService.select({
      model_id:input.model_id,
      capability_id:input.capability_id,
      exclude_route_ids:input.exclude_route_ids,
      exclude_provider_ids:input.exclude_provider_ids,
      now:input.now,
    });
    return calculateRoutingV2GenerationPrice(decision.selected,{
      duration_seconds:input.duration_seconds,
      number_of_outputs:input.number_of_outputs,
      character_count:input.character_count,
      dimensions:input.dimensions,
    });
  },
};
