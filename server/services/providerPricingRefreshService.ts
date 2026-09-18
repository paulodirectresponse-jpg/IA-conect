import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerPricingCatalogService, ProviderPricingRule, ProviderPricingUnit } from './providerPricingCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { pricingCapabilities, routePricingProfile } from './routePricingProfileService.js';

const LIVE_PROVIDERS=new Set(['provider-wavespeed','provider-atlas']);
const timeoutMs=6000;
async function getJson(url:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const res=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});if(!res.ok)return null;return await res.json();}catch{return null;}finally{clearTimeout(timer);}}

function strictOverviewRule(value:any):{unit:ProviderPricingUnit;unit_price_usd:number}|null{
  const text=String(value?.pricingOverview||value?.pricing_overview||'').trim();
  if(!text||/[~–—]|\bfrom\b|\bto\b|\bMP\b|megapixel|token/i.test(text))return null;
  const m=text.match(/^\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(image|output|request|second|sec|s|minute|min|1k\s*characters?|1000\s*characters?)$/i);
  if(!m)return null;const price=Number(m[1]);if(!Number.isFinite(price)||price<0)return null;
  const raw=m[2].toLowerCase();
  if(raw==='image'||raw==='output')return{unit:'OUTPUT',unit_price_usd:price};
  if(raw==='request')return{unit:'REQUEST',unit_price_usd:price};
  if(raw==='second'||raw==='sec'||raw==='s')return{unit:'SECOND',unit_price_usd:price};
  if(raw==='minute'||raw==='min')return{unit:'MINUTE',unit_price_usd:price};
  if(raw.includes('character'))return{unit:'CHARACTER',unit_price_usd:price/1000};
  return null;
}

function normalizeUnitPrice(total:number,unit:ProviderPricingUnit,quantity:number){return quantity>0&&['CHARACTER','SECOND','MINUTE'].includes(unit)?total/quantity:total;}

export interface PricingRefreshSummary{checked:number;updated:number;failed:number;skipped:number;errors:Array<{provider_id:string;model_id:string;capability_id:string;error:string}>;}

export const providerPricingRefreshService={
 async refreshActiveRoutes():Promise<PricingRefreshSummary>{
  const[models,mappings,providers]=await Promise.all([catalogRepository.listModels(),catalogRepository.listMappings(),providerCatalogService.listProviders()]);
  const modelById=new Map(models.map(model=>[model.model_id,model])),providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
  const configured=new Map(providerRegistry.listAdapters().map(adapter=>[String(adapter.providerId),adapter.isConfigured()]));
  const summary:PricingRefreshSummary={checked:0,updated:0,failed:0,skipped:0,errors:[]};
  const tasks:Array<()=>Promise<void>>=[];
  for(const mapping of mappings.filter(row=>row.status==='ACTIVE')){
   const model=modelById.get(mapping.model_id),provider=providerById.get(String(mapping.provider_id));
   if(!model||!provider||provider.status!=='ACTIVE'||!configured.get(String(mapping.provider_id))){summary.skipped++;continue;}
   for(const capabilityId of pricingCapabilities(model,mapping)){
    const profile=routePricingProfile(model,mapping,capabilityId);if(!profile){summary.skipped++;continue;}
    tasks.push(async()=>{
     summary.checked++;const providerId=String(mapping.provider_id),adapter=providerRegistry.getAdapter(providerId);
     try{
      let rule:Omit<ProviderPricingRule,'pricing_id'|'updated_at'>|null=null;
      if(LIVE_PROVIDERS.has(providerId)&&adapter?.quoteCostUsd&&adapter.supports(model.model_id,profile.mode,mapping.provider_model_identifier)){
       const quote=await adapter.quoteCostUsd(profile.params);const total=Number(quote.effective_price_usd);
       if(Number.isFinite(total)&&total>=0)rule={provider_id:providerId,provider_model_identifier:mapping.provider_model_identifier,capability_id:capabilityId,unit:profile.pricing_unit,unit_price_usd:normalizeUnitPrice(total,profile.pricing_unit,profile.baseline_quantity),minimum_usd:null,verified:true,source:'LIVE_CATALOG',quote_mode:'LIVE_PROVIDER',base_price_usd:total,verified_at:new Date().toISOString()};
      }else if(providerId==='provider-runware'){
       const metadata=await getJson('https://content.runware.ai/models/'+encodeURIComponent(mapping.provider_model_identifier)+'/pricing');
       const normalized=strictOverviewRule(metadata);
       if(normalized)rule={provider_id:providerId,provider_model_identifier:mapping.provider_model_identifier,capability_id:capabilityId,unit:normalized.unit,unit_price_usd:normalized.unit_price_usd,minimum_usd:null,verified:true,source:'LIVE_CATALOG',quote_mode:'STATIC_RULE',base_price_usd:null,verified_at:new Date().toISOString()};
      }
      if(rule){await providerPricingCatalogService.save(rule);summary.updated++;}else summary.skipped++;
     }catch(err:any){summary.failed++;summary.errors.push({provider_id:String(mapping.provider_id),model_id:model.model_id,capability_id:capabilityId,error:err?.message||'Falha ao atualizar preço.'});}
    });
   }
  }
  let cursor=0;async function worker(){while(true){const index=cursor++;if(index>=tasks.length)return;await tasks[index]();}}
  await Promise.all(Array.from({length:Math.min(3,tasks.length||1)},()=>worker()));
  return summary;
 }
};