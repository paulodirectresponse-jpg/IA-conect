import { VideoProviderAdapter } from '../adapters/videoProviderAdapter.js';
import { pricingGuardService, PricingGuardInput, SafeProviderQuote } from './pricingGuardService.js';
import { pricingSettingsService } from './pricingSettingsService.js';

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string,{expires_at:number;value:SafeProviderQuote}>();

function ttlMs(){
  const raw=Number(process.env.PRICING_QUOTE_CACHE_MINUTES || 30);
  const minutes=Number.isFinite(raw)?Math.min(120,Math.max(1,raw)):30;
  return minutes*60*1000;
}
function stableOptions(v:Record<string,any>={}){return JSON.stringify(Object.keys(v).sort().reduce((o,k)=>{if(v[k]!==undefined)o[k]=v[k];return o;},{} as Record<string,any>));}
function keyFor(adapter:VideoProviderAdapter,input:PricingGuardInput,marginPercent:number){
  return [
    adapter.providerId,input.model_id,input.mode,input.resolution,input.duration_seconds,input.aspect_ratio,input.number_of_outputs,
    input.seed ?? '',input.motion_strength ?? '',input.audio_enabled===undefined?'':input.audio_enabled?'audio-1':'audio-0',input.model_variant||'default',stableOptions(input.pricing_options||{}),`margin-${marginPercent}`,
  ].join(':');
}

export const quoteCacheService={
  async getOrQuote(adapter:VideoProviderAdapter,input:PricingGuardInput,force=false){
    const settings=await pricingSettingsService.get(false);
    const key=keyFor(adapter,input,settings.gross_margin_percent);
    const now=Date.now();
    const hit=cache.get(key);
    if(!force&&hit&&hit.expires_at>now)return {...hit.value,quoted_at:hit.value.quoted_at};
    const quote=await pricingGuardService.quote(adapter,input);
    cache.set(key,{expires_at:now+ttlMs(),value:quote});
    return quote;
  },
  invalidateAll(){cache.clear();},
  size(){return cache.size;},
  ttl_ms(){return ttlMs()||DEFAULT_TTL_MS;},
};
