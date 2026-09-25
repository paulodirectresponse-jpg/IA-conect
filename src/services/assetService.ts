import { apiRequest } from './apiClient.js';
import { Asset, AssetType, AssetCategory, WorkspaceReference } from '../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../config/constants.js';

export interface UploadAssetParams {
  file:File;
  name?:string;
  alias?:string;
  category?:AssetCategory;
  onProgress?:(percent:number)=>void;
  onTaskReady?:(task:{cancel:()=>void})=>void;
  timeoutMs?:number;
}
export interface RegisterGeneratedAssetParams {
  generationId:string;
  modelId:string;
  providerId:string;
  url:string;
  type:AssetType;
  index?:number;
  name?:string;
}
export type AssetOriginFilter='ALL'|'UPLOAD'|'GENERATED';

export interface OptimisticImageUploadHandle {
  asset:Asset;
  ready:Promise<Asset>;
  cancel:()=>void;
}

interface SignedUploadResponse {
  asset_id:string;
  type:AssetType;
  storage_path:string;
  signed_url:string;
  token:string;
  public_url:string;
  bucket:string;
}

interface UploadTarget {
  storage_path:string;
  signed_url:string;
  token:string;
  public_url:string;
}

interface UploadTicketResponse {
  asset:Asset;
  original:UploadTarget;
  thumbnail:UploadTarget|null;
  bucket:string;
}

const IMMUTABLE_CACHE_SECONDS=31536000;
const pendingUploads=new Map<string,Promise<Asset>>();
let legacyRecoveryPromise:Promise<{recovered:number;unavailable:number;processed:number}>|null=null;

export function sanitizeAlias(v:string){
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
}

function fileDisplayName(file:File){
  return file.name.replace(/\.[^/.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()||file.name;
}

function localUploadId(){
  const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `local_${id}`;
}

function emitUploadEvent(name:string,detail:any){
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(name,{detail}));
}

function uploadToSignedUrl(
  url:string,
  body:Blob,
  filename:string,
  onProgress?:(percent:number)=>void,
  onTaskReady?:(task:{cancel:()=>void})=>void,
  timeoutMs=120000,
){
  return new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('PUT',url,true);
    xhr.timeout=timeoutMs;
    xhr.upload.onprogress=(event)=>{
      if(event.lengthComputable){
        const pct=Math.round((event.loaded/event.total)*100);
        onProgress?.(Math.max(0,Math.min(100,pct)));
      }
    };
    xhr.onerror=()=>reject(new Error('Falha de rede ao enviar o arquivo para o armazenamento.'));
    xhr.ontimeout=()=>reject(new Error('Envio excedeu o tempo limite.'));
    xhr.onabort=()=>reject(new Error('Envio cancelado.'));
    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300)resolve();
      else reject(new Error(`O armazenamento recusou o envio (${xhr.status}).`));
    };
    const form=new FormData();
    form.append('cacheControl',String(IMMUTABLE_CACHE_SECONDS));
    form.append('',body,filename);
    onTaskReady?.({cancel:()=>xhr.abort()});
    xhr.send(form);
  });
}

async function imageMetadataAndThumbnail(file:File){
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{
    const width=bitmap.width,height=bitmap.height,maxSide=768;
    const scale=Math.min(1,maxSide/Math.max(width,height));
    const targetWidth=Math.max(1,Math.round(width*scale));
    const targetHeight=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=targetWidth;
    canvas.height=targetHeight;
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)throw new Error('Não foi possível preparar a miniatura.');
    ctx.drawImage(bitmap,0,0,targetWidth,targetHeight);
    const thumbnail=await new Promise<Blob>((resolve,reject)=>{
      canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error('Não foi possível gerar a miniatura.')),'image/webp',0.82);
    });
    return{width,height,thumbnail};
  }finally{
    bitmap.close();
  }
}

