import crypto from 'crypto';
import { Asset, AssetType, AssetCategory, AssetStatus } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

export type AssetOrigin = 'UPLOAD' | 'GENERATED';
const safe=(value:string)=>encodeURIComponent(value);

export function sanitizeAlias(nameOrAlias:string):string {
  return nameOrAlias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
}

export interface CreateAssetParams {
  asset_id?:string;
  owner_user_id:string;
  type:AssetType;
  category:AssetCategory;
  name:string;
  alias?:string;
  storage_path:string;
  public_url?:string;
  thumbnail_url?:string;
  mime_type:string;
  size_bytes:number;
  width?:number|null;
  height?:number|null;
  duration_seconds?:number|null;
  status?:AssetStatus;
  origin?:AssetOrigin;
  source_generation_id?:string|null;
  source_model_id?:string|null;
  source_provider_id?:string|null;
}

async function userAssets(userId:string):Promise<Asset[]> {
  const rows=await firestoreAdminRest.runQuery({
    from:[{collectionId:'assets'}],
    where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit:500,
  });
  return rows.map((row:any)=>row.data as Asset);
}

export const assetRepository={
  async listUserAssets(userId:string,filters?:{type?:AssetType;category?:AssetCategory;search?:string}):Promise<Asset[]> {
    const search=filters?.search?.toLowerCase().trim();
    return (await userAssets(userId)).filter((asset)=>{
      if(asset.deleted_at)return false;
      if(filters?.type&&asset.type!==filters.type)return false;
      if(filters?.category&&asset.category!==filters.category)return false;
      if(search&&!String(asset.name||'').toLowerCase().includes(search)&&!String(asset.alias||'').toLowerCase().includes(search))return false;
      return true;
    }).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  },

  async getAsset(assetId:string,userId:string):Promise<Asset|null> {
    const doc=await firestoreAdminRest.get(`assets/${safe(assetId)}`);
    if(!doc.exists)return null;
    const asset=doc.data as Asset;
    return asset.owner_user_id===userId&&!asset.deleted_at?asset:null;
  },

  async findByAlias(alias:string,userId:string):Promise<Asset|null> {
    const clean=sanitizeAlias(alias);
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:'assets'}],
      where:{compositeFilter:{op:'AND',filters:[
        {fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},
        {fieldFilter:{field:{fieldPath:'alias'},op:'EQUAL',value:{stringValue:clean}}},
      ]}},
      limit:10,
    });
    const asset=rows.map((row:any)=>row.data as Asset).find((row)=>!row.deleted_at);
    return asset||null;
  },

  async createAsset(params:CreateAssetParams):Promise<Asset> {
    const assetId=params.asset_id||`ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const existingId=await firestoreAdminRest.get(`assets/${safe(assetId)}`);
    if(existingId.exists) {
      const existing=existingId.data as Asset;
      if(existing.owner_user_id!==params.owner_user_id)throw new Error('Asset já existe para outro usuário.');
      return existing;
    }

    const base=sanitizeAlias(params.alias||params.name)||`asset_${Date.now().toString().slice(-6)}`;
    let alias=base,i=1;
    while(await this.findByAlias(alias,params.owner_user_id))alias=`${base}_${i++}`;
    const now=new Date().toISOString();
    const asset:Asset&{
      origin:AssetOrigin;
      source_generation_id:string|null;
      source_model_id:string|null;
      source_provider_id:string|null;
    }={
      asset_id:assetId,
      owner_user_id:params.owner_user_id,
      type:params.type,
      category:params.category,
      name:params.name.trim(),
      alias,
      storage_path:params.storage_path,
      public_url:params.public_url||'',
      thumbnail_url:params.thumbnail_url||params.public_url||'',
      mime_type:params.mime_type,
      size_bytes:params.size_bytes,
      width:params.width??null,
      height:params.height??null,
      duration_seconds:params.duration_seconds??null,
      status:params.status||'READY',
      origin:params.origin||'UPLOAD',
      source_generation_id:params.source_generation_id??null,
      source_model_id:params.source_model_id??null,
      source_provider_id:params.source_provider_id??null,
      created_at:now,
      updated_at:now,
      deleted_at:null,
    };
    await firestoreAdminRest.set(`assets/${safe(assetId)}`,asset);
    return asset;
  },

  async updateAsset(assetId:string,userId:string,updates:{name?:string;alias?:string;category?:AssetCategory;status?:AssetStatus;public_url?:string}):Promise<Asset> {
    const existing=await this.getAsset(assetId,userId);
    if(!existing)throw new Error('Asset não encontrado ou sem permissão.');
    const nextUpdates={...updates};
    if(nextUpdates.alias&&nextUpdates.alias!==existing.alias){
      const clean=sanitizeAlias(nextUpdates.alias);
      if(!clean)throw new Error('Alias inválido.');
      const collision=await this.findByAlias(clean,userId);
      if(collision&&collision.asset_id!==assetId)throw new Error(`O alias @${clean} já está em uso.`);
      nextUpdates.alias=clean;
    }
    const next={...existing,...nextUpdates,updated_at:new Date().toISOString()};
    await firestoreAdminRest.set(`assets/${safe(assetId)}`,next);
    return next as Asset;
  },

  async softDeleteAsset(assetId:string,userId:string):Promise<boolean> {
    const existing=await this.getAsset(assetId,userId);
    if(!existing)throw new Error('Asset não encontrado ou sem permissão.');
    const now=new Date().toISOString();
    await firestoreAdminRest.set(`assets/${safe(assetId)}`,{...existing,deleted_at:now,updated_at:now});
    return true;
  },
};
