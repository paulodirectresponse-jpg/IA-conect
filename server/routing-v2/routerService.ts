import { CapabilityId } from '../beta/capabilityRegistry.js';
import { RoutingV2ProviderRoute, assertRoutingV2Route } from './domain.js';
import { routingV2RouteService } from './routeService.js';

export interface RoutingV2RouterInput{
  model_id:string;
  capability_id:CapabilityId;
  exclude_route_ids?:string[];
  exclude_provider_ids?:string[];
  max_safe_cogs_brl?:number;
  now?:string;
}

export interface RoutingV2RouteCandidate{
  route:RoutingV2ProviderRoute;
  safe_cogs_brl:number;
  retail_price_credits:number;
  priority:number;
}

export interface RoutingV2RoutingDecision{
  selected:RoutingV2ProviderRoute;
  candidates:RoutingV2RouteCandidate[];
  reason:string;
  strategy:'LOWEST_SAFE_COGS';
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

export function selectRoutingV2Candidate(
  routes:RoutingV2ProviderRoute[],
  input:Omit<RoutingV2RouterInput,'model_id'|'capability_id'>={}
):RoutingV2RoutingDecision{
  const now=input.now||new Date().toISOString();
  const excludedRoutes=new Set((input.exclude_route_ids||[]).map(String));
  const excludedProviders=new Set((input.exclude_provider_ids||[]).map(String));
  const max=Number.isFinite(Number(input.max_safe_cogs_brl))?Math.max(0,Number(input.max_safe_cogs_brl)):null;

  const candidates=routes
    .filter(route=>!excludedRoutes.has(route.route_id)&&!excludedProviders.has(route.provider_id))
    .map(route=>routingV2Candidate(route,now))
    .filter((row):row is RoutingV2RouteCandidate=>Boolean(row))
    .filter(row=>max===null||row.safe_cogs_brl<=max)
    .sort((a,b)=>a.safe_cogs_brl-b.safe_cogs_brl||b.priority-a.priority||a.route.route_id.localeCompare(b.route.route_id));

  if(!candidates.length){
    const error:any=new Error('Nenhuma Route V2 READY e economicamente válida está disponível para esta geração.');
    error.code='NO_READY_ROUTE_V2';
    throw error;
  }

  const selected=candidates[0].route;
  return{
    selected,
    candidates,
    reason:'Route READY selecionada pelo menor safe COGS; prioridade resolve apenas empates.',
    strategy:'LOWEST_SAFE_COGS',
  };
}

export const routingV2RouterService={
  async select(input:RoutingV2RouterInput):Promise<RoutingV2RoutingDecision>{
    const modelId=String(input.model_id||'').trim();
    if(!modelId)throw new Error('model_id é obrigatório.');
    const routes=await routingV2RouteService.listReady(modelId,input.capability_id);
    return selectRoutingV2Candidate(routes,{
      exclude_route_ids:input.exclude_route_ids,
      exclude_provider_ids:input.exclude_provider_ids,
      max_safe_cogs_brl:input.max_safe_cogs_brl,
      now:input.now,
    });
  },
};
