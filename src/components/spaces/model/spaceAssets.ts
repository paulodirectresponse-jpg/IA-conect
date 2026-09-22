import type{Asset}from'../../../types/index.js';
import type{SpaceAsset}from'../../../services/spacesClient.js';

export function spaceAssetToLibraryAsset(asset:SpaceAsset):Asset{
 return{
  asset_id:asset.asset_id,
  owner_user_id:'',
  type:asset.type,
  category:asset.category as Asset['category'],
  name:asset.name,
  alias:asset.alias,
  storage_path:'',
  thumbnail_storage_path:'',
  public_url:asset.public_url||undefined,
  thumbnail_url:asset.preview_url||asset.public_url||undefined,
  preview_url:asset.preview_url,
  preview_mime_type:asset.preview_mime_type,
  mime_type:asset.mime_type,
  size_bytes:asset.size_bytes,
  width:asset.width,
  height:asset.height,
  duration_seconds:asset.duration_seconds,
  status:asset.status as Asset['status'],
  created_at:asset.created_at,
  updated_at:asset.updated_at,
  deleted_at:null,
  origin:asset.origin,
  source_generation_id:asset.source_generation_id,
  source_job_id:asset.source_job_id,
  derived_from_asset_id:asset.derived_from_asset_id,
  source_output_index:asset.source_output_index,
  source_model_id:asset.source_model_id,
  media_metadata:asset.media_metadata,
 };
}

export function sameUniversalAsset(a:{asset_id:string}|null|undefined,b:{asset_id:string}|null|undefined){
 return Boolean(a?.asset_id&&b?.asset_id&&a.asset_id===b.asset_id);
}

export function libraryAssetToSpaceAsset(asset:Asset):SpaceAsset{
 return{
  asset_id:asset.asset_id,
  type:asset.type,
  category:String(asset.category||'GENERIC'),
  name:asset.name,
  alias:asset.alias,
  status:String(asset.status||'READY'),
  origin:String(asset.origin||'UPLOAD'),
  public_url:asset.public_url||null,
  preview_url:asset.preview_url||asset.thumbnail_url||asset.public_url||null,
  preview_mime_type:asset.preview_mime_type||null,
  mime_type:asset.mime_type,
  size_bytes:asset.size_bytes,
  width:asset.width??null,
  height:asset.height??null,
  duration_seconds:asset.duration_seconds??null,
  source_generation_id:asset.source_generation_id??null,
  source_job_id:asset.source_job_id??null,
  derived_from_asset_id:asset.derived_from_asset_id??null,
  source_output_index:asset.source_output_index??null,
  source_model_id:asset.source_model_id??null,
  media_metadata:asset.media_metadata||{},
  created_at:asset.created_at,
  updated_at:asset.updated_at,
 };
}
