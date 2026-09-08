import { collection, doc, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { apiRequest, ApiError } from './apiClient.js';
import { Asset, AssetType, AssetCategory } from '../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../config/constants.js';

export interface UploadAssetParams { file:File; name?:string; alias?:string; category?:AssetCategory; onProgress?:(percent:number)=>void; onTaskReady?:(task:{cancel:()=>void})=>void; timeoutMs?:number; }
export function sanitizeAlias(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');}

export const assetService={
  async listAssets(filters?:{type?:AssetType;category?:AssetCategory;search?:string}):Promise<Asset[]>{
    const user=auth.currentUser; if(!user) return [];
    const snap=await getDocs(query(collection(db,'assets'),where('owner_user_id','==',user.uid)));
    const search=filters?.search?.toLowerCase().trim();
    return snap.docs.map(d=>d.data() as Asset).filter(a=>!a.deleted_at&&(!filters?.type||a.type===filters.type)&&(!filters?.category||a.category===filters.category)&&(!search||a.name.toLowerCase().includes(search)||a.alias.toLowerCase().includes(search))).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  },

  async uploadAsset(params:UploadAssetParams):Promise<Asset>{
    const {file,name,alias,category='PRODUCT',onProgress,onTaskReady,timeoutMs=120000}=params;
    const user=auth.currentUser; if(!user) throw new Error('Usuário não autenticado.');
    const ext=file.name.split('.').pop()?.toLowerCase() || '';
    let type:AssetType='IMAGE';
    if(file.type.startsWith('video/')||ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) type='VIDEO';
    else if(file.type.startsWith('audio/')||ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) type='AUDIO';
    if(file.size>ASSET_UPLOAD_LIMITS[type].max_bytes) throw new Error('Arquivo excede o limite máximo permitido.');

    const controller=new AbortController(); onTaskReady?.({cancel:()=>controller.abort()});
    const timer=setTimeout(()=>controller.abort(),timeoutMs); onProgress?.(5);
    try{
      const token=await user.getIdToken();
      const response=await fetch('/api/assets/upload',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Asset-Name':encodeURIComponent((name||file.name).trim()),'X-Asset-Alias':encodeURIComponent(sanitizeAlias(alias||name||file.name.replace(/\.[^.]+$/,''))),'X-Asset-Category':category},body:file});
      clearTimeout(timer); onProgress?.(90);
      const json=await response.json().catch(()=>null);
      if(!response.ok||!json?.success) throw new ApiError(json?.error?.message||`Falha no upload (${response.status})`,json?.error?.code||'ASSET_UPLOAD_FAILED',response.status);
      onProgress?.(100); return json.data as Asset;
    }catch(err:any){clearTimeout(timer); if(err?.name==='AbortError') throw new Error('Upload cancelado ou excedeu o tempo limite.'); throw err;}
  },

  async updateAsset(assetId:string,updates:{name?:string;alias?:string;category?:AssetCategory;public_url?:string}):Promise<Asset>{
    const now=new Date().toISOString(); const payload:any={...updates,updated_at:now}; if(updates.alias) payload.alias=sanitizeAlias(updates.alias);
    await updateDoc(doc(db,'assets',assetId),payload); const list=await this.listAssets(); const found=list.find(a=>a.asset_id===assetId); if(!found) throw new Error('Asset não encontrado após atualização.'); return found;
  },
  async deleteAsset(assetId:string):Promise<void>{ const now=new Date().toISOString(); await updateDoc(doc(db,'assets',assetId),{deleted_at:now,updated_at:now}); }
};
