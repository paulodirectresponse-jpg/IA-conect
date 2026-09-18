import { providerRegistry } from '../adapters/providerRegistry.js';
import { quoteCacheService } from './quoteCacheService.js';
import { providerFinanceService } from './providerFinanceService.js';
import { fxRateService } from './fxRateService.js';
import { pricingSettingsService } from './pricingSettingsService.js';
import { retailPricingService } from './retailPricingService.js';
import { GenerationMode } from '../../src/types/index.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { pricingSignatureService, PricingSignature } from './pricingSignatureService.js';
import { providerCatalogService } from './providerCatalogService.js';
import { pricingCapabilities, routePricingProfile } from './routePricingProfileService.js';
import { providerPricingRefreshService, PricingRefreshSummary } from './providerPricingRefreshService.js';

export interface PricingHealthRow {key:string;provider_id:string;provider_name:string;provider_model_identifier?:string;model_id:string;capability_id?:string;mode:GenerationMode;duration_seconds:number;resolution:string;provider_cost_usd:number|null;provider_cost_brl_cents:number|null;safe_cost_brl_cents:number|null;fully_loaded_safe_cogs_cents?:number|null;retail_credit_price?:number|null;retail_pricing_version?:number|null;margin_percent:number|null;status:'OK'|'FAILED';checked_at:string;error?:string;pricing_signature_hash?:string;health?:'GREEN'|'YELLOW'|'RED'|'PROBE';pricing_unit?:string;}
export interface PricingHealthSnapshot {snapshot_id?:string;checked_at:string|null;checked:number;healthy:number;failed:number;fx_rate:number|null;fx_source:string|null;cache_ttl_minutes:number;provider_finance:any[];rows:PricingHealthRow[];signatures_checked?:number;normal_floor_margin_percent?:number;emergency_floor_margin_percent?:number;conservative_credit_value_micros?:number;route_refresh?:PricingRefreshSummary|null;}
const LATEST_DOC='app_config/pricing_health_latest',HISTORY_COLLECTION='pricing_health_snapshots';
let latestSnapshot:PricingHealthSnapshot={checked_at:null,checked:0,healthy:0,failed:0,fx_rate:null,fx_source:null,cache_ttl_minutes:30,provider_finance:[],rows:[]};

async function activeRetail(){
  await retailPricingService.migrateAllLegacy().catch(()=>({migrated:0}));
  const pointers=await firestoreAdminRest.runQuery({from:[{collectionId:'retail_pricing_active'}]}).catch(()=>[]);
  const out=new Map<string,{signature:PricingSignature;price:number;version:number}>();
  for(const p of pointers){const hash=String(p.data?.pricing_signature_hash||''),version=Number(p.data?.version||0);if(!hash||!version)continue;const d=await firestoreAdminRest.get('retail_pricing_versions/'+encodeURIComponent(hash)+'_v'+version).catch(()=>({exists:false}as any));if(d.exists&&d.data?.signature)out.set(hash,{signature:d.data.signature as PricingSignature,price:Number(d.data.retail_credit_price||0),version});}
  return out;
}
async function mapWithConcurrency<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{const out=new Array<R>(items.length);let cursor=0;async function worker(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i]);}}await Promise.all(Array.from({length:Math.min(limit,items.length||1)},()=>worker()));return out;}
async function persistSnapshot(snapshot:PricingHealthSnapshot){const snapshotId='phs_'+String(snapshot.checked_at||new Date().toISOString()).replace(/[^0-9]/g,'');const stored={...snapshot,snapshot_id:snapshotId};await Promise.all([firestoreAdminRest.set(LATEST_DOC,stored),firestoreAdminRest.set(HISTORY_COLLECTION+'/'+snapshotId,stored)]);return stored;}

function signatureForRoute(profile:ReturnType<typeof routePricingProfile> extends infer T?Exclude<T,null>:never){
  const p=profile.params;
  return pricingSignatureService.create({model_id:p.model_id,mode:p.mode,resolution:p.resolution,duration_seconds:p.mode==='TEXT_TO_SPEECH'?1:p.duration_seconds,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,reference_mode:p.references.length?'reference':'none',reference_count:p.references.length,model_variant:p.model_variant,pricing_options:p.pricing_options});
}

