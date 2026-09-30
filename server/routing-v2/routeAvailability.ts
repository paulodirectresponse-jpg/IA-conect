import { RoutingV2Provider, RoutingV2ProviderRoute, RoutingV2RouteStatus } from './domain.js';

export function effectiveRoutingV2RouteStatus(params:{route:RoutingV2ProviderRoute;provider:RoutingV2Provider|null;modelActive:boolean;routable:boolean}):RoutingV2RouteStatus{
  const{route,provider,modelActive,routable}=params;
  if(route.status==='DISABLED')return'DISABLED';
  if(!modelActive||!provider||provider.status==='DISABLED')return'DISABLED';
  if(route.status==='READY'&&!routable)return'DEGRADED';
  return route.status;
}
