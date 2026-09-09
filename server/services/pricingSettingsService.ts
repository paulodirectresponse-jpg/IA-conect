import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export interface PricingSettings {
  gross_margin_percent:number;
  updated_at:string;
  updated_by?:string;
}

const DOC='app_config/pricing';
const DEFAULT_MARGIN_PERCENT=40;
let cache:PricingSettings|null=null;
let cacheAt=0;
// Keep this deliberately short: Cloudflare isolates do not share memory. A short
// cache gives the pricing engine fast reads while propagating admin changes site-wide.
const CACHE_MS=5_000;

function sanitizeMargin(value:number){
  if(!Number.isFinite(value)) return DEFAULT_MARGIN_PERCENT;
  return Math.min(80,Math.max(10,Math.round(value*100)/100));
}

export const pricingSettingsService={
  async get(force=false):Promise<PricingSettings>{
    if(!force&&cache&&Date.now()-cacheAt<CACHE_MS)return cache;
    try{
      const doc=await firestoreAdminRest.get(DOC);
      if(doc.exists){
        const raw=doc.data as any;
        cache={gross_margin_percent:sanitizeMargin(Number(raw?.gross_margin_percent)),updated_at:String(raw?.updated_at||new Date(0).toISOString()),updated_by:raw?.updated_by};
      }else{
        cache={gross_margin_percent:DEFAULT_MARGIN_PERCENT,updated_at:new Date(0).toISOString()};
      }
    }catch{
      cache={gross_margin_percent:DEFAULT_MARGIN_PERCENT,updated_at:new Date(0).toISOString()};
    }
    cacheAt=Date.now();
    return cache;
  },
  async set(grossMarginPercent:number,updatedBy?:string):Promise<PricingSettings>{
    const next:PricingSettings={gross_margin_percent:sanitizeMargin(grossMarginPercent),updated_at:new Date().toISOString(),updated_by:updatedBy};
    await firestoreAdminRest.set(DOC,next);
    cache=next;cacheAt=Date.now();
    return next;
  },
  invalidate(){cache=null;cacheAt=0;},
};