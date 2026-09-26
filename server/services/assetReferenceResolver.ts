import { assetRepository } from '../repositories/assetRepository.js';
import { Asset, StorageDiagnosticResult } from '../../src/types/index.js';

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

function supabasePublicUrl(asset:Asset) {
  const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
  const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
  if(!base||!asset.storage_path||asset.storage_path.startsWith('provider://'))return null;
  const encoded=asset.storage_path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
}

export const assetReferenceResolver={
  async getProviderAccessibleUrl(asset:Asset) {
    if(asset.public_url&&/^https:\/\//i.test(asset.public_url))return asset.public_url;
    const supabase=supabasePublicUrl(asset);
    if(supabase)return supabase;
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
    const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
    const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
    const secret=process.env.SUPABASE_SECRET_KEY?.trim();
    const configured=Boolean(base&&bucket&&secret);
    let signedUrlTest:StorageDiagnosticResult['signed_url_test']='SKIPPED';
    let bucketAccessible=false;
    let diagnosticError:string|undefined=configured?undefined:'SUPABASE_STORAGE_NOT_CONFIGURED';
    let latencyMs=0;
    if(configured){
      try{
        const probe=await assetRepository.findArchivedStorageProbeAsset();
        if(!probe?.storage_path){
          diagnosticError='NO_ARCHIVED_ASSET_TO_PROBE';
        }else{
          const path=probe.storage_path.split('/').map(encodeURIComponent).join('/');
          const endpoint=`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path}`;
          const startedAt=Date.now();
          const signedResponse=await timedFetch(endpoint,{
            method:'POST',
            headers:{Authorization:`Bearer ${secret}`,apikey:secret,'Content-Type':'application/json'},
            body:JSON.stringify({expiresIn:60}),
          });
          if(!signedResponse.ok){
            signedUrlTest='FAIL';
            diagnosticError=`SIGNED_URL_HTTP_${signedResponse.status}`;
          }else{
            const body:any=await signedResponse.json().catch(()=>({}));
            const value=String(body?.signedURL||body?.signedUrl||'');
            if(!value){
              signedUrlTest='FAIL';
              diagnosticError='SIGNED_URL_MISSING';
            }else{
              const signedUrl=/^https:\/\//i.test(value)
                ?value
                :value.startsWith('/storage/v1/')?`${base}${value}`:`${base}/storage/v1${value.startsWith('/')?value:`/${value}`}`;
              const readResponse=await timedFetch(signedUrl,{method:'HEAD',redirect:'follow'});
              latencyMs=Date.now()-startedAt;
              bucketAccessible=readResponse.ok;
              signedUrlTest=readResponse.ok?'PASS':'FAIL';
              if(!readResponse.ok)diagnosticError=`SIGNED_READ_HTTP_${readResponse.status}`;
            }
          }
        }
      }catch(error:any){
        signedUrlTest='FAIL';
        diagnosticError=error?.name==='AbortError'?'STORAGE_CHECK_TIMEOUT':'STORAGE_CHECK_FAILED';
      }
    }
    const message=!configured
      ?'Supabase Storage não está completamente configurado.'
      :signedUrlTest==='PASS'
        ?'Leitura autenticada por URL assinada confirmada no Storage. A gravação não foi testada.'
        :diagnosticError==='NO_ARCHIVED_ASSET_TO_PROBE'
          ?'Configuração encontrada, mas não há asset arquivado para validar a leitura. A gravação não foi testada.'
          :'Storage configurado, mas a leitura do asset de verificação falhou. A gravação não foi testada.';
    const result:StorageDiagnosticResult={
      is_configured:configured,
      storage_bucket:bucket||'ia-conect-assets',
      write_test:'SKIPPED',
      signed_url_test:signedUrlTest,
      message,
      details:{latency_ms:latencyMs,bucket_accessible:bucketAccessible,error:diagnosticError},
      checked_at:new Date().toISOString(),
    };
    storageDiagnosticCache={expiresAt:Date.now()+30_000,result};
    return result;
  },
};
