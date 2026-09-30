import { RoutingV2ProviderRoute } from './domain.js';
import { routingV2Repository } from './repository.js';
import { routingV2RouterService } from './routerService.js';
import { routingV2RouteService } from './routeService.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { effectiveRoutingV2RouteStatus } from './routeAvailability.js';
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
    return routingV2RouteService.listReady();
  },

  async getReadinessStatus() {
    const[allRoutes,providers,models,readyRoutes]=await Promise.all([
      routingV2Repository.listRoutes(),
      routingV2Repository.listProviders(),
      routingV2Repository.listModels(),
      routingV2RouteService.listReady(),
    ]);
    const officialRoutes=allRoutes.filter(route=>isOfficialRoutingV2Provider(route.provider_id));
    const providerById=new Map(providers.filter(provider=>isOfficialRoutingV2Provider(provider.provider_id)).map(provider=>[provider.provider_id,provider]));
    const activeModelIds=new Set(models.filter(model=>model.status==='ACTIVE').map(model=>model.model_id));
    const readyIds=new Set(readyRoutes.filter(route=>activeModelIds.has(route.model_id)).map(route=>route.route_id));
    const byStatus = new Map<string, number>();

    for (const route of officialRoutes) {
      const provider=providerById.get(route.provider_id);
      const status=effectiveRoutingV2RouteStatus({route,provider:provider||null,modelActive:activeModelIds.has(route.model_id),routable:readyIds.has(route.route_id)});
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
    }

    return {
      total_routes: officialRoutes.length,
      ready: readyIds.size,
      by_status: Object.fromEntries(byStatus),
      ready_routes: officialRoutes
        .filter(route=>readyIds.has(route.route_id))
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
