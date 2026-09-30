import { assetRepository } from '../repositories/assetRepository.js';
import { Asset, StorageDiagnosticResult } from '../../src/types/index.js';
import { hasR2AssetBucket, publicAssetKeyFromPath, publicAssetUrl, r2AssetStorageService } from './r2AssetStorageService.js';

export interface ResolvedAssetReference {
  asset_id:string;
  alias:string;
  name:string;
  type:string;
  category:string;
  provider_accessible_url:string;
  storage_path:string;
  mime_type:string;
}

let storageDiagnosticCache:{expiresAt:number;result:StorageDiagnosticResult}|null=null;

async function timedFetch(url:string,init:RequestInit,timeoutMs=5000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);}
}

function legacySupabasePublicUrl(asset:Asset){
  const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
  const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
  if(!base||!asset.storage_path||asset.storage_path.startsWith('provider://'))return null;
  const encoded=asset.storage_path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
}

function isSupabaseUrl(value:string){
  try{return new URL(value).hostname.endsWith('.supabase.co');}catch{return false;}
}

async function checkLegacySupabase():Promise<{available:boolean|null;error?:string}>{
  const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
  if(!base)return{available:null,error:'LEGACY_SUPABASE_NOT_CONFIGURED'};
  let probe:Asset|null;
  try{
    probe=await assetRepository.findLegacyStorageProbeAsset();
  }catch{
    return{available:null,error:'LEGACY_ASSET_LOOKUP_FAILED'};
  }
  const sourceUrl=probe&&(legacySupabasePublicUrl(probe)||(probe.public_url&&isSupabaseUrl(probe.public_url)?probe.public_url:null));
  if(!probe||!sourceUrl)return{available:null,error:'NO_LEGACY_SUPABASE_ASSET_TO_PROBE'};
  try{
    const read=await timedFetch(sourceUrl,{method:'HEAD',redirect:'follow'});
    return read.ok?{available:true}:{available:false,error:`LEGACY_SUPABASE_READ_HTTP_${read.status}`};
  }catch(error:any){
    return{available:false,error:error?.name==='AbortError'?'LEGACY_SUPABASE_CHECK_TIMEOUT':'LEGACY_SUPABASE_CHECK_FAILED'};
  }
}

