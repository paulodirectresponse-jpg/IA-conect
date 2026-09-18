import crypto from 'crypto';
import { ProviderModelMapping, ProviderRegistryItem } from '../../src/types/index.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { curatedModelMatchService, ProviderModelMatchProposal } from './curatedModelMatchService.js';
import { providerPricingCatalogService } from './providerPricingCatalogService.js';

export type ProviderDiscoveryMode='CATALOG_API'|'SEARCH_API'|'CURATED_REQUIRED';
export interface ProviderScanCandidate{
  provider_id:string;
  provider_model_identifier:string;
  name:string;
  category?:string|null;
  capabilities?:string[];
  pricing?:unknown;
  metadata?:Record<string,unknown>;
}
export interface ProviderScanResult{
  scan_id:string;
  provider_id:string;
  provider_name:string;
  configured:boolean;
  discovery_mode:ProviderDiscoveryMode;
  candidate_count:number;
  candidate_sample_count:number;
  candidates:ProviderScanCandidate[];
  matched_count:number;
  matches:ProviderModelMatchProposal[];
  pricing_synced_count?:number;
  pricing_sync_error?:string|null;
  warning?:string|null;
  error?:string|null;
  scanned_at:string;
}

const timeout=6_000;
const RAW_SAMPLE_LIMIT=125;
function trim(v:string|undefined,fallback:string){return String(v||fallback).replace(/\/+$/,'');}
async function json(url:string,init:RequestInit={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const res=await fetch(url,{...init,signal:controller.signal});const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}if(!res.ok)throw new Error(body?.error?.message||body?.message||body?.detail||`HTTP ${res.status}`);return body;}finally{clearTimeout(timer);}
}
function candidate(providerId:string,id:any,name:any,raw:any):ProviderScanCandidate|null{
  const identifier=String(id||'').trim();if(!identifier)return null;
  const capabilities=Array.isArray(raw?.capabilities)?raw.capabilities.map(String):Array.isArray(raw?.features)?raw.features.map(String):undefined;
  return{provider_id:providerId,provider_model_identifier:identifier,name:String(name||identifier),category:String(raw?.type||raw?.category||raw?.kind||'')||null,capabilities,pricing:raw?.pricing??raw?.price??raw?.base_price,metadata:{deprecated:Boolean(raw?.deprecated),replaced_by:raw?.replaced_by??null,source:raw?.source??null}};
}
function uniq(rows:(ProviderScanCandidate|null)[]){const map=new Map<string,ProviderScanCandidate>();for(const row of rows)if(row&&!map.has(row.provider_model_identifier))map.set(row.provider_model_identifier,row);return Array.from(map.values());}

function numericPrice(value:unknown){
  if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return value;
  if(typeof value==='string'&&value.trim()&&Number.isFinite(Number(value)))return Number(value);
  if(value&&typeof value==='object'){
    const row=value as any;
    for(const key of ['discounted_price','price','base_price','unit_price','amount']){
      const parsed=numericPrice(row?.[key]);
      if(parsed!==null)return parsed;
    }
  }
  return null;
}

async function syncAuthoritativePricing(providerId:string,candidates:ProviderScanCandidate[],matches:ProviderModelMatchProposal[],mappings:ProviderModelMapping[]){
  if(providerId==='provider-wavespeed'){
    const byIdentifier=new Map(candidates.map(row=>[row.provider_model_identifier,row]));
    const rules=matches.flatMap(match=>{
      const candidate=byIdentifier.get(match.provider_model_identifier);
      const basePrice=numericPrice(candidate?.pricing);
      if(basePrice===null)return[];
      return [{
        provider_id:providerId,
        provider_model_identifier:match.provider_model_identifier,
        capability_id:match.capability_id||null,
        unit:'REQUEST' as const,
        unit_price_usd:basePrice,
        minimum_usd:null,
        verified:true,
        source:'LIVE_CATALOG' as const,
        quote_mode:'LIVE_PROVIDER' as const,
        base_price_usd:basePrice,
        verified_at:new Date().toISOString(),
      }];
    });
    const unique=new Map(rules.map(rule=>[`${rule.provider_id}|${rule.provider_model_identifier}|${rule.capability_id||''}`,rule]));
    return providerPricingCatalogService.saveMany([...unique.values()]);
  }

  if(providerId==='provider-atlas'){
    const rules=mappings.filter(mapping=>mapping.provider_id===providerId&&mapping.status==='ACTIVE').flatMap(mapping=>
      (mapping.capabilities?.length?mapping.capabilities:[null]).map(capability=>({
        provider_id:providerId,
        provider_model_identifier:mapping.provider_model_identifier,
        capability_id:capability||null,
        unit:'REQUEST' as const,
        unit_price_usd:0,
        minimum_usd:null,
        verified:true,
        source:'LIVE_CATALOG' as const,
        quote_mode:'LIVE_PROVIDER' as const,
        base_price_usd:null,
        verified_at:new Date().toISOString(),
      }))
    );
    const unique=new Map(rules.map(rule=>[`${rule.provider_id}|${rule.provider_model_identifier}|${rule.capability_id||''}`,rule]));
    return providerPricingCatalogService.saveMany([...unique.values()]);
  }

  return[];
}


