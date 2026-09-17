import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { providerCatalogService } from './providerCatalogService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';

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
  candidates:ProviderScanCandidate[];
  warning?:string|null;
  error?:string|null;
  scanned_at:string;
}

const timeout=15_000;
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
  const key=String(process.env.AIML_API_KEY||'').trim();const headers:keyof any=undefined as any;
  const body=await json(`${trim(process.env.AIML_BASE_URL,'https://api.aimlapi.com')}/models`,{headers:key?{Authorization:`Bearer ${key}`,Accept:'application/json'}:{Accept:'application/json'}});
  const rows=body?.data??body?.models??body??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-aiml',r.id??r.model,r.name??r.info?.name,r)));
}
async function replicate():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.REPLICATE_API_TOKEN||'').trim();if(!key)return[];
  const body=await json(`${trim(process.env.REPLICATE_BASE_URL,'https://api.replicate.com/v1')}/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const rows=body?.results??body?.data??[];return uniq((Array.isArray(rows)?rows:[]).map((r:any)=>candidate('provider-replicate',r.owner&&r.name?`${r.owner}/${r.name}`:r.id,r.name,r)));
}
async function runware():Promise<ProviderScanCandidate[]>{
  const key=String(process.env.RUNWARE_API_KEY||'').trim();if(!key)return[];
  const root=trim(process.env.RUNWARE_BASE_URL,'https://api.runware.ai/v1');
  const queries=['nano banana','flux','seedream','gpt image','veo','seedance','wan','kling','minimax','elevenlabs','trellis','hunyuan','rodin','meshy','tripo'];
  const rows:ProviderScanCandidate[]=[];
  for(const search of queries){
    const taskUUID=crypto.randomUUID();const body=await json(root,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([{taskType:'modelSearch',taskUUID,search,visibility:'public',limit:100,offset:0}])});
    const found=body?.data?.[0]?.results??[];for(const r of found){const item=candidate('provider-runware',r.air,r.name,r);if(item)rows.push(item);}
  }
  return uniq(rows);
}
async function atlasMappings(){const rows=await catalogRepository.listMappings();return uniq(rows.filter(r=>r.provider_id==='provider-atlas').map(r=>candidate('provider-atlas',r.provider_model_identifier,r.provider_model_identifier,{capabilities:r.capabilities||[]})));}
async function curatedMappings(providerId:string){const rows=await catalogRepository.listMappings();return uniq(rows.filter(r=>r.provider_id===providerId).map(r=>candidate(providerId,r.provider_model_identifier,r.provider_model_identifier,{capabilities:r.capabilities||[]})));}

const modes:Record<string,ProviderDiscoveryMode>={
  'provider-wavespeed':'CATALOG_API','provider-runware':'SEARCH_API','provider-deepinfra':'CATALOG_API','provider-replicate':'CATALOG_API','provider-aiml':'CATALOG_API',
  'provider-atlas':'CURATED_REQUIRED','provider-fal':'CURATED_REQUIRED','provider-piapi':'CURATED_REQUIRED','provider-kie':'CURATED_REQUIRED',
};
async function discover(providerId:string){
  if(providerId==='provider-wavespeed')return wavespeed();if(providerId==='provider-runware')return runware();if(providerId==='provider-deepinfra')return deepinfra();if(providerId==='provider-replicate')return replicate();if(providerId==='provider-aiml')return aiml();if(providerId==='provider-atlas')return atlasMappings();return curatedMappings(providerId);
}

export const providerModelScanService={
  async scanProvider(providerId:string):Promise<ProviderScanResult>{
    const provider=await providerCatalogService.getProvider(providerId);if(!provider)throw Object.assign(new Error('Provider desconhecido.'),{code:'PROVIDER_NOT_FOUND'});
    const adapter=providerRegistry.getAdapter(providerId),configured=Boolean(adapter?.isConfigured()),mode=modes[providerId]||'CURATED_REQUIRED',scanId=`scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    let candidates:ProviderScanCandidate[]=[],error:string|null=null,warning:string|null=null;
    if(!configured&&mode!=='CURATED_REQUIRED')warning='API key ausente; catálogo autenticado não foi consultado.';
    try{candidates=await discover(providerId);}catch(err:any){error=err?.message||'Falha ao consultar catálogo do provider.';}
    if(mode==='CURATED_REQUIRED')warning='Este provider não expõe uma listagem pública estável suficiente para ativação automática. O scan usa mappings curados e exige validação de schema/preço por modelo.';
    const result:ProviderScanResult={scan_id:scanId,provider_id:providerId,provider_name:provider.name,configured,discovery_mode:mode,candidate_count:candidates.length,candidates,warning,error,scanned_at:new Date().toISOString()};
    await firestoreAdminRest.set(`provider_scan_runs/${encodeURIComponent(scanId)}`,result).catch(()=>{});
    await firestoreAdminRest.set(`provider_scan_latest/${encodeURIComponent(providerId)}`,result).catch(()=>{});
    return result;
  },
  async scanAll(){const providers=await providerCatalogService.listProviders();const out:ProviderScanResult[]=[];for(const provider of providers)out.push(await this.scanProvider(provider.provider_id));return out;},
  async latest(){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'provider_scan_latest'}],limit:50}).catch(()=>[] as any[]);return rows.map((r:any)=>r.data as ProviderScanResult);},
};