export const assetReferenceResolver={
  async getProviderAccessibleUrl(asset:Asset) {
    if(asset.storage_path&&!asset.storage_path.startsWith('provider://')){
      if(hasR2AssetBucket()){
        if(await r2AssetStorageService.exists(asset.storage_path))return publicAssetUrl(asset.storage_path);
      }
      if(asset.public_url&&/^https:\/\//i.test(asset.public_url)){
        let url:URL;
        try{url=new URL(asset.public_url);}catch{throw Object.assign(new Error('A URL legada do asset é inválida.'),{code:'REFERENCE_URL_UNAVAILABLE'});}
        if(publicAssetKeyFromPath(url.pathname)){
          throw Object.assign(new Error('O arquivo indicado pelo asset não existe no Cloudflare R2.'),{code:'ASSET_STORAGE_OBJECT_MISSING'});
        }
        if(isSupabaseUrl(asset.public_url)){
          try{
            const response=await timedFetch(asset.public_url,{method:'HEAD',redirect:'follow'});
            if(response.ok)return asset.public_url;
            throw Object.assign(new Error('O arquivo legado do Supabase não está acessível.'),{code:'LEGACY_ASSET_STORAGE_UNAVAILABLE',status:response.status});
          }catch(error:any){
            if(error?.code)throw error;
            throw Object.assign(new Error('Não foi possível validar o arquivo legado do Supabase.'),{code:error?.name==='AbortError'?'LEGACY_ASSET_STORAGE_TIMEOUT':'LEGACY_ASSET_STORAGE_UNAVAILABLE'});
          }
        }
        return asset.public_url;
      }
      throw Object.assign(new Error(hasR2AssetBucket()?'O arquivo indicado pelo asset não existe no Cloudflare R2.':'O R2 ainda não está configurado para acessar este asset.'),{code:hasR2AssetBucket()?'ASSET_STORAGE_OBJECT_MISSING':'ASSET_STORAGE_UNAVAILABLE'});
    }
    if(asset.public_url&&/^https:\/\//i.test(asset.public_url))return asset.public_url;
    throw Object.assign(new Error('Asset sem URL acessível ao provedor.'),{code:'REFERENCE_URL_UNAVAILABLE'});
  },

  async resolveReferenceAssetUrls(userId:string,assetIds:string[],_reqHost?:string,_idToken?:string) {
    const out:ResolvedAssetReference[]=[];
    for(const id of Array.from(new Set(assetIds||[]))){
      const asset=await assetRepository.getAsset(id,userId);
      if(!asset){
        throw Object.assign(new Error(`Asset ${id} não encontrado ou não pertence a este usuário.`),{code:'REFERENCE_NOT_FOUND'});
      }
      if(asset.status!=='READY'){
        throw Object.assign(new Error(`Asset @${asset.alias} não está pronto.`),{code:'REFERENCE_NOT_READY'});
      }
      out.push({
        asset_id:asset.asset_id,
        alias:asset.alias,
        name:asset.name,
        type:asset.type,
        category:asset.category,
        provider_accessible_url:await this.getProviderAccessibleUrl(asset),
        storage_path:asset.storage_path,
        mime_type:asset.mime_type,
      });
    }
    return out;
  },

  async runStorageDiagnostic():Promise<StorageDiagnosticResult> {
    if(storageDiagnosticCache&&storageDiagnosticCache.expiresAt>Date.now())return storageDiagnosticCache.result;
    let writeTest:StorageDiagnosticResult['write_test']='SKIPPED';
    let readTest:StorageDiagnosticResult['read_test']='SKIPPED';
    let bucketAccessible=false;
    let diagnosticError:string|undefined=hasR2AssetBucket()?undefined:'R2_BUCKET_BINDING_MISSING';
    let latencyMs=0;
    if(hasR2AssetBucket()){
      try{
        const startedAt=Date.now();
        await r2AssetStorageService.probe();
        latencyMs=Date.now()-startedAt;
        writeTest='PASS';
        readTest='PASS';
        bucketAccessible=true;
      }catch(error:any){
        writeTest='FAIL';
        readTest='FAIL';
        diagnosticError=String(error?.code||'R2_STORAGE_CHECK_FAILED');
        console.error('[R2StorageDiagnostic]',JSON.stringify({code:diagnosticError}));
      }
    }
    const legacy=await checkLegacySupabase();
    const message=!hasR2AssetBucket()
      ?'Cloudflare R2 não está configurado; novos uploads e arquivamentos não podem ser confirmados.'
      :readTest!=='PASS'
        ?'O bucket Cloudflare R2 está configurado, mas o teste real de gravação e leitura falhou.'
        :legacy.available===false&&legacy.error?.startsWith('LEGACY_SUPABASE_READ_HTTP_')
          ?'Cloudflare R2 está gravando e lendo. O Storage Supabase legado continua inacessível; arquivos antigos ainda não recuperados permanecem indisponíveis.'
          :legacy.available===true
            ?'Cloudflare R2 está gravando e lendo; a amostra antiga do Supabase também continua acessível.'
            :'Cloudflare R2 está gravando e lendo. Não foi possível validar uma amostra histórica do Supabase.';
    const result:StorageDiagnosticResult={
      is_configured:hasR2AssetBucket(),
      storage_bucket:'ia-conect-assets',
      write_test:writeTest,
      read_test:readTest,
      message,
      details:{latency_ms:latencyMs,bucket_accessible:bucketAccessible,error:diagnosticError,legacy_storage_available:legacy.available,legacy_storage_error:legacy.error},
      checked_at:new Date().toISOString(),
    };
    storageDiagnosticCache={expiresAt:Date.now()+300_000,result};
    return result;
  },
  resetStorageDiagnosticCache(){storageDiagnosticCache=null;},
};
