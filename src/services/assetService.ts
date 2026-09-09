import { collection, doc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase.js';
import { Asset, AssetType, AssetCategory } from '../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../config/constants.js';

export interface UploadAssetParams { file:File; name?:string; alias?:string; category?:AssetCategory; onProgress?:(percent:number)=>void; onTaskReady?:(task:{cancel:()=>void})=>void; timeoutMs?:number; }
export function sanitizeAlias(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');}

async function uniqueAlias(baseValue:string,userId:string){
  const base=sanitizeAlias(baseValue)||`asset_${Date.now().toString().slice(-6)}`;
  const existing=await getDocs(query(collection(db,'assets'),where('owner_user_id','==',userId)));
  const used=new Set(existing.docs.map(d=>String((d.data() as any).alias||'')));
  if(!used.has(base)) return base;
  let i=1; while(used.has(`${base}_${i}`)) i++; return `${base}_${i}`;
}

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

    const assetId=`ast_${Date.now()}_${Math.random().toString(16).slice(2,10)}`;
    const cleanAlias=await uniqueAlias(alias||name||file.name.replace(/\.[^.]+$/,''),user.uid);
    const safeExt=ext.replace(/[^a-z0-9]/g,'');
    const storagePath=`users/${user.uid}/assets/${assetId}/original${safeExt?'.'+safeExt:''}`;
    const task=uploadBytesResumable(storageRef(storage,storagePath),file,{contentType:file.type||'application/octet-stream',customMetadata:{owner_user_id:user.uid,asset_id:assetId}});
    onTaskReady?.({cancel:()=>task.cancel()});

    return await new Promise<Asset>((resolve,reject)=>{
      const timer=setTimeout(()=>{task.cancel();reject(new Error('Upload excedeu o tempo limite.'));},timeoutMs);
      task.on('state_changed',snap=>{
        const percent=snap.totalBytes?Math.round((snap.bytesTransferred/snap.totalBytes)*90):5;
        onProgress?.(Math.max(5,percent));
      },err=>{clearTimeout(timer);reject(new Error(err?.message||'Falha ao enviar o arquivo para o Firebase Storage.'));},async()=>{
        clearTimeout(timer);
        try{
          const now=new Date().toISOString();
          const asset:Asset={
            asset_id:assetId,owner_user_id:user.uid,type,category,
            name:(name||file.name).trim(),alias:cleanAlias,storage_path:storagePath,
            public_url:'',thumbnail_url:'',mime_type:file.type||'application/octet-stream',size_bytes:file.size,
            width:null,height:null,duration_seconds:null,status:'READY',created_at:now,updated_at:now,deleted_at:null,
          } as Asset;
          await setDoc(doc(db,'assets',assetId),asset);
          onProgress?.(100); resolve(asset);
        }catch(err:any){reject(new Error(err?.message||'Arquivo enviado, mas não foi possível registrar o asset.'));}
      });
    });
  },

  async updateAsset(assetId:string,updates:{name?:string;alias?:string;category?:AssetCategory;public_url?:string}):Promise<Asset>{
    const now=new Date().toISOString(); const payload:any={...updates,updated_at:now}; if(updates.alias) payload.alias=sanitizeAlias(updates.alias);
    await updateDoc(doc(db,'assets',assetId),payload); const list=await this.listAssets(); const found=list.find(a=>a.asset_id===assetId); if(!found) throw new Error('Asset não encontrado após atualização.'); return found;
  },
  async deleteAsset(assetId:string):Promise<void>{ const now=new Date().toISOString(); await updateDoc(doc(db,'assets',assetId),{deleted_at:now,updated_at:now}); }
};
