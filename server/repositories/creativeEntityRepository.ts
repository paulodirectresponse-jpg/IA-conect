import crypto from 'crypto';
import { firestoreAdminRest } from './firestoreAdminRest.js';

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

const safe=(value:string)=>encodeURIComponent(value);
const migratedUsers=new Set<string>();

async function migrateLegacy(userId:string){
  if(migratedUsers.has(userId))return;
  const prefPath=`user_preferences/${safe(userId)}`;
  const pref=await firestoreAdminRest.get(prefPath);
  const data=(pref.exists?pref.data:{}) as Record<string,any>;
  const legacy=Array.isArray(data.creative_entities)?data.creative_entities:[];
  for(const row of legacy){
    const entityId=String(row?.entity_id||`ent_migrated_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    const existing=await firestoreAdminRest.get(`creative_entities/${safe(entityId)}`);
    if(existing.exists)continue;
    const now=new Date().toISOString();
    const entity:CreativeEntity={
      entity_id:entityId,
      owner_user_id:userId,
      kind:(['CHARACTER','PRODUCT','STYLE','PROJECT'].includes(String(row?.kind))?row.kind:'PROJECT') as CreativeEntityKind,
      name:String(row?.name||'Entidade migrada'),
      description:String(row?.description||''),
      cover_asset_id:row?.cover_asset_id??null,
      cover_url:row?.cover_url??null,
      asset_ids:Array.isArray(row?.asset_ids)?row.asset_ids:[],
      asset_roles:row?.asset_roles||{},
      project_id:row?.kind==='PROJECT'?null:(row?.project_id??null),
      status:row?.status==='ARCHIVED'?'ARCHIVED':'ACTIVE',
      created_at:String(row?.created_at||now),
      updated_at:String(row?.updated_at||now),
    };
    await firestoreAdminRest.set(`creative_entities/${safe(entityId)}`,entity);
  }
  if(legacy.length){
    const {creative_entities:_legacy,...rest}=data;
    await firestoreAdminRest.set(prefPath,{...rest,user_id:userId,updated_at:new Date().toISOString()});
  }
  migratedUsers.add(userId);
}

async function listOwned(userId:string):Promise<CreativeEntity[]>{
  await migrateLegacy(userId);
  const rows=await firestoreAdminRest.runQuery({
    from:[{collectionId:'creative_entities'}],
    where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit:500,
  });
  return rows.map((row:any)=>row.data as CreativeEntity);
}

export const creativeEntityRepository={
  async list(userId:string,kind?:CreativeEntityKind,projectId?:string|null):Promise<CreativeEntity[]>{
    return (await listOwned(userId))
      .filter((row)=>!kind||row.kind===kind)
      .filter((row)=>row.status!=='ARCHIVED')
      .filter((row)=>!kind||kind==='PROJECT'||projectId===undefined||(row.project_id||null)===(projectId||null))
      .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  },

  async get(entityId:string,userId:string):Promise<CreativeEntity|null>{
    await migrateLegacy(userId);
    const doc=await firestoreAdminRest.get(`creative_entities/${safe(entityId)}`);
    if(!doc.exists)return null;
    const entity=doc.data as CreativeEntity;
    return entity.owner_user_id===userId?entity:null;
  },

  async save(userId:string,input:Partial<CreativeEntity>&{kind:CreativeEntityKind;name:string}):Promise<CreativeEntity>{
    await migrateLegacy(userId);
    const entityId=input.entity_id||`ent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const previous=input.entity_id?await this.get(entityId,userId):null;
    if(input.entity_id&&!previous)throw new Error('Entidade não encontrada ou sem permissão.');
    const now=new Date().toISOString();
    const value:CreativeEntity={
      entity_id:entityId,
      owner_user_id:userId,
      kind:input.kind,
      name:String(input.name||'').trim(),
      description:String(input.description||'').trim(),
      cover_asset_id:input.cover_asset_id??previous?.cover_asset_id??null,
      cover_url:input.cover_url??previous?.cover_url??null,
      asset_ids:Array.from(new Set(input.asset_ids??previous?.asset_ids??[])),
      asset_roles:input.asset_roles??previous?.asset_roles??{},
      project_id:input.kind==='PROJECT'?null:(input.project_id??previous?.project_id??null),
      status:input.status??previous?.status??'ACTIVE',
      created_at:previous?.created_at||input.created_at||now,
      updated_at:now,
    };
    if(!value.name)throw new Error('Nome é obrigatório.');
    await firestoreAdminRest.set(`creative_entities/${safe(entityId)}`,value);
    return value;
  },

  async setProjectAssets(userId:string,projectId:string,assetIds:string[]):Promise<CreativeEntity>{
    const project=await this.get(projectId,userId);
    if(!project||project.kind!=='PROJECT')throw new Error('Projeto não encontrado.');
    return this.save(userId,{...project,kind:'PROJECT',name:project.name,asset_ids:Array.from(new Set(assetIds))});
  },

  async toggleProjectAsset(userId:string,projectId:string,assetId:string):Promise<CreativeEntity>{
    const project=await this.get(projectId,userId);
    if(!project||project.kind!=='PROJECT')throw new Error('Projeto não encontrado.');
    const current=new Set(project.asset_ids||[]);
    current.has(assetId)?current.delete(assetId):current.add(assetId);
    return this.save(userId,{...project,kind:'PROJECT',name:project.name,asset_ids:[...current]});
  },

  async archive(userId:string,entityId:string):Promise<CreativeEntity>{
    const entity=await this.get(entityId,userId);
    if(!entity)throw new Error('Entidade não encontrada.');
    return this.save(userId,{...entity,kind:entity.kind,name:entity.name,status:'ARCHIVED'});
  },

  async remove(userId:string,entityId:string):Promise<boolean>{
    const entity=await this.get(entityId,userId);
    if(!entity)return false;
    await firestoreAdminRest.commit([{delete:firestoreAdminRest.docName(`creative_entities/${safe(entityId)}`)}]);
    return true;
  },
};
