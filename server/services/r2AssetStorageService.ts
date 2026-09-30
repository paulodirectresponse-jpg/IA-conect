import path from 'node:path';

const MAX_ARCHIVE_BYTES=50*1024*1024;
const MAX_UPLOAD_BYTES=50*1024*1024;
const IMMUTABLE_CACHE='public, max-age=31536000, immutable';
const PUBLIC_MEDIA_PREFIX='/api/assets/media/';

export interface R2AssetBucketPort{
  put(key:string,value:ReadableStream<Uint8Array>|ArrayBuffer|Uint8Array,options?:{httpMetadata?:{contentType?:string;cacheControl?:string}}):Promise<unknown>;
  head(key:string):Promise<{size:number;httpEtag:string;writeHttpMetadata(headers:Headers):void}|null>;
  get(key:string,options?:{range?:{offset:number;length:number}}):Promise<{body:ReadableStream<Uint8Array>;httpEtag:string;size:number;writeHttpMetadata(headers:Headers):void}|null>;
  delete(key:string):Promise<void>;
}

export interface AssetByteRange {offset:number;length:number;contentRange:string}

export function parseAssetByteRange(value:string|null,size:number):AssetByteRange|null|'UNSATISFIABLE'{
  if(!value||value.includes(','))return null;
  const match=/^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if(!match||(!match[1]&&!match[2]))return null;
  if(!Number.isSafeInteger(size)||size<=0)return'UNSATISFIABLE';
  if(!match[1]){
    const suffix=Number(match[2]);
    if(!Number.isSafeInteger(suffix)||suffix<=0)return'UNSATISFIABLE';
    const offset=Math.max(0,size-suffix);
    const length=size-offset;
    return{offset,length,contentRange:`bytes ${offset}-${size-1}/${size}`};
  }
  const offset=Number(match[1]);
  const requestedEnd=match[2]?Number(match[2]):size-1;
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(requestedEnd)||offset>=size||requestedEnd<offset)return'UNSATISFIABLE';
  const end=Math.min(requestedEnd,size-1);
  const length=end-offset+1;
  return{offset,length,contentRange:`bytes ${offset}-${end}/${size}`};
}

let configuredBucket:R2AssetBucketPort|null=null;

export function configureR2AssetBucket(bucket:R2AssetBucketPort|null){configuredBucket=bucket;}
export function hasR2AssetBucket(){return configuredBucket!==null;}

function bucket(){
  if(!configuredBucket)throw Object.assign(new Error('Cloudflare R2 não está configurado.'),{code:'ASSET_STORAGE_UNAVAILABLE'});
  return configuredBucket;
}

function safePath(value:string){
  const normalized=String(value||'').replace(/^\/+|\/+$/g,'');
  if(!/^users\/[A-Za-z0-9_-]{1,128}\/assets\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9._-]{1,128}$/.test(normalized)){
    throw Object.assign(new Error('Caminho inválido para armazenamento de asset.'),{code:'ASSET_STORAGE_PATH_INVALID'});
  }
  return normalized;
}

function appBaseUrl(){return String(process.env.APP_URL||process.env.PUBLIC_APP_URL||'https://iaconnect.ia.br').replace(/\/+$/,'');}

