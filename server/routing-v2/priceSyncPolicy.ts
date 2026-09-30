import { RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const TRANSIENT_PRICE_FAILURE=/\b1015\b|\b429\b|rate[\s_-]?limit|temporar|timeout|timed out|abort(?:ed|error|ing)?|\b50[234]\b|gateway/i;

export function isTransientRoutingV2PriceFailure(message:string|null|undefined){
  return Boolean(message&&TRANSIENT_PRICE_FAILURE.test(message));
}

const PRICE_RATE_LIMIT_FAILURE=/\b(?:1015|429)\b|rate[\s_-]?limit/i;
const MAX_PRICE_SYNC_COOLDOWN_MS=15*60_000;

export function isRoutingV2PriceRateLimited(message:string|null|undefined){
  return Boolean(message&&PRICE_RATE_LIMIT_FAILURE.test(message));
}

export function routingV2PriceSyncCooldownUntil(
  provider:Pick<RoutingV2Provider,'price_sync_cooldown_failures'>,
  now:string,
  failure:string,
){
  if(!isRoutingV2PriceRateLimited(failure))return null;
  const current=Date.parse(now);
  if(!Number.isFinite(current))return null;
  const failures=Math.max(0,Math.floor(Number(provider.price_sync_cooldown_failures)||0));
  const backoff=Math.min(MAX_PRICE_SYNC_COOLDOWN_MS,60_000*2**Math.min(failures,4));
  const retryAfter=failure.match(/\bRetry-After\s+(.+?)(?=\s·|$)/i)?.[1]?.trim();
  let retryAt:number|null=null;
  if(retryAfter){
    const seconds=Number(retryAfter);
    if(Number.isFinite(seconds)&&seconds>0)retryAt=current+seconds*1000;
    else{
      const date=Date.parse(retryAfter);
      if(Number.isFinite(date)&&date>current)retryAt=date;
    }
  }
  return new Date(Math.max(current+backoff,retryAt||0)).toISOString();
}

export function isRoutingV2PriceSyncCoolingDown(
  provider:Pick<RoutingV2Provider,'price_sync_cooldown_until'>,
  now:string,
){
  const until=Date.parse(provider.price_sync_cooldown_until||''),current=Date.parse(now);
  return Number.isFinite(until)&&Number.isFinite(current)&&until>current;
}

export function hasFreshRoutingV2ProviderHealth(provider:Pick<RoutingV2Provider,'health_status'|'last_health_check_at'>,now:string,maxAgeMinutes:number){
  const checkedAt=Date.parse(provider.last_health_check_at||''),current=Date.parse(now),maxAge=Math.max(1,maxAgeMinutes)*60_000;
  return provider.health_status!=='UNKNOWN'&&Number.isFinite(checkedAt)&&Number.isFinite(current)
    &&checkedAt<=current&&current-checkedAt<maxAge;
}

export function hasFreshRoutingV2PriceSnapshot(route:RoutingV2ProviderRoute,now:string){
  const snapshot=route.pricing_snapshot;
  if(!snapshot||!snapshot.source_reference?.trim())return false;
  if(snapshot.billing_config.type!==route.billing_type||route.billing_config.type!==route.billing_type)return false;
  const current=Date.parse(now),expiry=Date.parse(snapshot.valid_until),fetched=Date.parse(snapshot.fetched_at);
  return Number.isFinite(current)&&Number.isFinite(expiry)&&Number.isFinite(fetched)
    &&expiry>current&&fetched<=current
    &&Number.isFinite(snapshot.provider_cost_reference)&&snapshot.provider_cost_reference>0
    &&Number.isFinite(snapshot.safe_cogs_brl)&&Number(snapshot.safe_cogs_brl)>0
    &&Number.isFinite(snapshot.retail_price_credits)&&Number(snapshot.retail_price_credits)>0
    &&Number.isFinite(snapshot.expected_margin_percent)&&Number(snapshot.expected_margin_percent)>=0;
}

export function canReuseRoutingV2PriceAfterTransientFailure(route:RoutingV2ProviderRoute,now:string,failure:string|null|undefined){
  if(!isTransientRoutingV2PriceFailure(failure)||!hasFreshRoutingV2PriceSnapshot(route,now))return false;
  if(route.pricing_status==='CURRENT')return !route.last_sync_error||isTransientRoutingV2PriceFailure(route.last_sync_error);
  if(route.pricing_status!=='INVALID'||!isTransientRoutingV2PriceFailure(route.last_sync_error))return false;
  const quoteAt=Date.parse(route.pricing_snapshot!.fetched_at),errorAt=Date.parse(route.last_sync_error_at||'');
  return Number.isFinite(errorAt)&&errorAt>=quoteAt;
}

export function shouldReuseRoutingV2PriceSnapshot(route:RoutingV2ProviderRoute,now:string,retryAfterMinutes:number){
  if(!hasFreshRoutingV2PriceSnapshot(route,now))return false;
  if(route.pricing_status!=='CURRENT'&&route.pricing_status!=='INVALID')return false;
  if(!isTransientRoutingV2PriceFailure(route.last_sync_error))return false;
  const quoteAt=Date.parse(route.pricing_snapshot!.fetched_at),errorAt=Date.parse(route.last_sync_error_at||''),current=Date.parse(now);
  const retryAfter=Math.max(1,retryAfterMinutes)*60_000;
  return Number.isFinite(quoteAt)&&Number.isFinite(errorAt)&&Number.isFinite(current)
    &&errorAt>=quoteAt&&errorAt<=current&&current-errorAt<retryAfter;
}

export function shouldSkipRoutingV2PriceRefresh(route:RoutingV2ProviderRoute,now:string,refreshIntervalMinutes:number){
  if(route.pricing_status!=='CURRENT'||route.last_sync_error)return false;
  if(!hasFreshRoutingV2PriceSnapshot(route,now))return false;
  const quoteAt=Date.parse(route.pricing_snapshot!.fetched_at),current=Date.parse(now);
  const refreshInterval=Math.max(1,refreshIntervalMinutes)*60_000;
  return Number.isFinite(quoteAt)&&Number.isFinite(current)
    &&quoteAt<=current&&current-quoteAt<refreshInterval;
}
