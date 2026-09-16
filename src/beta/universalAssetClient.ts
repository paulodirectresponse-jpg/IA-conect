import { apiRequest } from '../services/apiClient.js';
import { AssetType } from '../types/index.js';

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

export const universalAssetClient={
  list(filters?:{type?:AssetType;search?:string}){
    const params=new URLSearchParams();
    if(filters?.type)params.set('type',filters.type);
    if(filters?.search)params.set('search',filters.search);
    return apiRequest<UniversalAssetView[]>(`/api/beta/assets${params.size?`?${params.toString()}`:''}`);
  },
  get(assetId:string){
    return apiRequest<UniversalAssetView>(`/api/beta/assets/${encodeURIComponent(assetId)}`);
  },
  lineage(assetId:string){
    return apiRequest<UniversalAssetView[]>(`/api/beta/assets/${encodeURIComponent(assetId)}/lineage`);
  },
};