function makeOptimisticAsset(params:UploadAssetParams,localId:string,previewUrl:string):Asset{
  const now=new Date().toISOString();
  const name=(params.name||fileDisplayName(params.file)).trim()||params.file.name;
  return{
    asset_id:localId,
    owner_user_id:'',
    type:'IMAGE',
    category:params.category||'GENERIC',
    name,
    alias:sanitizeAlias(params.alias||name)||`img_${Date.now().toString().slice(-6)}`,
    storage_path:'',
    public_url:previewUrl,
    thumbnail_url:previewUrl,
    mime_type:params.file.type||'image/jpeg',
    size_bytes:params.file.size,
    width:null,
    height:null,
    duration_seconds:null,
    status:'UPLOADING',
    origin:'UPLOAD',
    created_at:now,
    updated_at:now,
    deleted_at:null,
  };
}

function createOptimisticImageUpload(params:UploadAssetParams,gate?:Promise<void>):OptimisticImageUploadHandle{
  const {file,onProgress,onTaskReady,timeoutMs=120000}=params;
  if(!file.type.startsWith('image/'))throw new Error('O envio otimista desta etapa aceita apenas imagens.');
  if(file.size>ASSET_UPLOAD_LIMITS.IMAGE.max_bytes)throw new Error('Arquivo excede o limite máximo permitido.');

  const localId=localUploadId();
  const previewUrl=URL.createObjectURL(file);
  const optimistic=makeOptimisticAsset(params,localId,previewUrl);
  let cancelled=false;
  const activeTasks=new Set<{cancel:()=>void}>();
  const report=(percent:number)=>{
    const value=Math.max(0,Math.min(100,Math.round(percent)));
    onProgress?.(value);
    emitUploadEvent('ia:asset-upload-progress',{local_asset_id:localId,percent:value});
  };

  let reservedAssetId='';
  const ready=(async()=>{
    try{
      if(gate)await gate;
      if(cancelled)throw new Error('Envio cancelado.');
      report(2);

      const ticketPromise=apiRequest<UploadTicketResponse>('/api/assets/upload-ticket',{
        method:'POST',
        body:JSON.stringify({
          filename:file.name,
          name:optimistic.name,
          alias:params.alias?sanitizeAlias(params.alias):undefined,
          category:optimistic.category,
          mime_type:file.type||'image/jpeg',
          size_bytes:file.size,
        }),
      });
      const metadataPromise=imageMetadataAndThumbnail(file);
      const [ticket,metadata]=await Promise.all([ticketPromise,metadataPromise]);
      reservedAssetId=ticket.asset.asset_id;
      if(cancelled)throw new Error('Envio cancelado.');
      optimistic.width=metadata.width;
      optimistic.height=metadata.height;
      report(8);

      let originalProgress=0,thumbnailProgress=0;
      const updateCombined=()=>report(8+(originalProgress*0.70)+(thumbnailProgress*0.17));
      const registerTask=(task:{cancel:()=>void})=>{activeTasks.add(task);onTaskReady?.({cancel:()=>task.cancel()});};

      await Promise.all([
        uploadToSignedUrl(ticket.original.signed_url,file,file.name,(pct)=>{originalProgress=pct;updateCombined();},registerTask,timeoutMs),
        ticket.thumbnail
          ? uploadToSignedUrl(ticket.thumbnail.signed_url,metadata.thumbnail,'thumbnail.webp',(pct)=>{thumbnailProgress=pct;updateCombined();},registerTask,timeoutMs)
          : Promise.resolve(),
      ]);
      if(cancelled)throw new Error('Envio cancelado.');
      report(96);

      let completed:Asset|null=null;
      let lastError:any=null;
      for(let attempt=0;attempt<3&&!completed;attempt++){
        try{
          completed=await apiRequest<Asset>(`/api/assets/${encodeURIComponent(ticket.asset.asset_id)}/complete`,{
            method:'POST',
            body:JSON.stringify({width:metadata.width,height:metadata.height}),
          });
        }catch(err:any){
          lastError=err;
          if(err?.code!=='UPLOAD_NOT_VISIBLE'||attempt===2)throw err;
          await new Promise((resolve)=>window.setTimeout(resolve,250*(attempt+1)));
        }
      }
      if(!completed)throw lastError||new Error('Não foi possível finalizar o envio.');

      report(100);
      emitUploadEvent('ia:asset-upload-complete',{local_asset_id:localId,asset:completed});
      return completed;
    }catch(err){
      if(reservedAssetId){
        await apiRequest(`/api/assets/${encodeURIComponent(reservedAssetId)}`,{method:'PATCH',body:JSON.stringify({status:'FAILED'})}).catch(()=>null);
      }
      emitUploadEvent('ia:asset-upload-failed',{local_asset_id:localId,error:err});
      throw err;
    }finally{
      window.setTimeout(()=>URL.revokeObjectURL(previewUrl),1500);
      window.setTimeout(()=>pendingUploads.delete(localId),30000);
    }
  })();

  pendingUploads.set(localId,ready);
  return{
    asset:optimistic,
    ready,
    cancel:()=>{
      cancelled=true;
      activeTasks.forEach((task)=>{try{task.cancel();}catch{}});
    },
  };
}

