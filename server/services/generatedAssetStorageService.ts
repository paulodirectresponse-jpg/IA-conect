import { r2AssetStorageService } from './r2AssetStorageService.js';

export interface ArchivedGeneratedAsset{
  storage_path:string;
  public_url:string;
  mime_type:string;
  size_bytes:number;
}

export const generatedAssetStorageService={
  archive(params:{userId:string;assetId:string;sourceUrl:string;fallbackMime:string;fallbackExtension:string}):Promise<ArchivedGeneratedAsset>{
    return r2AssetStorageService.archive(params);
  },
};
