import crypto from 'crypto';
import { assetRepository } from '../repositories/assetRepository.js';
import { getAdminStorage } from '../repositories/firebaseAdminClient.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { Asset, StorageDiagnosticResult } from '../../src/types/index.js';

function streamSecret(){const value=process.env.ASSET_STREAM_SECRET?.trim()||process.env.ADMIN_BOOTSTRAP_SECRET?.trim();if(!value)throw Object.assign(new Error('ASSET_STREAM_SECRET não configurado.'),{code:'ASSET_STREAM_SECRET_MISSING'});return value;}
export interface ResolvedAssetReference{asset_id:string;alias:string;name:string;type:string;category:string;provider_accessible_url:string;storage_path:string;mime_type:string;}

function supabasePublicUrl(asset:Asset){
 const base=process.env.SUPABASE_URL?.trim().replace(/\/+$/,'');
 const bucket=(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
 if(!base||!asset.storage_path)return null;
 const encoded=asset.storage_path.split('/').map(encodeURIComponent).join('/');
 return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
}

export const assetReferenceResolver={
 createStreamToken(assetId:string,userId:string,durationMinutes=60){const expiresAt=Date.now()+durationMinutes*60000;const payload=`${assetId}:${userId}:${expiresAt}`;const hmac=crypto.createHmac('sha256',streamSecret()).update(payload).digest('hex');return Buffer.from(JSON.stringify({payload,hmac})).toString('base64url');},
 verifyStreamToken(token:string){try{const {payload,hmac}=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));const expected=crypto.createHmac('sha256',streamSecret()).update(payload).digest('hex');if(!crypto.timingSafeEqual(Buffer.from(hmac),Buffer.from(expected)))return null;const [assetId,userId,exp]=String(payload).split(':');if(Date.now()>Number(exp))return null;return {assetId,userId};}catch{return null;}},
 async getProviderAccessibleUrl(asset:Asset,reqHost?:string){
  if(asset.public_url&&/^https:\/\//i.test(asset.public_url))return asset.public_url;
  const supabase=supabasePublicUrl(asset);if(supabase)return supabase;
  const storage=getAdminStorage(),cfg=getFirebaseConfig();if(storage&&cfg.storageBucket&&asset.storage_path){try{const [url]=await storage.bucket(cfg.storageBucket).file(asset.storage_path).getSignedUrl({version:'v4',action:'read',expires:Date.now()+60*60000});if(url)return url;}catch{}}
  const token=this.createStreamToken(asset.asset_id,asset.owner_user_id,60);const host=reqHost||process.env.APP_URL;if(!host)throw Object.assign(new Error('APP_URL é obrigatório quando nenhuma URL pública do asset está disponível.'),{code:'APP_URL_REQUIRED'});const base=host.startsWith('http')?host:`https://${host}`;return `${base.replace(/\/$/,'')}/api/assets/stream/${token}`;
 },
 async resolveReferenceAssetUrls(userId:string,assetIds:string[],reqHost?:string){const out:ResolvedAssetReference[]=[];for(const id of Array.from(new Set(assetIds||[]))){const a=await assetRepository.getAsset(id,userId);if(!a)throw Object.assign(new Error(`Asset ${id} não encontrado.`),{code:'REFERENCE_NOT_FOUND'});if(a.status!=='READY')throw Object.assign(new Error(`Asset @${a.alias} não está pronto.`),{code:'REFERENCE_NOT_READY'});out.push({asset_id:a.asset_id,alias:a.alias,name:a.name,type:a.type,category:a.category,provider_accessible_url:await this.getProviderAccessibleUrl(a,reqHost),storage_path:a.storage_path,mime_type:a.mime_type});}return out;},
 async runStorageDiagnostic():Promise<StorageDiagnosticResult>{const start=Date.now(),cfg=getFirebaseConfig(),storage=getAdminStorage();if(!storage||!cfg.storageBucket)return{is_configured:false,storage_bucket:cfg.storageBucket||'supabase',write_test:'SKIPPED',signed_url_test:'SKIPPED',message:'Diagnóstico legado do Firebase Storage indisponível; assets ativos usam Supabase.',checked_at:new Date().toISOString()};const bucket=storage.bucket(cfg.storageBucket);let write:'PASS'|'FAIL'='FAIL',signed:'PASS'|'FAIL'='FAIL',error:string|undefined;const f=bucket.file(`_diagnostics/probe_${Date.now()}.txt`);try{await f.save(Buffer.from('ok'),{resumable:false,contentType:'text/plain'});write='PASS';try{const[u]=await f.getSignedUrl({version:'v4',action:'read',expires:Date.now()+600000});if(u)signed='PASS';}catch{}await f.delete({ignoreNotFound:true});}catch(e:any){error=e?.message;}return{is_configured:true,storage_bucket:cfg.storageBucket,write_test:write,signed_url_test:signed,message:write==='PASS'?'Bucket acessível.':`Falha no bucket: ${error||'desconhecida'}`,details:{latency_ms:Date.now()-start,bucket_accessible:write==='PASS',error},checked_at:new Date().toISOString()};}
};
