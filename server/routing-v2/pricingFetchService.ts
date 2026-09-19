import { RoutingV2Provider, RoutingV2BillingConfig, RoutingV2PriceSource } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';

export interface PricingFetchResult {
  billing_config: RoutingV2BillingConfig;
  source: RoutingV2PriceSource;
  source_reference?: string;
  fetched_at: string;
  valid_until: string;
}

export const routingV2PricingFetchService = {
  async fetchProviderPrice(
    provider: RoutingV2Provider,
    provider_model_identifier: string,
    capability_id: CapabilityId
  ): Promise<PricingFetchResult | null> {
    const adapter = routingV2AdapterRegistry.get(provider.adapter_id);
    if (!adapter || !adapter.getPrice) {
      return null;
    }

    try {
      const price = await adapter.getPrice(provider, provider_model_identifier, capability_id);

      if (!price || !price.billing_config) {
        return null;
      }

      const now = new Date();
      const fetchedAt = price.fetched_at || now.toISOString();
      const validUntil = new Date(now.getTime() + 90 * 60_000).toISOString();

      return {
        billing_config: price.billing_config,
        source: (price.source || 'PROVIDER_QUOTE_API') as RoutingV2PriceSource,
        source_reference: price.source_reference || provider_model_identifier,
        fetched_at: fetchedAt,
        valid_until: validUntil,
      };
    } catch (error: any) {
      console.error(`Pricing fetch failed for ${provider.provider_id}/${provider_model_identifier}:`, error?.message);
      return null;
    }
  },

  async fetchBatchPricing(
    provider: RoutingV2Provider,
    routes: Array<{ provider_model_identifier: string; capability_id: CapabilityId }>
  ): Promise<Map<string, PricingFetchResult>> {
    const results = new Map<string, PricingFetchResult>();

    for (const route of routes) {
      const key = `${route.provider_model_identifier}/${route.capability_id}`;
      const result = await this.fetchProviderPrice(
        provider,
        route.provider_model_identifier,
        route.capability_id
      );

      if (result) {
        results.set(key, result);
      }
    }

    return results;
  },
};
