import { RoutingV2Provider, RoutingV2ProviderRoute, RoutingV2PricingStatus, RoutingV2RouteStatus, RoutingV2RuntimeStatus } from './domain.js';

export interface RoutingV2ReconcileInput{
  route:RoutingV2ProviderRoute;
  provider:RoutingV2Provider|null;
  pricing_status?:RoutingV2PricingStatus;
  runtime_status?:RoutingV2RuntimeStatus;
  now?:string;
}

function isFresh(validUntil:string|undefined,now:string){
  if(!validUntil)return false;
  const expiry=Date.parse(validUntil),current=Date.parse(now);
  return Number.isFinite(expiry)&&Number.isFinite(current)&&expiry>current;
}

export function deriveRoutingV2RouteStatus(input:RoutingV2ReconcileInput):RoutingV2RouteStatus{
  const route=input.route;
  if(route.status==='DISABLED')return'DISABLED';
  if(!input.provider||input.provider.status==='DISABLED')return'DISABLED';

  const pricing=input.pricing_status??route.pricing_status;
  const runtime=input.runtime_status??route.runtime_status;
  const now=input.now||new Date().toISOString();
  const snapshot=route.pricing_snapshot;
  const hasRetail=Boolean(snapshot&&Number.isFinite(Number(snapshot.retail_price_credits))&&Number(snapshot.retail_price_credits)>0);
  const fresh=Boolean(snapshot&&isFresh(snapshot.valid_until,now));

  if(pricing==='INVALID')return'DEGRADED';
  if(pricing==='STALE'||!fresh)return snapshot?'DEGRADED':'MAPPED';
  if(pricing==='CURRENT'&&hasRetail&&runtime==='HEALTHY')return'READY';
  if(pricing==='CURRENT'&&hasRetail)return runtime==='UNKNOWN'?'PRICED':'DEGRADED';
  return'MAPPED';
}

export function reconcileRoutingV2Route(input:RoutingV2ReconcileInput):RoutingV2ProviderRoute{
  const now=input.now||new Date().toISOString();
  const pricing=input.pricing_status??input.route.pricing_status;
  const runtime=input.runtime_status??input.route.runtime_status;
  const next:RoutingV2ProviderRoute={
    ...input.route,
    pricing_status:pricing,
    runtime_status:runtime,
    updated_at:now,
  };
  return{...next,status:deriveRoutingV2RouteStatus({...input,route:next,now})};
}