export function publicAssetUrl(storagePath:string,baseUrl=appBaseUrl()){
  const key=safePath(storagePath);
  return `${baseUrl}${PUBLIC_MEDIA_PREFIX}${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function publicAssetKeyFromPath(pathname:string){
  if(!pathname.startsWith(PUBLIC_MEDIA_PREFIX))return null;
  let key:string;
  try{key=pathname.slice(PUBLIC_MEDIA_PREFIX.length).split('/').map(part=>decodeURIComponent(part)).join('/');}
  catch{return null;}
  try{return safePath(key);}catch{return null;}
}

function cleanMime(value:string|undefined,fallback:string){
  const mime=String(value||'').split(';')[0].trim().toLowerCase();
  return mime&&mime!=='application/octet-stream'?mime:fallback;
}

function extensionFor(mime:string,sourceUrl:string,fallback:string){
  const byMime:Record<string,string>={
    'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif',
    'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov',
    'audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/aac':'aac',
    'model/gltf-binary':'glb','model/gltf+json':'gltf','model/obj':'obj',
  };
  if(byMime[mime])return byMime[mime];
  try{
    const ext=path.extname(new URL(sourceUrl).pathname).replace('.','').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(ext&&ext.length<=8)return ext;
  }catch{}
  return fallback;
}

async function writeStream(params:{storagePath:string;stream:ReadableStream<Uint8Array>;mimeType:string;maxBytes:number;expectedBytes?:number}){
  const key=safePath(params.storagePath);
  let size=0;
  let overflowError:Error|undefined;
  const limited=params.stream.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
    transform(chunk,controller){
      size+=chunk.byteLength;
      if(size>params.maxBytes){
        overflowError=Object.assign(new Error('Arquivo excede o limite máximo permitido.'),{code:'ASSET_ARCHIVE_TOO_LARGE'});
        controller.error(overflowError);
        return;
      }
      controller.enqueue(chunk);
    },
  }));
  try{
    await bucket().put(key,limited,{httpMetadata:{contentType:params.mimeType,cacheControl:IMMUTABLE_CACHE}});
  }catch(error){
    await deleteAfterFailure(key);
    if(overflowError)throw overflowError;
    throw error;
  }
  if(size<=0){
    await deleteAfterFailure(key);
    throw Object.assign(new Error('O arquivo enviado está vazio.'),{code:'ASSET_ARCHIVE_EMPTY'});
  }
  if(params.expectedBytes!==undefined&&size!==params.expectedBytes){
    await deleteAfterFailure(key);
    throw Object.assign(new Error('O tamanho recebido não corresponde ao tamanho informado.'),{code:'ASSET_UPLOAD_SIZE_MISMATCH'});
  }
  const stored=await bucket().head(key);
  if(!stored||stored.size!==size){
    await deleteAfterFailure(key);
    throw Object.assign(new Error('O arquivo foi enviado, mas o R2 não confirmou a gravação.'),{code:'ASSET_ARCHIVE_NOT_VISIBLE'});
  }
  return{storage_path:key,public_url:publicAssetUrl(key),mime_type:params.mimeType,size_bytes:size};
}

async function deleteAfterFailure(key:string){
  try{await bucket().delete(key);}
  catch(error:any){console.error('[R2AssetCleanupFailed]',JSON.stringify({code:String(error?.code||'R2_DELETE_FAILED')}));}
}

export const r2AssetStorageService={
  async head(storagePath:string){return bucket().head(safePath(storagePath));},
  async get(storagePath:string,range?:{offset:number;length:number}){return bucket().get(safePath(storagePath),range?{range}:undefined);},
  async exists(storagePath:string){return Boolean(await this.head(storagePath));},
  async probe(){
    const probeKey=`users/system/assets/storage-health/probe-${globalThis.crypto.randomUUID()}.txt`;
    const expected='ia-conect-r2-health-probe-v1';
    const bytes=new TextEncoder().encode(expected);
    try{
      await bucket().put(probeKey,bytes,{httpMetadata:{contentType:'text/plain; charset=utf-8',cacheControl:'no-store'}});
      const stored=await bucket().head(probeKey);
      if(!stored||stored.size!==bytes.byteLength)throw Object.assign(new Error('R2 não confirmou a gravação do teste.'),{code:'R2_WRITE_NOT_CONFIRMED'});
      const object=await bucket().get(probeKey);
      if(!object)throw Object.assign(new Error('R2 não confirmou a leitura do teste.'),{code:'R2_READ_NOT_CONFIRMED'});
      const text=await new Response(object.body).text();
      if(text!==expected)throw Object.assign(new Error('O conteúdo lido do teste R2 não corresponde.'),{code:'R2_READ_MISMATCH'});
      return{key:probeKey,size:bytes.byteLength};
    }finally{
      try{await bucket().delete(probeKey);}
      catch(error:any){console.error('[R2ProbeCleanupFailed]',JSON.stringify({code:String(error?.code||'R2_PROBE_DELETE_FAILED')}));}
    }
  },
  async putUploadedStream(params:{storagePath:string;stream:ReadableStream<Uint8Array>;mimeType:string;expectedBytes:number;maxBytes?:number}){
    return writeStream({...params,maxBytes:Math.min(MAX_UPLOAD_BYTES,params.maxBytes||MAX_UPLOAD_BYTES)});
  },
  async archive(params:{userId:string;assetId:string;sourceUrl:string;fallbackMime:string;fallbackExtension:string}){
    bucket();
    if(!/^https:\/\//i.test(params.sourceUrl)){
      throw Object.assign(new Error('URL de saída inválida para arquivamento.'),{code:'ASSET_ARCHIVE_SOURCE_INVALID'});
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),60_000);
    try{
      const response=await fetch(params.sourceUrl,{redirect:'follow',signal:controller.signal});
      if(!response.ok){
        throw Object.assign(new Error('Não foi possível recuperar o arquivo gerado.'),{code:'ASSET_ARCHIVE_FETCH_FAILED',status:response.status});
      }
      const announced=Number(response.headers.get('content-length')||0);
      if(announced>MAX_ARCHIVE_BYTES){
        throw Object.assign(new Error('O arquivo gerado excede o limite de arquivamento atual.'),{code:'ASSET_ARCHIVE_TOO_LARGE'});
      }
      if(!response.body)throw Object.assign(new Error('A resposta do provedor não contém arquivo.'),{code:'ASSET_ARCHIVE_EMPTY'});
      const mime=cleanMime(response.headers.get('content-type')||undefined,params.fallbackMime);
      const ext=extensionFor(mime,params.sourceUrl,params.fallbackExtension);
      const storagePath=`users/${params.userId}/assets/${params.assetId}/generated.${ext}`;
      return await writeStream({storagePath,stream:response.body,mimeType:mime,maxBytes:MAX_ARCHIVE_BYTES,expectedBytes:announced||undefined});
    }catch(error:any){
      if(error?.name==='AbortError')throw Object.assign(new Error('A leitura do resultado do provedor excedeu o tempo limite.'),{code:'ASSET_ARCHIVE_SOURCE_TIMEOUT'});
      throw error;
    }finally{clearTimeout(timeout);}
  },
};