async function wavespeed():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.WAVESPEED_API_KEY||'').trim();if(!key)return[];
  const root=trim(process.env.WAVESPEED_BASE_URL,'https://api.wavespeed.ai').replace(/\/api\/v3$/,'');
  const body=await json(`${root}/api/v3/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const rows=body?.data?.models??body?.data??body?.models??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-wavespeed',r.model_id??r.id,r.name,r)));
}
async function deepinfra():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.DEEPINFRA_API_KEY||'').trim();if(!key)return[];
  const body=await json(`${trim(process.env.DEEPINFRA_BASE_URL,'https://api.deepinfra.com')}/models/list`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const rows=body?.data??body?.models??body??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-deepinfra',r.model_name??r.id,r.display_name??r.name,r)));
}
async function aiml():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.AIML_API_KEY||'').trim();if(!key)return[];
  const body=await json(`${trim(process.env.AIML_BASE_URL,'https://api.aimlapi.com')}/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const rows=body?.data??body?.models??body??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-aiml',r.id??r.model,r.name??r.info?.name,r)));
}
async function replicate():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.REPLICATE_API_TOKEN||'').trim();if(!key)return[];
  const body=await json(`${trim(process.env.REPLICATE_BASE_URL,'https://api.replicate.com/v1')}/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const rows=body?.results??body?.data??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-replicate',r.owner&&r.name?`${r.owner}/${r.name}`:r.id,r.name,r)));
}

async function runwareSearch(root:string,key:string,search:string):Promise<ProviderScanCandidate[]>{
  const taskUUID=crypto.randomUUID();
  const body=await json(root,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([{taskType:'modelSearch',taskUUID,search,visibility:'public',limit:100,offset:0}])});
  const found=body?.data?.[0]?.results??[];
  return uniq((Array.isArray(found)?found:[]).map((r:any)=>candidate('provider-runware',r.air,r.name,r)));
}
async function runware():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.RUNWARE_API_KEY||'').trim();if(!key)return[];
  const root=trim(process.env.RUNWARE_BASE_URL,'https://api.runware.ai/v1');
  const queries=[
    'nano banana','flux','seedream','gpt image','qwen image','recraft','grok imagine',
    'veo','seedance','wan','kling','minimax','runway','luma',
    'elevenlabs','music','3d',
  ];
  const rows:ProviderScanCandidate[]=[];
  const BATCH=6;
  for(let index=0;index<queries.length;index+=BATCH){
    const chunk=queries.slice(index,index+BATCH);
    const results=await Promise.allSettled(chunk.map(search=>runwareSearch(root,key,search)));
    for(const result of results)if(result.status==='fulfilled')rows.push(...result.value);
  }
  return uniq(rows);
}

function mappingCandidates(providerId:string,mappings:ProviderModelMapping[]){
  return uniq(mappings.filter(r=>r.provider_id===providerId).map(r=>candidate(providerId,r.provider_model_identifier,r.provider_model_identifier,{capabilities:r.capabilities||[]})));
}

const modes:Record<string,ProviderDiscoveryMode>={
  'provider-wavespeed':'CATALOG_API','provider-runware':'SEARCH_API','provider-deepinfra':'CATALOG_API','provider-replicate':'CATALOG_API','provider-aiml':'CATALOG_API',
  'provider-atlas':'CURATED_REQUIRED','provider-fal':'CURATED_REQUIRED','provider-piapi':'CURATED_REQUIRED','provider-kie':'CURATED_REQUIRED',
};
async function discover(providerId:string,mappings:ProviderModelMapping[]){
  if(providerId==='provider-wavespeed')return wavespeed();
  if(providerId==='provider-runware')return runware();
  if(providerId==='provider-deepinfra')return deepinfra();
  if(providerId==='provider-replicate')return replicate();
  if(providerId==='provider-aiml')return aiml();
  return mappingCandidates(providerId,mappings);
}

async function buildScan(provider:ProviderRegistryItem,mappings:ProviderModelMapping[],persistHistory:boolean):Promise<ProviderScanResult>{
  const providerId=provider.provider_id;
  const adapter=providerRegistry.getAdapter(providerId),configured=Boolean(adapter?.isConfigured()),mode=modes[providerId]||'CURATED_REQUIRED',scanId=`scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  let allCandidates:ProviderScanCandidate[]=[],error:string|null=null;
  const warnings:string[]=[];
  if(!configured)warnings.push('API key ausente; o provider ainda não pode ser validado com credenciais reais.');
  try{allCandidates=await discover(providerId,mappings);}catch(err:any){error=err?.name==='AbortError'?'Timeout ao consultar catálogo do provider.':err?.message||'Falha ao consultar catálogo do provider.';}
  const matches=await curatedModelMatchService.propose(providerId,allCandidates,mappings);
  let pricingSyncedCount=0,pricingSyncError:string|null=null;
  if(configured&&!error){
    try{pricingSyncedCount=(await syncAuthoritativePricing(providerId,allCandidates,matches,mappings)).length;}
    catch(err:any){pricingSyncError=err?.message||'Falha ao sincronizar preços do catálogo.';}
  }
  if(mode==='CURATED_REQUIRED')warnings.push('Este provider exige curadoria de endpoint. O scan reutiliza mappings aprovados; novos mappings exigem identificador explícito, schema/capability e preço verificados.');
  if(providerId==='provider-runware')warnings.push('A busca pública da Runware não fornece preço pré-execução. O scan descobre modelos e capabilities, mas o preço continua pendente até validação específica.');
  if(pricingSyncedCount)warnings.push(`${pricingSyncedCount} preço(s) autoritativo(s) sincronizado(s) automaticamente.`);
  if(pricingSyncError)warnings.push(`Pricing sync: ${pricingSyncError}`);
  const candidates=allCandidates.slice(0,RAW_SAMPLE_LIMIT);
  const result:ProviderScanResult={scan_id:scanId,provider_id:providerId,provider_name:provider.name,configured,discovery_mode:mode,candidate_count:allCandidates.length,candidate_sample_count:candidates.length,candidates,matched_count:matches.length,matches,pricing_synced_count:pricingSyncedCount,pricing_sync_error:pricingSyncError,warning:warnings.length?warnings.join(' '):null,error,scanned_at:new Date().toISOString()};
  if(persistHistory)await firestoreAdminRest.set(`provider_scan_runs/${encodeURIComponent(scanId)}`,result).catch(()=>{});
  await firestoreAdminRest.set(`provider_scan_latest/${encodeURIComponent(providerId)}`,result).catch(()=>{});
  return result;
}

