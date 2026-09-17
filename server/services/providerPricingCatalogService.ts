import { ProviderCostQuote, ProviderGenerationParams } from '../adapters/videoProviderAdapter.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

export type ProviderPricingUnit='REQUEST'|'OUTPUT'|'SECOND'|'MINUTE'|'CHARACTER';

export interface ProviderPricingRule{
  pricing_id:string;
  provider_id:string;
  provider_model_identifier:string;
  capability_id?:string|null;
  unit:ProviderPricingUnit;
  unit_price_usd:number;
  minimum_usd?:number|null;
  resolution_prices_usd?:Record<string,number>;
  verified:boolean;
  source:'LIVE_CATALOG'|'PROVIDER_DOCS'|'MANUAL_VERIFIED';
  verified_at:string;
  updated_at:string;
}

const safe=(value:string)=>encodeURIComponent(value);
const cache=new Map<string,{expiresAt:number;value:ProviderPricingRule|null}>();
const TTL_MS=60_000;

function pricingId(providerId:string,model:string,capability?:string){
  return `${providerId}__${model}__${capability||'default'}`;
}

async function readRule(providerId:string,model:string,capability?:string):Promise<ProviderPricingRule|null>{
  const ids=[pricingId(providerId,model,capability),pricingId(providerId,model)];
  for(const id of ids){
    const hit=cache.get(id);
    if(hit&&hit.expiresAt>Date.now()){if(hit.value)return hit.value;continue;}
    const row=await firestoreAdminRest.get(`provider_pricing/${safe(id)}`).catch(()=>({exists:false,data:null} as any));
    const value=row.exists?(row.data as ProviderPricingRule):null;
    cache.set(id,{expiresAt:Date.now()+TTL_MS,value});
    if(value)return value;
  }
  return null;
}

function quantity(rule:ProviderPricingRule,params:ProviderGenerationParams){
  const outputs=Math.max(1,Number(params.number_of_outputs||1));
  if(rule.unit==='OUTPUT')return outputs;
  if(rule.unit==='SECOND')return Math.max(1,Number(params.duration_seconds||1))*outputs;
  if(rule.unit==='MINUTE')return Math.max(1,Number(params.duration_seconds||1))/60*outputs;
  if(rule.unit==='CHARACTER')return Math.max(1,String(params.prompt||'').length)*outputs;
  return outputs;
}

export const providerPricingCatalogService={
  pricingId,
  async get(providerId:string,model:string,capability?:string){return readRule(providerId,model,capability);},
  async getVerified(providerId:string,model:string,capability?:string){const rule=await readRule(providerId,model,capability);return rule?.verified?rule:null;},
  async quote(providerId:string,params:ProviderGenerationParams):Promise<ProviderCostQuote>{
    const model=String(params.provider_model_identifier||'').trim();
    if(!model)throw Object.assign(new Error('Mapping do provider não possui identificador de modelo.'),{code:'PROVIDER_MAPPING_INVALID'});
    const rule=await readRule(providerId,model,String(params.capability_id||''));
    if(!rule||!rule.verified)throw Object.assign(new Error('Preço do provider ainda não foi verificado para este modelo/capability.'),{code:'PROVIDER_PRICE_UNVERIFIED'});
    const resolution=String(params.resolution||'');
    const resolutionPrice=rule.resolution_prices_usd?.[resolution]??rule.resolution_prices_usd?.[resolution.toLowerCase()];
    const unitPrice=Number.isFinite(Number(resolutionPrice))?Number(resolutionPrice):Number(rule.unit_price_usd);
    if(!Number.isFinite(unitPrice)||unitPrice<0)throw Object.assign(new Error('Regra de preço inválida.'),{code:'PROVIDER_PRICE_INVALID'});
    const effective=Math.max(Number(rule.minimum_usd||0),unitPrice*quantity(rule,params));
    return{effective_price_usd:effective,estimated:rule.source!=='LIVE_CATALOG',source:rule.source==='MANUAL_VERIFIED'?'MANUAL':'CATALOG'};
  },
  async save(rule:Omit<ProviderPricingRule,'pricing_id'|'updated_at'>){
    const id=pricingId(rule.provider_id,rule.provider_model_identifier,String(rule.capability_id||''));
    const next:ProviderPricingRule={...rule,pricing_id:id,updated_at:new Date().toISOString()};
    await firestoreAdminRest.set(`provider_pricing/${safe(id)}`,next);
    cache.delete(id);
    return next;
  },
  async list(limit=500){
    const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'provider_pricing'}],limit}).catch(()=>[] as any[]);
    return rows.map((row:any)=>row.data as ProviderPricingRule);
  },
  clearCache(){cache.clear();},
};
