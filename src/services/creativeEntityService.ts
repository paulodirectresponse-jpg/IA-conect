import { apiRequest } from './apiClient.js';

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
    return apiRequest<CreativeEntity[]>(`/api/creative-entities?${params.toString()}`);
  },

  listProjects():Promise<CreativeEntity[]>{
    return this.list('PROJECT');
  },

  save(input:Partial<CreativeEntity>&{kind:CreativeEntityKind;name:string}):Promise<CreativeEntity>{
    return apiRequest<CreativeEntity>('/api/creative-entities',{method:'POST',body:JSON.stringify(input)});
  },

  setProjectAssets(projectId:string,assetIds:string[]):Promise<CreativeEntity>{
    return apiRequest<CreativeEntity>(`/api/creative-entities/${encodeURIComponent(projectId)}/assets`,{
      method:'PUT',
      body:JSON.stringify({asset_ids:Array.from(new Set(assetIds))}),
    });
  },

  toggleProjectAsset(projectId:string,assetId:string):Promise<CreativeEntity>{
    return apiRequest<CreativeEntity>(
      `/api/creative-entities/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/toggle`,
      {method:'POST'},
    );
  },

  async archive(entityId:string):Promise<void>{
    await apiRequest(`/api/creative-entities/${encodeURIComponent(entityId)}/archive`,{method:'PATCH'});
  },

  async remove(entityId:string):Promise<void>{
    await apiRequest(`/api/creative-entities/${encodeURIComponent(entityId)}`,{method:'DELETE'});
  },
};
