import { apiRequest } from './apiClient.js';
import { Asset, AssetType, AssetCategory } from '../types/index.js';
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

export function sanitizeAlias(v:string){
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
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

function uploadToSignedUrl(
  url:string,
  file:File,
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
        const pct=Math.round((event.loaded/event.total)*90);
        onProgress?.(Math.max(5,Math.min(95,pct)));
      }
    };
    xhr.onerror=()=>reject(new Error('Falha de rede ao enviar o arquivo para o armazenamento.'));
    xhr.ontimeout=()=>reject(new Error('Upload excedeu o tempo limite.'));
    xhr.onabort=()=>reject(new Error('Upload cancelado.'));
    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300)resolve();
      else reject(new Error(`O armazenamento recusou o upload (${xhr.status}).`));
    };
    const form=new FormData();
    form.append('cacheControl','3600');
    form.append('',file);
    onTaskReady?.({cancel:()=>xhr.abort()});
    xhr.send(form);
  });
}

export const assetService={
  async listAssets(filters?:{type?:AssetType;category?:AssetCategory;search?:string;origin?:AssetOriginFilter}):Promise<Asset[]>{
    const params=new URLSearchParams();
    if(filters?.type)params.set('type',filters.type);
    if(filters?.category)params.set('category',filters.category);
    if(filters?.search)params.set('search',filters.search);
    const rows=await apiRequest<Asset[]>(`/api/assets${params.size?`?${params.toString()}`:''}`);
    if(!filters?.origin||filters.origin==='ALL')return rows;
    return rows.filter((asset)=>String(asset.origin||'UPLOAD').toUpperCase()===filters.origin);
  },

  async uploadAsset(params:UploadAssetParams):Promise<Asset>{
    const {file,name,alias,category='PRODUCT',onProgress,onTaskReady,timeoutMs=120000}=params;
    const ext=file.name.split('.').pop()?.toLowerCase()||'';
    let type:AssetType='IMAGE';
    if(file.type.startsWith('video/')||ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext))type='VIDEO';
    else if(file.type.startsWith('audio/')||ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext))type='AUDIO';
    if(file.size>ASSET_UPLOAD_LIMITS[type].max_bytes)throw new Error('Arquivo excede o limite máximo permitido.');

    onProgress?.(5);
    const signed=await apiRequest<SignedUploadResponse>('/api/assets/signed-upload',{
      method:'POST',
      body:JSON.stringify({filename:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size}),
    });

    await uploadToSignedUrl(signed.signed_url,file,onProgress,onTaskReady,timeoutMs);

    const asset=await apiRequest<Asset>('/api/assets',{
      method:'POST',
      body:JSON.stringify({
        asset_id:signed.asset_id,
        name:(name||file.name).trim(),
        alias:alias?sanitizeAlias(alias):undefined,
        category,
        mime_type:file.type||'application/octet-stream',
        size_bytes:file.size,
        filename:file.name,
        storage_path:signed.storage_path,
        public_url:signed.public_url,
      }),
    });

    onProgress?.(100);
    return asset;
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
    throw new Error('O resultado foi gerado, mas o asset ainda não terminou de ser registrado.');
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