function deferred(){
  let resolve!:()=>void;
  const promise=new Promise<void>((r)=>{resolve=r;});
  return{promise,resolve};
}

function startOptimisticImageUploads(files:File[],options:Omit<UploadAssetParams,'file'>={},concurrency=3){
  const usable=files.filter((file)=>file.type.startsWith('image/'));
  const gates=usable.map(()=>deferred());
  const handles=usable.map((file,index)=>createOptimisticImageUpload({file,...options},gates[index].promise));
  let next=0,active=0;
  const limit=Math.max(1,Math.min(3,Math.floor(concurrency)||3));
  const pump=()=>{
    while(active<limit&&next<handles.length){
      const index=next++;
      active++;
      gates[index].resolve();
      void handles[index].ready.then(
        ()=>{active--;pump();},
        ()=>{active--;pump();},
      );
    }
  };
  pump();
  return handles;
}

async function awaitReadyAsset(asset:Asset):Promise<Asset>{
  const pending=pendingUploads.get(asset.asset_id);
  if(pending)return pending;
  if(asset.asset_id.startsWith('local_')||asset.status==='UPLOADING'){
    throw new Error('Esta referência ainda não terminou de ser enviada.');
  }
  return asset;
}

async function resolveWorkspaceReferences(refs:WorkspaceReference[]):Promise<WorkspaceReference[]>{
  return Promise.all(refs.map(async(ref)=>{
    if(!ref.asset)return ref;
    const asset=await awaitReadyAsset(ref.asset);
    if(asset.asset_id===ref.asset_id&&asset===ref.asset)return ref;
    return{...ref,asset_id:asset.asset_id,alias_snapshot:asset.alias||ref.alias_snapshot,asset};
  }));
}

async function legacyUpload(params:UploadAssetParams,type:AssetType):Promise<Asset>{
  const {file,name,alias,category,onProgress,onTaskReady,timeoutMs=120000}=params;
  const effectiveCategory:AssetCategory=category||(type==='AUDIO'?'AUDIO_REFERENCE':type==='MODEL_3D'?'GENERIC':'PRODUCT');
  onProgress?.(5);
  const signed=await apiRequest<SignedUploadResponse>('/api/assets/signed-upload',{
    method:'POST',
    body:JSON.stringify({filename:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size}),
  });

  await uploadToSignedUrl(
    signed.signed_url,
    file,
    file.name,
    (pct)=>onProgress?.(5+(pct*0.90)),
    onTaskReady,
    timeoutMs,
  );

  const asset=await apiRequest<Asset>('/api/assets',{
    method:'POST',
    body:JSON.stringify({
      asset_id:signed.asset_id,
      name:(name||file.name).trim(),
      alias:alias?sanitizeAlias(alias):undefined,
      category:effectiveCategory,
      mime_type:file.type||'application/octet-stream',
      size_bytes:file.size,
      filename:file.name,
      storage_path:signed.storage_path,
      public_url:signed.public_url,
    }),
  });
  onProgress?.(100);
  return asset;
}