export const pricingSyncService={
 async getLatestSnapshot(){if(latestSnapshot.rows.length)return latestSnapshot;try{const doc=await firestoreAdminRest.get(LATEST_DOC);if(doc.exists&&Array.isArray((doc.data as any)?.rows))latestSnapshot=doc.data as PricingHealthSnapshot;}catch(err:any){console.warn('[PricingHealthLoad]',err?.message||err);}return latestSnapshot;},

 async runHourlySync(){
  const checkedAt=new Date().toISOString();quoteCacheService.invalidateAll();
  const routeRefresh=await providerPricingRefreshService.refreshActiveRoutes().catch((err:any)=>({checked:0,updated:0,failed:1,skipped:0,errors:[{provider_id:'system',model_id:'*',capability_id:'*',error:err?.message||'Falha no refresh de preços.'}]} as PricingRefreshSummary));
  const[fx,providerFinance,active,settings,models,mappings,providers]=await Promise.all([fxRateService.get(true),providerFinanceService.getAll(true).catch(()=>[]),activeRetail(),pricingSettingsService.get(true),catalogRepository.listModels(),catalogRepository.listMappings(),providerCatalogService.listProviders()]);
  const modelById=new Map(models.map(model=>[model.model_id,model])),providerById=new Map(providers.map(provider=>[String(provider.provider_id),provider]));
  const jobs:Array<{adapter:any;providerId:string;providerName:string;providerModelIdentifier:string;profile:NonNullable<ReturnType<typeof routePricingProfile>>;signature:PricingSignature}> = [];
  for(const mapping of mappings.filter(row=>row.status==='ACTIVE')){
    const model=modelById.get(mapping.model_id),provider=providerById.get(String(mapping.provider_id)),adapter=providerRegistry.getAdapter(String(mapping.provider_id));
    if(!model||model.status!=='ACTIVE'||!provider||provider.status!=='ACTIVE'||!adapter?.isConfigured()||!adapter.quoteCostUsd)continue;
    for(const capabilityId of pricingCapabilities(model,mapping)){const profile=routePricingProfile(model,mapping,capabilityId);if(!profile||!adapter.supports(model.model_id,profile.mode,mapping.provider_model_identifier))continue;const signature=signatureForRoute(profile);jobs.push({adapter,providerId:String(mapping.provider_id),providerName:provider.name,providerModelIdentifier:mapping.provider_model_identifier,profile,signature});}
  }
  const rows=await mapWithConcurrency(jobs,3,async(job):Promise<PricingHealthRow>=>{
    const p=job.profile.params,s=job.signature,key=job.providerId+':'+job.providerModelIdentifier+':'+job.profile.capability_id+':'+s.hash;
    try{
      const quote=await quoteCacheService.getOrQuote(job.adapter,{userId:'pricing-health',model_id:p.model_id,mode:p.mode,capability_id:job.profile.capability_id,provider_model_identifier:job.providerModelIdentifier,prompt:p.prompt,duration_seconds:p.duration_seconds,resolution:p.resolution,aspect_ratio:p.aspect_ratio,number_of_outputs:1,audio_enabled:p.audio_enabled,model_variant:p.model_variant,pricing_options:p.pricing_options,provider_references:p.references},false);
      let retail=active.get(s.hash)||null;
      if(!retail){const created=await retailPricingService.resolveOrBootstrap(s,quote.fully_loaded_safe_cogs_cents);retail={signature:s,price:created.retail_credit_price,version:created.version};active.set(s.hash,retail);}
      const backingCents=retail.price?Math.floor(retail.price*settings.conservative_credit_value_micros/10000):0,margin=backingCents>0?100*(1-quote.fully_loaded_safe_cogs_cents/backingCents):null,health=margin==null?'PROBE':margin>=settings.normal_floor_margin_percent?'GREEN':margin>=settings.emergency_floor_margin_percent?'YELLOW':'RED';
      return{key,provider_id:job.providerId,provider_name:job.providerName,provider_model_identifier:job.providerModelIdentifier,model_id:p.model_id,capability_id:job.profile.capability_id,mode:p.mode,duration_seconds:p.duration_seconds,resolution:p.resolution,provider_cost_usd:quote.provider_cost_usd,provider_cost_brl_cents:quote.provider_cost_brl_cents,safe_cost_brl_cents:quote.safe_cost_brl_cents,fully_loaded_safe_cogs_cents:quote.fully_loaded_safe_cogs_cents,retail_credit_price:retail.price,retail_pricing_version:retail.version,margin_percent:margin,status:'OK',health,checked_at:checkedAt,pricing_signature_hash:s.hash,pricing_unit:job.profile.pricing_unit};
    }catch(err:any){return{key,provider_id:job.providerId,provider_name:job.providerName,provider_model_identifier:job.providerModelIdentifier,model_id:p.model_id,capability_id:job.profile.capability_id,mode:p.mode,duration_seconds:p.duration_seconds,resolution:p.resolution,provider_cost_usd:null,provider_cost_brl_cents:null,safe_cost_brl_cents:null,fully_loaded_safe_cogs_cents:null,retail_credit_price:null,retail_pricing_version:null,margin_percent:null,status:'FAILED',health:'RED',checked_at:checkedAt,error:err?.message||'Provider não retornou cotação válida.',pricing_signature_hash:s.hash,pricing_unit:job.profile.pricing_unit};}
  });
  latestSnapshot={checked_at:checkedAt,checked:rows.length,healthy:rows.filter(r=>r.status==='OK'&&r.health!=='RED').length,failed:rows.filter(r=>r.status==='FAILED'||r.health==='RED').length,fx_rate:fx.rate,fx_source:fx.source,cache_ttl_minutes:Math.round(quoteCacheService.ttl_ms()/60000),provider_finance:providerFinance,rows,signatures_checked:new Set(rows.map(r=>r.pricing_signature_hash).filter(Boolean)).size,normal_floor_margin_percent:settings.normal_floor_margin_percent,emergency_floor_margin_percent:settings.emergency_floor_margin_percent,conservative_credit_value_micros:settings.conservative_credit_value_micros,route_refresh:routeRefresh};
  try{latestSnapshot=await persistSnapshot(latestSnapshot);}catch(err:any){console.error('[PricingHealthPersist]',err?.message||err);}return latestSnapshot;
 }
};