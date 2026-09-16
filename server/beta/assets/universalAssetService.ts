import { Asset, AssetType } from '../../../src/types/index.js';
import { assetRepository } from '../../repositories/assetRepository.js';

export interface UniversalAssetView {
  asset_id:string;
  type:AssetType;
  category:string;
  name:string;
  alias:string;
  status:string;
  origin:string;
  public_url:string|null;
  preview_url:string|null;
  preview_mime_type:string|null;
  mime_type:string;
  size_bytes:number;
  width:number|null;
  height:number|null;
  duration_seconds:number|null;
  source_generation_id:string|null;
  source_job_id:string|null;
  derived_from_asset_id:string|null;
  source_output_index:number|null;
  source_model_id:string|null;
  media_metadata:Record<string,string|number|boolean|null>;
  created_at:string;
  updated_at:string;
}

export function publicUniversalAsset(asset:Asset):UniversalAssetView{
  return{
    asset_id:asset.asset_id,
    type:asset.type,
    category:asset.category,
    name:asset.name,
    alias:asset.alias,
    status:asset.status,
    origin:String(asset.origin||'UPLOAD'),
    public_url:asset.public_url||null,
    preview_url:asset.preview_url||asset.thumbnail_url||asset.public_url||null,
    preview_mime_type:asset.preview_mime_type||null,
    mime_type:asset.mime_type,
    size_bytes:Number(asset.size_bytes||0),
    width:asset.width??null,
    height:asset.height??null,
    duration_seconds:asset.duration_seconds??null,
    source_generation_id:asset.source_generation_id||null,
    source_job_id:asset.source_job_id||null,
    derived_from_asset_id:asset.derived_from_asset_id||null,
    source_output_index:Number.isInteger(asset.source_output_index)?Number(asset.source_output_index):null,
    source_model_id:asset.source_model_id||null,
    media_metadata:asset.media_metadata||{},
    created_at:asset.created_at,
    updated_at:asset.updated_at,
  };
}

async function ownedAsset(userId:string,assetId:string){
  const asset=await assetRepository.getAsset(assetId,userId);
  if(!asset)throw Object.assign(new Error('Asset não encontrado.'),{code:'ASSET_NOT_FOUND'});
  return asset;
}

export const universalAssetService={
  async list(userId:string,filters?:{type?:AssetType;search?:string}){
    const rows=await assetRepository.listUserAssets(userId,{type:filters?.type,search:filters?.search,includeUniversal:true});
    return rows.map(publicUniversalAsset);
  },

  async get(userId:string,assetId:string){
    return publicUniversalAsset(await ownedAsset(userId,assetId));
  },

  async lineage(userId:string,assetId:string){
    const chain:UniversalAssetView[]=[];
    const visited=new Set<string>();
    let current=await ownedAsset(userId,assetId);
    for(let depth=0;depth<25;depth++){
      if(visited.has(current.asset_id))break;
      visited.add(current.asset_id);
      chain.push(publicUniversalAsset(current));
      const parentId=String(current.derived_from_asset_id||'');
      if(!parentId)break;
      const parent=await assetRepository.getAsset(parentId,userId);
      if(!parent)break;
      current=parent;
    }
    return chain;
  },

  async assertLineageOwnership(userId:string,derivedFromAssetId?:string|null){
    if(!derivedFromAssetId)return null;
    const parent=await assetRepository.getAsset(derivedFromAssetId,userId);
    if(!parent)throw Object.assign(new Error('Asset de origem não encontrado ou sem permissão.'),{code:'ASSET_LINEAGE_FORBIDDEN'});
    return parent;
  },
};
