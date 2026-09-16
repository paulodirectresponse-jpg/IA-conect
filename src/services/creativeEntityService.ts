import { apiRequest, apiRequestCached, invalidateApiCache } from './apiClient.js';

export type CreativeEntityKind='CHARACTER'|'PRODUCT'|'STYLE'|'PROJECT';
export type CreativeEntityAssetRole='FACE'|'BODY'|'PRIMARY';

export interface CreativeEntity {
  entity_id:string;
  owner_user_id:string;
  kind:CreativeEntityKind;
  name:string;
  description:string;
  cover_asset_id?:string|null;
  cover_url?:string|null;
  asset_ids:string[];
  asset_roles?:Partial<Record<CreativeEntityAssetRole,string>>;
  project_id?:string|null;
  status?:'ACTIVE'|'ARCHIVED';
  created_at:string;
  updated_at:string;
}

export const creativeEntityService={
  list(kind:CreativeEntityKind,projectId?:string|null):Promise<CreativeEntity[]>{
    const params=new URLSearchParams({kind});
    if(projectId!==undefined)params.set('project_id',projectId||'');
    return apiRequestCached<CreativeEntity[]>(`/api/creative-entities?${params.toString()}`,5_000);
  },

  listProjects():Promise<CreativeEntity[]>{
    return this.list('PROJECT');
  },

  async save(input:Partial<CreativeEntity>&{kind:CreativeEntityKind;name:string}):Promise<CreativeEntity>{
    const entity=await apiRequest<CreativeEntity>('/api/creative-entities',{method:'POST',body:JSON.stringify(input)});
    invalidateApiCache('/api/creative-entities');
    return entity;
  },

  async setProjectAssets(projectId:string,assetIds:string[]):Promise<CreativeEntity>{
    const entity=await apiRequest<CreativeEntity>(`/api/creative-entities/${encodeURIComponent(projectId)}/assets`,{
      method:'PUT',
      body:JSON.stringify({asset_ids:Array.from(new Set(assetIds))}),
    });
    invalidateApiCache('/api/creative-entities');
    return entity;
  },

  async toggleProjectAsset(projectId:string,assetId:string):Promise<CreativeEntity>{
    const entity=await apiRequest<CreativeEntity>(
      `/api/creative-entities/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/toggle`,
      {method:'POST'},
    );
    invalidateApiCache('/api/creative-entities');
    return entity;
  },

  async archive(entityId:string):Promise<void>{
    await apiRequest(`/api/creative-entities/${encodeURIComponent(entityId)}/archive`,{method:'PATCH'});
    invalidateApiCache('/api/creative-entities');
  },

  async remove(entityId:string):Promise<void>{
    await apiRequest(`/api/creative-entities/${encodeURIComponent(entityId)}`,{method:'DELETE'});
    invalidateApiCache('/api/creative-entities');
  },
};
