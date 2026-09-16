import { apiRequest } from '../services/apiClient.js';
import { AssetType } from '../types/index.js';
import { UniversalAssetView } from './universalAssetClient.js';

export interface BetaProjectView{
  project_id:string;name:string;description:string;cover_asset_id:string|null;asset_count:number;collection_count:number;created_at:string;updated_at:string;
}
export interface BetaCollectionView{
  collection_id:string;project_id:string|null;name:string;description:string;asset_count:number;created_at:string;updated_at:string;
}
export interface BetaLibraryAssetView extends UniversalAssetView{
  project_id:string|null;collection_ids:string[];tags:string[];is_favorite:boolean;
}
export interface BetaLibraryPage{items:BetaLibraryAssetView[];next_cursor:string|null;has_more:boolean;}
export interface BetaLibraryIntent{
  intent_id:string;action:'REMIX'|'USE_IN';asset:BetaLibraryAssetView;suggested_targets:string[];created_at:string;
}
export interface BetaLibraryFilters{
  type?:AssetType|'ALL';search?:string;origin?:string;favorite?:boolean;project_id?:string;collection_id?:string;tag?:string;cursor?:string;limit?:number;
}

function query(filters:BetaLibraryFilters={}){
  const params=new URLSearchParams();
  if(filters.type&&filters.type!=='ALL')params.set('type',filters.type);
  if(filters.search)params.set('search',filters.search);
  if(filters.origin)params.set('origin',filters.origin);
  if(filters.favorite!==undefined)params.set('favorite',String(filters.favorite));
  if(filters.project_id)params.set('project_id',filters.project_id);
  if(filters.collection_id)params.set('collection_id',filters.collection_id);
  if(filters.tag)params.set('tag',filters.tag);
  if(filters.cursor)params.set('cursor',filters.cursor);
  params.set('limit',String(Math.min(60,Math.max(1,filters.limit||24))));
  return params;
}

export const betaLibraryClient={
  list(filters:BetaLibraryFilters={}){
    return apiRequest<BetaLibraryPage>(`/api/beta/library/assets?${query(filters).toString()}`);
  },
  organize(assetId:string,patch:{project_id?:string|null;collection_ids?:string[];tags?:string[];is_favorite?:boolean}){
    return apiRequest<BetaLibraryAssetView>(`/api/beta/library/assets/${encodeURIComponent(assetId)}`,{
      method:'PATCH',body:JSON.stringify(patch),
    });
  },
  remix(assetId:string){
    return apiRequest<BetaLibraryIntent>(`/api/beta/library/assets/${encodeURIComponent(assetId)}/remix`,{method:'POST'});
  },
  useIn(assetId:string){
    return apiRequest<BetaLibraryIntent>(`/api/beta/library/assets/${encodeURIComponent(assetId)}/use-in`,{method:'POST'});
  },

  projects(){return apiRequest<BetaProjectView[]>('/api/beta/projects');},
  createProject(input:{name:string;description?:string}){return apiRequest<BetaProjectView[]>('/api/beta/projects',{method:'POST',body:JSON.stringify(input)});},
  updateProject(projectId:string,input:{name?:string;description?:string}){return apiRequest<BetaProjectView[]>(`/api/beta/projects/${encodeURIComponent(projectId)}`,{method:'PATCH',body:JSON.stringify(input)});},
  deleteProject(projectId:string){return apiRequest<BetaProjectView[]>(`/api/beta/projects/${encodeURIComponent(projectId)}`,{method:'DELETE'});},

  collections(){return apiRequest<BetaCollectionView[]>('/api/beta/collections');},
  createCollection(input:{name:string;description?:string;project_id?:string|null}){return apiRequest<BetaCollectionView[]>('/api/beta/collections',{method:'POST',body:JSON.stringify(input)});},
  updateCollection(collectionId:string,input:{name?:string;description?:string;project_id?:string|null}){return apiRequest<BetaCollectionView[]>(`/api/beta/collections/${encodeURIComponent(collectionId)}`,{method:'PATCH',body:JSON.stringify(input)});},
  deleteCollection(collectionId:string){return apiRequest<BetaCollectionView[]>(`/api/beta/collections/${encodeURIComponent(collectionId)}`,{method:'DELETE'});},
};