export const providerModelScanService={
  async scanProvider(providerId:string):Promise<ProviderScanResult>{
    const [provider,mappings]=await Promise.all([providerCatalogService.getProvider(providerId),catalogRepository.listMappings()]);
    if(!provider)throw Object.assign(new Error('Provider desconhecido.'),{code:'PROVIDER_NOT_FOUND'});
    return buildScan(provider,mappings,true);
  },
  async scanAll(){
    const [providers,mappings]=await Promise.all([providerCatalogService.listProviders(),catalogRepository.listMappings()]);
    const out:ProviderScanResult[]=[];

    // Runware performs several model-search requests, so it runs alone first.
    const runwareProvider=providers.find(provider=>provider.provider_id==='provider-runware');
    if(runwareProvider)out.push(await buildScan(runwareProvider,mappings,false));

    // The remaining providers are scanned in small batches. Each batch stays
    // below Cloudflare outbound-connection limits while keeping wall time low.
    const remaining=providers.filter(provider=>provider.provider_id!=='provider-runware');
    const BATCH=3;
    for(let index=0;index<remaining.length;index+=BATCH){
      const chunk=remaining.slice(index,index+BATCH);
      const results=await Promise.all(chunk.map(provider=>buildScan(provider,mappings,false)));
      out.push(...results);
    }
    return out;
  },
  async latest(){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'provider_scan_latest'}],limit:50}).catch(()=>[] as any[]);return rows.map((r:any)=>r.data as ProviderScanResult);},
};