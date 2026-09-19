import { RoutingV2ProviderRoute } from './domain.js';
import { routingV2Repository } from './repository.js';

export interface SmartRouterSelectionCriteria {
  model_id?: string;
  capability_id?: string;
  preferred_provider_ids?: string[];
  avoid_degraded?: boolean;
}

export interface SmartRouterResult {
  selected_route?: RoutingV2ProviderRoute;
  available_routes: RoutingV2ProviderRoute[];
  reason: string;
}

export const routingV2SmartRouter = {
  async selectRoute(criteria: SmartRouterSelectionCriteria): Promise<SmartRouterResult> {
    // Fetch all routes
    const allRoutes = await routingV2Repository.listRoutes();

    // Filter to only READY routes (invariant: no other status can be used for generation)
    let readyRoutes = allRoutes.filter(r => r.status === 'READY');

    if (readyRoutes.length === 0) {
      return {
        available_routes: [],
        reason: 'No READY routes available',
      };
    }

    // Apply model filter
    if (criteria.model_id) {
      readyRoutes = readyRoutes.filter(r => r.model_id === criteria.model_id);
      if (readyRoutes.length === 0) {
        return {
          available_routes: [],
          reason: `No READY routes for model ${criteria.model_id}`,
        };
      }
    }

    // Apply capability filter
    if (criteria.capability_id) {
      readyRoutes = readyRoutes.filter(r => r.capability_id === criteria.capability_id);
      if (readyRoutes.length === 0) {
        return {
          available_routes: [],
          reason: `No READY routes for capability ${criteria.capability_id}`,
        };
      }
    }

    // Apply provider preference
    let selectedRoutes = readyRoutes;
    if (criteria.preferred_provider_ids && criteria.preferred_provider_ids.length > 0) {
      const preferred = readyRoutes.filter(r =>
        criteria.preferred_provider_ids!.includes(r.provider_id)
      );
      if (preferred.length > 0) {
        selectedRoutes = preferred;
      }
    }

    // Avoid degraded if requested
    if (criteria.avoid_degraded) {
      const healthy = selectedRoutes.filter(r => r.runtime_status === 'HEALTHY');
      if (healthy.length > 0) {
        selectedRoutes = healthy;
      }
    }

    // Sort by:
    // 1. Healthy first
    // 2. Then by retail price (cheaper first)
    // 3. Then by provider (for determinism)
    selectedRoutes.sort((a, b) => {
      // Healthy > Degraded
      const aHealthy = a.runtime_status === 'HEALTHY' ? 0 : 1;
      const bHealthy = b.runtime_status === 'HEALTHY' ? 0 : 1;
      if (aHealthy !== bHealthy) return aHealthy - bHealthy;

      // Cheaper first
      const aPrice = a.pricing_snapshot?.retail_price_credits || Number.MAX_SAFE_INTEGER;
      const bPrice = b.pricing_snapshot?.retail_price_credits || Number.MAX_SAFE_INTEGER;
      if (aPrice !== bPrice) return aPrice - bPrice;

      // Deterministic sort by provider
      return a.provider_id.localeCompare(b.provider_id);
    });

    const selected = selectedRoutes[0];
    return {
      selected_route: selected,
      available_routes: selectedRoutes,
      reason: `Selected ${selected.provider_id}/${selected.provider_model_identifier} (READY, ${selected.pricing_snapshot?.retail_price_credits || '?'} credits)`,
    };
  },

  async listReadyRoutes(): Promise<RoutingV2ProviderRoute[]> {
    const allRoutes = await routingV2Repository.listRoutes();
    return allRoutes.filter(r => r.status === 'READY');
  },

  async getReadinessStatus() {
    const allRoutes = await routingV2Repository.listRoutes();
    const byStatus = new Map<string, number>();

    for (const route of allRoutes) {
      byStatus.set(route.status, (byStatus.get(route.status) || 0) + 1);
    }

    return {
      total_routes: allRoutes.length,
      ready: byStatus.get('READY') || 0,
      by_status: Object.fromEntries(byStatus),
      ready_routes: allRoutes
        .filter(r => r.status === 'READY')
        .map(r => ({
          route_id: r.route_id,
          model_id: r.model_id,
          capability_id: r.capability_id,
          provider_id: r.provider_id,
          pricing_credits: r.pricing_snapshot?.retail_price_credits,
          runtime_status: r.runtime_status,
        })),
    };
  },
};
