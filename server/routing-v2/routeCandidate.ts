import { RoutingV2ProviderRoute, assertRoutingV2Route } from './domain.js';

export interface RoutingV2RouteCandidate{
  route:RoutingV2ProviderRoute;
  safe_cogs_brl:number;
  retail_price_credits:number;
  priority:number;
}

function freshAt(route:RoutingV2ProviderRoute,now:string){
  const until=route.pricing_snapshot?.valid_until;
  const expiry=until?Date.parse(until):NaN,current=Date.parse(now);
  return Number.isFinite(expiry)&&Number.isFinite(current)&&expiry>current;
}

export function routingV2Candidate(route:RoutingV2ProviderRoute,now:string):RoutingV2RouteCandidate|null{
  try{assertRoutingV2Route(route);}catch{return null;}
  if(route.status!=='READY'||route.pricing_status!=='CURRENT'||route.runtime_status!=='HEALTHY')return null;
  if(!freshAt(route,now))return null;
  const safe=Number(route.pricing_snapshot?.safe_cogs_brl);
  const retail=Number(route.pricing_snapshot?.retail_price_credits);
  if(!Number.isFinite(safe)||safe<0||!Number.isFinite(retail)||retail<=0)return null;
  return{route,safe_cogs_brl:safe,retail_price_credits:retail,priority:Number(route.priority)||0};
}
