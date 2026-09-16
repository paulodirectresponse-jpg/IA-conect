import crypto from 'crypto';
import { AssetType } from '../../../src/types/index.js';
import { assetRepository } from '../../repositories/assetRepository.js';
import { publicUniversalAsset } from '../assets/universalAssetService.js';
import { betaLibraryRepository, BetaLibraryItemRecord } from './libraryRepository.js';
import { BetaCollectionView, BetaLibraryAssetView, BetaLibraryFilters, BetaLibraryIntent, BetaLibraryPage, BetaProjectView } from './libraryTypes.js';

const encodeCursor=(value:{created_at:string;asset_id:string})=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
function decodeCursor(value?:string){
  if(!value)return null;
  try{
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if(typeof parsed?.created_at==='string'&&typeof parsed?.asset_id==='string')return parsed as{created_at:string;asset_id:string};
  }catch{}
  throw Object.assign(new Error('Cursor inválido.'),{code:'VALIDATION_ERROR'});
}
const cleanTag=(value:any)=>String(value||'').trim().toLowerCase().replace(/^#+/,'').slice(0,32);

function emptyMeta(assetId:string):Pick<BetaLibraryItemRecord,'asset_id'|'project_id'|'collection_ids'|'tags'|'is_favorite'>{
  return{asset_id:assetId,project_id:null,collection_ids:[],tags:[],is_favorite:false};
}
function toLibraryAsset(asset:any,meta?:BetaLibraryItemRecord|null):BetaLibraryAssetView{
  const base=publicUniversalAsset(asset);
  const value=meta||emptyMeta(asset.asset_id);
  return{...base,project_id:value.project_id||null,collection_ids:value.collection_ids||[],tags:value.tags||[],is_favorite:Boolean(value.is_favorite)};
}
function compareDesc(a:BetaLibraryAssetView,b:BetaLibraryAssetView){
  const date=Date.parse(b.created_at)-Date.parse(a.created_at);
  return date||b.asset_id.localeCompare(a.asset_id);
}
function afterCursor(item:BetaLibraryAssetView,cursor:{created_at:string;asset_id:string}){
  const itemTime=Date.parse(item.created_at),cursorTime=Date.parse(cursor.created_at);
  return itemTime<cursorTime||(itemTime===cursorTime&&item.asset_id<cursor.asset_id);
}
function suggestedTargets(type:AssetType){
  if(type==='IMAGE')return['image','video','3d'];
  if(type==='VIDEO')return['video'];
  if(type==='AUDIO')return['audio'];
  return['3d'];
}

async function ownedAsset(userId:string,assetId:string){
  const asset=await assetRepository.getAsset(assetId,userId);
  if(!asset)throw Object.assign(new Error('Asset não encontrado.'),{code:'ASSET_NOT_FOUND'});
  return asset;
}
async function validateOrganization(userId:string,patch:{project_id?:string|null;collection_ids?:string[]}){
  if(patch.project_id&&!(await betaLibraryRepository.getProject(patch.project_id,userId))){
    throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND'});
  }
  const collections=[];
  for(const collectionId of Array.from(new Set(patch.collection_ids||[])).slice(0,50)){
    const collection=await betaLibraryRepository.getCollection(collectionId,userId);
    if(!collection)throw Object.assign(new Error('Coleção não encontrada.'),{code:'COLLECTION_NOT_FOUND'});
    if(patch.project_id&&collection.project_id&&collection.project_id!==patch.project_id){
      throw Object.assign(new Error('A coleção pertence a outro projeto.'),{code:'COLLECTION_PROJECT_MISMATCH'});
    }
    collections.push(collectionId);
  }
  return collections;
}

export const betaLibraryService={
  async listPage(userId:string,filters:BetaLibraryFilters={}):Promise<BetaLibraryPage>{
    const limit=Math.min(60,Math.max(1,Math.floor(Number(filters.limit||24))));
    const cursor=decodeCursor(filters.cursor);
    const [assets,metadata]=await Promise.all([
      assetRepository.listUserAssets(userId,{type:filters.type,search:filters.search,includeUniversal:true}),
      betaLibraryRepository.listItems(userId),
    ]);
    const metaMap=new Map(metadata.map(row=>[row.asset_id,row]));
    const origin=String(filters.origin||'').toUpperCase();
    const tag=cleanTag(filters.tag);
    let rows=assets.map(asset=>toLibraryAsset(asset,metaMap.get(asset.asset_id))).filter(item=>{
      if(origin&&item.origin.toUpperCase()!==origin)return false;
      if(filters.favorite===true&&!item.is_favorite)return false;
      if(filters.project_id&&item.project_id!==filters.project_id)return false;
      if(filters.collection_id&&!item.collection_ids.includes(filters.collection_id))return false;
      if(tag&&!item.tags.includes(tag))return false;
      return true;
    }).sort(compareDesc);
    if(cursor)rows=rows.filter(item=>afterCursor(item,cursor));
    const page=rows.slice(0,limit+1);
    const hasMore=page.length>limit;
    const items=hasMore?page.slice(0,limit):page;
    const last=items.at(-1);
    return{items,has_more:hasMore,next_cursor:hasMore&&last?encodeCursor({created_at:last.created_at,asset_id:last.asset_id}):null};
  },

  async updateAssetOrganization(userId:string,assetId:string,patch:any){
    const asset=await ownedAsset(userId,assetId);
    const collectionIds=patch.collection_ids===undefined?undefined:await validateOrganization(userId,{project_id:patch.project_id,collection_ids:Array.isArray(patch.collection_ids)?patch.collection_ids.map(String):[]});
    if(patch.project_id!==undefined)await validateOrganization(userId,{project_id:patch.project_id?String(patch.project_id):null});
    const meta=await betaLibraryRepository.upsertItem(userId,assetId,{
      project_id:patch.project_id===undefined?undefined:(patch.project_id?String(patch.project_id):null),
      collection_ids:collectionIds,
      tags:patch.tags,
      is_favorite:patch.is_favorite,
    });
    return toLibraryAsset(asset,meta);
  },

  async projects(userId:string):Promise<BetaProjectView[]>{
    const [projects,collections,items]=await Promise.all([
      betaLibraryRepository.listProjects(userId),betaLibraryRepository.listCollections(userId),betaLibraryRepository.listItems(userId),
    ]);
    return projects.map(project=>({
      project_id:project.project_id,name:project.name,description:project.description,cover_asset_id:project.cover_asset_id,
      asset_count:items.filter(item=>item.project_id===project.project_id).length,
      collection_count:collections.filter(collection=>collection.project_id===project.project_id).length,
      created_at:project.created_at,updated_at:project.updated_at,
    }));
  },
  async createProject(userId:string,input:any){
    if(input?.cover_asset_id)await ownedAsset(userId,String(input.cover_asset_id));
    await betaLibraryRepository.createProject(userId,input);
    return this.projects(userId);
  },
  async updateProject(userId:string,projectId:string,input:any){
    if(input?.cover_asset_id)await ownedAsset(userId,String(input.cover_asset_id));
    await betaLibraryRepository.updateProject(projectId,userId,input);
    return this.projects(userId);
  },
  async deleteProject(userId:string,projectId:string){
    await betaLibraryRepository.deleteProject(projectId,userId);
    return this.projects(userId);
  },

  async collections(userId:string):Promise<BetaCollectionView[]>{
    const [collections,items]=await Promise.all([betaLibraryRepository.listCollections(userId),betaLibraryRepository.listItems(userId)]);
    return collections.map(collection=>({
      collection_id:collection.collection_id,project_id:collection.project_id,name:collection.name,description:collection.description,
      asset_count:items.filter(item=>item.collection_ids.includes(collection.collection_id)).length,
      created_at:collection.created_at,updated_at:collection.updated_at,
    }));
  },
  async createCollection(userId:string,input:any){await betaLibraryRepository.createCollection(userId,input);return this.collections(userId);},
  async updateCollection(userId:string,collectionId:string,input:any){await betaLibraryRepository.updateCollection(collectionId,userId,input);return this.collections(userId);},
  async deleteCollection(userId:string,collectionId:string){await betaLibraryRepository.deleteCollection(collectionId,userId);return this.collections(userId);},

  async intent(userId:string,assetId:string,action:'REMIX'|'USE_IN'):Promise<BetaLibraryIntent>{
    const asset=await ownedAsset(userId,assetId);
    const meta=await betaLibraryRepository.getItem(userId,assetId);
    return{
      intent_id:`lintent_${crypto.randomUUID()}`,action,asset:toLibraryAsset(asset,meta),
      suggested_targets:suggestedTargets(asset.type),created_at:new Date().toISOString(),
    };
  },
};
