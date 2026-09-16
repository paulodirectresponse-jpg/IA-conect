import { AssetType } from '../../../src/types/index.js';
import { UniversalAssetView } from '../assets/universalAssetService.js';

export interface BetaProjectView{
  project_id:string;name:string;description:string;cover_asset_id:string|null;asset_count:number;collection_count:number;
  created_at:string;updated_at:string;
}
export interface BetaCollectionView{
  collection_id:string;project_id:string|null;name:string;description:string;asset_count:number;created_at:string;updated_at:string;
}
export interface BetaLibraryAssetView extends UniversalAssetView{
  project_id:string|null;collection_ids:string[];tags:string[];is_favorite:boolean;
}
export interface BetaLibraryPage{
  items:BetaLibraryAssetView[];next_cursor:string|null;has_more:boolean;
}
export interface BetaLibraryFilters{
  type?:AssetType;search?:string;origin?:string;favorite?:boolean;project_id?:string;collection_id?:string;tag?:string;
  limit?:number;cursor?:string;
}
export interface BetaLibraryIntent{
  intent_id:string;action:'REMIX'|'USE_IN';asset:BetaLibraryAssetView;suggested_targets:string[];created_at:string;
}
