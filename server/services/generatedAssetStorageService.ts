import path from 'path';

const MAX_ARCHIVE_BYTES=50*1024*1024;

function storageConfig(){
  const supabaseUrl=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
  const secretKey=String(process.env.SUPABASE_SECRET_KEY||'').trim();
  const bucket=String(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
  if(!supabaseUrl||!secretKey||!bucket){
    throw Object.assign(new Error('Armazenamento oficial indisponível.'),{code:'ASSET_STORAGE_UNAVAILABLE'});
  }
  return{supabaseUrl,secretKey,bucket};
}

function encoded(value:string){return value.split('/').map(encodeURIComponent).join('/');}
function publicUrl(base:string,bucket:string,storagePath:string){
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded(storagePath)}`;
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

export interface ArchivedGeneratedAsset {
  storage_path:string;
  public_url:string;
  mime_type:string;
  size_bytes:number;
}

export const generatedAssetStorageService={
  async archive(params:{
    userId:string;
    assetId:string;
    sourceUrl:string;
    fallbackMime:string;
    fallbackExtension:string;
  }):Promise<ArchivedGeneratedAsset>{
    if(!/^https:\/\//i.test(params.sourceUrl)){
      throw Object.assign(new Error('URL de saída inválida para arquivamento.'),{code:'ASSET_ARCHIVE_SOURCE_INVALID'});
    }
    const response=await fetch(params.sourceUrl,{redirect:'follow'});
    if(!response.ok){
      throw Object.assign(new Error('Não foi possível recuperar o arquivo gerado.'),{code:'ASSET_ARCHIVE_FETCH_FAILED'});
    }
    const announced=Number(response.headers.get('content-length')||0);
    if(announced>MAX_ARCHIVE_BYTES){
      throw Object.assign(new Error('O arquivo gerado excede o limite de arquivamento atual.'),{code:'ASSET_ARCHIVE_TOO_LARGE'});
    }
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.byteLength<=0)throw Object.assign(new Error('O arquivo gerado está vazio.'),{code:'ASSET_ARCHIVE_EMPTY'});
    if(buffer.byteLength>MAX_ARCHIVE_BYTES){
      throw Object.assign(new Error('O arquivo gerado excede o limite de arquivamento atual.'),{code:'ASSET_ARCHIVE_TOO_LARGE'});
    }

    const mime=cleanMime(response.headers.get('content-type')||undefined,params.fallbackMime);
    const ext=extensionFor(mime,params.sourceUrl,params.fallbackExtension);
    const storagePath=`users/${params.userId}/assets/${params.assetId}/generated.${ext}`;
    const config=storageConfig();
    const target=`${config.supabaseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encoded(storagePath)}`;
    const upload=await fetch(target,{
      method:'POST',
      headers:{
        Authorization:`Bearer ${config.secretKey}`,
        apikey:config.secretKey,
        'Content-Type':mime,
        'Cache-Control':'public, max-age=31536000, immutable',
        'x-upsert':'true',
      },
      body:buffer,
    });
    if(!upload.ok){
      const body=await upload.text().catch(()=>'');
      console.error('[GeneratedAssetArchive]',upload.status,body.slice(0,400));
      throw Object.assign(new Error('Não foi possível arquivar o arquivo gerado.'),{code:'ASSET_ARCHIVE_UPLOAD_FAILED'});
    }
    return{
      storage_path:storagePath,
      public_url:publicUrl(config.supabaseUrl,config.bucket,storagePath),
      mime_type:mime,
      size_bytes:buffer.byteLength,
    };
  },
};
