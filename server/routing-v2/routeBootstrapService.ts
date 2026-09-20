import { routingV2Repository } from './repository.js';
import { routingV2RouteService } from './routeService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { CANONICAL_MODELS } from './modelBootstrapService.js';
import { RoutingV2BillingConfig } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';

// Apenas mappings confirmados novamente pelo catálogo autenticado do provider são persistidos.

interface RouteMapping {
  model_id: string;
  capability_id: CapabilityId;
  provider_id: string;
  provider_model_identifier: string;
}

export const CANONICAL_ROUTES: RouteMapping[] = [{
  model_id:'model-flux-1-pro',capability_id:'text-to-image',provider_id:'provider-wavespeed',provider_model_identifier:'wavespeed-ai/flux-1.1-pro',
}];

const defaultBillingConfig: RoutingV2BillingConfig = {
  type: 'PER_GENERATION',
  currency: 'USD',
  price_per_generation: 0,
};

export const routingV2RouteBootstrapService = {
  async bootstrapCanonical() {
    const result: {
      created: string[];
      existing: string[];
      failed: Array<{ route_key: string; error: string }>;
    } = {
      created: [],
      existing: [],
      failed: [],
    };

    for (const mapping of CANONICAL_ROUTES) {
      const routeKey = `${mapping.model_id}/${mapping.capability_id}/${mapping.provider_id}`;

      try {
        // Check if route already exists
        const existing = await routingV2Repository.listRoutes();
        const alreadyExists = existing.some(
          r =>
            r.model_id === mapping.model_id &&
            r.capability_id === mapping.capability_id &&
            r.provider_id === mapping.provider_id
        );

        if (alreadyExists) {
          result.existing.push(routeKey);
          continue;
        }

        // Create route with status DISCOVERED
        const provider=await routingV2Repository.getProvider(mapping.provider_id);
        const adapter=provider?routingV2AdapterRegistry.get(provider.adapter_id):null;
        if(!provider||!adapter?.listModels)throw new Error('Provider não oferece descoberta autenticada de catálogo.');
        const catalog=await adapter.listModels(provider);
        if(!catalog.some(model=>model.provider_model_identifier===mapping.provider_model_identifier))throw new Error('Mapping não foi encontrado no catálogo autenticado do provider.');
        const verifiedAt=new Date().toISOString();
        await routingV2RouteService.create({
          ...mapping,billing_config:defaultBillingConfig,
          mapping_source:'PROVIDER_CATALOG_API',mapping_source_reference:`https://api.wavespeed.ai/api/v3/models#${encodeURIComponent(mapping.provider_model_identifier)}`,mapping_verified_at:verifiedAt,
        });

        result.created.push(routeKey);
      } catch (error: any) {
        result.failed.push({
          route_key: routeKey,
          error: String(error?.message || error),
        });
      }
    }

    return result;
  },
};
