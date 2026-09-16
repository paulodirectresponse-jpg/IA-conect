import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';

const safe=(value:string)=>encodeURIComponent(value);
const now=()=>new Date().toISOString();
const id=(prefix:string)=>`${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
const itemId=(userId:string,assetId:string)=>`bli_${crypto.createHash('sha256').update(`${userId}:${assetId}`).digest('hex').slice(0,32)}`;

export interface BetaProjectRecord{
  project_id:string;user_id:string;name:string;description:string;cover_asset_id:string|null;
  created_at:string;updated_at:string;deleted_at:string|null;
}
export interface BetaCollectionRecord{
  collection_id:string;user_id:string;project_id:string|null;name:string;description:string;
  created_at:string;updated_at:string;deleted_at:string|null;
}
export interface BetaLibraryItemRecord{
  item_id:string;user_id:string;asset_id:string;project_id:string|null;collection_ids:string[];
  tags:string[];is_favorite:boolean;created_at:string;updated_at:string;
}

function cleanName(value:any,max=80){
  const name=String(value||'').trim().replace(/\s+/g,' ');
  if(!name)throw Object.assign(new Error('Nome é obrigatório.'),{code:'VALIDATION_ERROR'});
  return name.slice(0,max);
}
function cleanDescription(value:any){return String(value||'').trim().slice(0,400);}
export function normalizeTags(input:any){
  const raw=Array.isArray(input)?input:String(input||'').split(',');
  return Array.from(new Set(raw.map((tag:any)=>String(tag||'').trim().toLowerCase().replace(/^#+/,'').slice(0,32)).filter(Boolean))).slice(0,20);
}

async function queryOwned(collectionId:string,userId:string,limit=500){
  const rows=await firestoreAdminRest.runQuery({
    from:[{collectionId}],
    where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit,
  });
  return rows.map((row:any)=>row.data);
}

export const betaLibraryRepository={
  async listProjects(userId:string):Promise<BetaProjectRecord[]>{
    const rows=await queryOwned('beta_projects',userId,200) as BetaProjectRecord[];
    return rows.filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  },
  async getProject(projectId:string,userId:string):Promise<BetaProjectRecord|null>{
    const doc=await firestoreAdminRest.get(`beta_projects/${safe(projectId)}`);
    if(!doc.exists)return null;
    const row=doc.data as BetaProjectRecord;
    return row.user_id===userId&&!row.deleted_at?row:null;
  },
  async createProject(userId:string,input:any):Promise<BetaProjectRecord>{
    const timestamp=now();
    const row:BetaProjectRecord={
      project_id:id('bproj'),user_id:userId,name:cleanName(input?.name),description:cleanDescription(input?.description),
      cover_asset_id:input?.cover_asset_id?String(input.cover_asset_id):null,created_at:timestamp,updated_at:timestamp,deleted_at:null,
    };
    await firestoreAdminRest.set(`beta_projects/${safe(row.project_id)}`,row);
    return row;
  },
  async updateProject(projectId:string,userId:string,input:any):Promise<BetaProjectRecord>{
    const current=await this.getProject(projectId,userId);
    if(!current)throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND'});
    const next:BetaProjectRecord={...current,
      name:input?.name===undefined?current.name:cleanName(input.name),
      description:input?.description===undefined?current.description:cleanDescription(input.description),
      cover_asset_id:input?.cover_asset_id===undefined?current.cover_asset_id:(input.cover_asset_id?String(input.cover_asset_id):null),
      updated_at:now(),
    };
    await firestoreAdminRest.set(`beta_projects/${safe(projectId)}`,next);
    return next;
  },
  async deleteProject(projectId:string,userId:string){
    const current=await this.getProject(projectId,userId);
    if(!current)throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND'});
    const timestamp=now();
    await firestoreAdminRest.set(`beta_projects/${safe(projectId)}`,{...current,deleted_at:timestamp,updated_at:timestamp});
    const collections=await this.listCollections(userId);
    const inProject=collections.filter(row=>row.project_id===projectId);
    for(const collection of inProject){
      await firestoreAdminRest.set(`beta_collections/${safe(collection.collection_id)}`,{...collection,deleted_at:timestamp,updated_at:timestamp});
    }
    const removedIds=new Set(inProject.map(row=>row.collection_id));
    const items=await this.listItems(userId);
    for(const item of items){
      if(item.project_id!==projectId&&!item.collection_ids.some(value=>removedIds.has(value)))continue;
      await this.saveItem({...item,project_id:item.project_id===projectId?null:item.project_id,collection_ids:item.collection_ids.filter(value=>!removedIds.has(value)),updated_at:timestamp});
    }
  },

  async listCollections(userId:string):Promise<BetaCollectionRecord[]>{
    const rows=await queryOwned('beta_collections',userId,300) as BetaCollectionRecord[];
    return rows.filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  },
  async getCollection(collectionId:string,userId:string):Promise<BetaCollectionRecord|null>{
    const doc=await firestoreAdminRest.get(`beta_collections/${safe(collectionId)}`);
    if(!doc.exists)return null;
    const row=doc.data as BetaCollectionRecord;
    return row.user_id===userId&&!row.deleted_at?row:null;
  },
  async createCollection(userId:string,input:any):Promise<BetaCollectionRecord>{
    const projectId=input?.project_id?String(input.project_id):null;
    if(projectId&&!await this.getProject(projectId,userId))throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND'});
    const timestamp=now();
    const row:BetaCollectionRecord={
      collection_id:id('bcol'),user_id:userId,project_id:projectId,name:cleanName(input?.name),description:cleanDescription(input?.description),
      created_at:timestamp,updated_at:timestamp,deleted_at:null,
    };
    await firestoreAdminRest.set(`beta_collections/${safe(row.collection_id)}`,row);
    return row;
  },
  async updateCollection(collectionId:string,userId:string,input:any):Promise<BetaCollectionRecord>{
    const current=await this.getCollection(collectionId,userId);
    if(!current)throw Object.assign(new Error('Coleção não encontrada.'),{code:'COLLECTION_NOT_FOUND'});
    const projectId=input?.project_id===undefined?current.project_id:(input.project_id?String(input.project_id):null);
    if(projectId&&!await this.getProject(projectId,userId))throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND'});
    const next:BetaCollectionRecord={...current,
      project_id:projectId,
      name:input?.name===undefined?current.name:cleanName(input.name),
      description:input?.description===undefined?current.description:cleanDescription(input.description),
      updated_at:now(),
    };
    await firestoreAdminRest.set(`beta_collections/${safe(collectionId)}`,next);
    return next;
  },
  async deleteCollection(collectionId:string,userId:string){
    const current=await this.getCollection(collectionId,userId);
    if(!current)throw Object.assign(new Error('Coleção não encontrada.'),{code:'COLLECTION_NOT_FOUND'});
    const timestamp=now();
    await firestoreAdminRest.set(`beta_collections/${safe(collectionId)}`,{...current,deleted_at:timestamp,updated_at:timestamp});
    const items=await this.listItems(userId);
    for(const item of items){
      if(!item.collection_ids.includes(collectionId))continue;
      await this.saveItem({...item,collection_ids:item.collection_ids.filter(value=>value!==collectionId),updated_at:timestamp});
    }
  },

  async listItems(userId:string):Promise<BetaLibraryItemRecord[]>{
    return await queryOwned('beta_library_items',userId,500) as BetaLibraryItemRecord[];
  },
  async getItem(userId:string,assetId:string):Promise<BetaLibraryItemRecord|null>{
    const doc=await firestoreAdminRest.get(`beta_library_items/${safe(itemId(userId,assetId))}`);
    if(!doc.exists)return null;
    const row=doc.data as BetaLibraryItemRecord;
    return row.user_id===userId&&row.asset_id===assetId?row:null;
  },
  async saveItem(item:BetaLibraryItemRecord){
    await firestoreAdminRest.set(`beta_library_items/${safe(item.item_id)}`,item);
    return item;
  },
  async upsertItem(userId:string,assetId:string,patch:{project_id?:string|null;collection_ids?:string[];tags?:string[];is_favorite?:boolean}){
    const current=await this.getItem(userId,assetId);
    const timestamp=now();
    const next:BetaLibraryItemRecord={
      item_id:current?.item_id||itemId(userId,assetId),user_id:userId,asset_id:assetId,
      project_id:patch.project_id===undefined?(current?.project_id||null):patch.project_id,
      collection_ids:patch.collection_ids===undefined?(current?.collection_ids||[]):Array.from(new Set(patch.collection_ids)).slice(0,50),
      tags:patch.tags===undefined?(current?.tags||[]):normalizeTags(patch.tags),
      is_favorite:patch.is_favorite===undefined?Boolean(current?.is_favorite):Boolean(patch.is_favorite),
      created_at:current?.created_at||timestamp,updated_at:timestamp,
    };
    return this.saveItem(next);
  },
};