export const assetService={
  recoverLegacyGeneratedHistory():Promise<{recovered:number;unavailable:number;processed:number}>{
    if(legacyRecoveryPromise)return legacyRecoveryPromise;
    legacyRecoveryPromise=(async()=>{
      let cursor=0,recovered=0,unavailable=0,processed=0;
      for(let i=0;i<40;i++){
        const batch=await apiRequest<{cursor:number;next_cursor:number|null;done:boolean;processed:number;recovered:number;unavailable:number}>('/api/assets/recover-generated',{
          method:'POST',
          body:JSON.stringify({cursor,limit:3}),
        });
        recovered+=Number(batch.recovered||0);
        unavailable+=Number(batch.unavailable||0);
        processed+=Number(batch.processed||0);
        if(batch.done||batch.next_cursor==null)break;
        cursor=Number(batch.next_cursor||0);
      }
      return{recovered,unavailable,processed};
    })().catch(error=>{legacyRecoveryPromise=null;throw error;});
    return legacyRecoveryPromise;
  },

  async listAssets(filters?:{type?:AssetType;category?:AssetCategory;search?:string;origin?:AssetOriginFilter}):Promise<Asset[]>{
    const params=new URLSearchParams();
    if(filters?.type)params.set('type',filters.type);
    if(filters?.category)params.set('category',filters.category);
    if(filters?.search)params.set('search',filters.search);
    const rows=await apiRequest<Asset[]>(`/api/assets${params.size?`?${params.toString()}`:''}`);
    if(!filters?.origin||filters.origin==='ALL')return rows;
    return rows.filter((asset)=>String(asset.origin||'UPLOAD').toUpperCase()===filters.origin);
  },

  startOptimisticImageUpload(params:UploadAssetParams):OptimisticImageUploadHandle{
    return createOptimisticImageUpload(params);
  },

  startOptimisticImageUploads(files:File[],options:Omit<UploadAssetParams,'file'>={},concurrency=3):OptimisticImageUploadHandle[]{
    return startOptimisticImageUploads(files,options,concurrency);
  },

  awaitReadyAsset,

  resolveWorkspaceReferences,

  async uploadAsset(params:UploadAssetParams):Promise<Asset>{
    const {file}=params;
    const ext=file.name.split('.').pop()?.toLowerCase()||'';
    let type:AssetType='IMAGE';
    if(file.type.startsWith('video/')||ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext))type='VIDEO';
    else if(file.type.startsWith('audio/')||ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext))type='AUDIO';
    else if(file.type.startsWith('model/')||ASSET_UPLOAD_LIMITS.MODEL_3D.allowed_extensions.includes(ext))type='MODEL_3D';
    if(file.size>ASSET_UPLOAD_LIMITS[type].max_bytes)throw new Error('Arquivo excede o limite máximo permitido.');
    if(type==='IMAGE')return createOptimisticImageUpload(params).ready;
    return legacyUpload(params,type);
  },

  async registerGeneratedAsset(params:RegisterGeneratedAssetParams):Promise<Asset>{
    for(let attempt=0;attempt<4;attempt++){
      const rows=await this.listAssets({origin:'GENERATED'});
      const found=rows.find((asset)=>
        String(asset.source_generation_id||'')===params.generationId &&
        String(asset.public_url||'')===params.url
      );
      if(found)return found;
      if(attempt<3)await new Promise((resolve)=>window.setTimeout(resolve,300));
    }
    throw new Error('O resultado foi gerado, mas o arquivo ainda não terminou de ser registrado.');
  },

  updateAsset(assetId:string,updates:{name?:string;alias?:string;category?:AssetCategory;public_url?:string}):Promise<Asset>{
    return apiRequest<Asset>(`/api/assets/${encodeURIComponent(assetId)}`,{
      method:'PATCH',
      body:JSON.stringify({...updates,alias:updates.alias?sanitizeAlias(updates.alias):undefined}),
    });
  },

  async deleteAsset(assetId:string):Promise<void>{
    await apiRequest(`/api/assets/${encodeURIComponent(assetId)}`,{method:'DELETE'});
  },
};
