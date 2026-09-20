import { RoutingV2ProviderRoute } from './domain.js';
import { routingV2Repository } from './repository.js';
import { routingV2RouterService, routingV2Candidate } from './routerService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';

export interface SmartRouterSelectionCriteria {
  model_id: string;
  capability_id: CapabilityId;
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
    try{
      const decision=await routingV2RouterService.select({
        model_id:criteria.model_id,capability_id:criteria.capability_id,
        exclude_provider_ids:criteria.preferred_provider_ids?.length?undefined:[],
      });
      let candidates=decision.candidates.map(row=>row.route);
      if(criteria.preferred_provider_ids?.length){const preferred=candidates.filter(route=>criteria.preferred_provider_ids!.includes(route.provider_id));if(preferred.length)candidates=preferred;}
      const selected=candidates[0];
      return{selected_route:selected,available_routes:candidates,reason:decision.reason};
    }catch(err:any){if(err?.code==='NO_READY_ROUTE_V2')return{available_routes:[],reason:err.message};throw err;}
  },

  async listReadyRoutes(): Promise<RoutingV2ProviderRoute[]> {
    const allRoutes = await routingV2Repository.listRoutes();
    const now=new Date().toISOString();return allRoutes.filter(route=>Boolean(routingV2Candidate(route,now)));
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
        .filter(r => Boolean(routingV2Candidate(r,new Date().toISOString())))
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
