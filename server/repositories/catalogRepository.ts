import {
  ModelRegistryItem,
  ProviderRegistryItem,
  ProviderModelMapping,
  PromotionEntry,
  FeatureFlag,
} from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';
import { INITIAL_FEATURE_FLAGS } from '../../src/config/constants.js';
import { STUDIO_SEED_MODELS } from '../../src/config/studioCatalog.js';

const now=()=>new Date().toISOString();
const safe=(value:string)=>encodeURIComponent(value);

/** Seeds only. Runtime source of truth is Firestore. */
export const MODEL_CATALOG:ModelRegistryItem[]=STUDIO_SEED_MODELS;
export const PROVIDER_CATALOG:ProviderRegistryItem[]=[
  {provider_id:'provider-wavespeed',name:'WaveSpeed AI',slug:'wavespeed',status:'ACTIVE',priority:110,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',status:'ACTIVE',priority:100,is_configured:false,created_at:now(),updated_at:now()},
];
const mapping=(id:string,model_id:string,provider_id:string,provider_model_identifier:string):ProviderModelMapping=>({
  mapping_id:id,model_id,provider_id,provider_model_identifier,status:'ACTIVE',updated_at:now(),
});
export const MODEL_MAPPINGS:ProviderModelMapping[]=[
  mapping('map-wan3p-atlas','wan-3-0-prime','provider-atlas','alibaba/wan-3.0-prime'),
  mapping('map-wan3p-wave','wan-3-0-prime','provider-wavespeed','alibaba/wan-3.0-prime'),
  mapping('map-seed25-atlas','seedance-2-5','provider-atlas','bytedance/seedance-2.5'),
  mapping('map-seed25-wave','seedance-2-5','provider-wavespeed','bytedance/seedance-2.5'),
  mapping('map-wan3-atlas','wan-3-0','provider-atlas','alibaba/wan-3.0'),
  mapping('map-wan3-wave','wan-3-0','provider-wavespeed','alibaba/wan-3.0'),
  mapping('map-h3-atlas','minimax-h3','provider-atlas','minimax/h3'),
  mapping('map-h3-wave','minimax-h3','provider-wavespeed','wavespeed-ai/minimax-h3'),
  mapping('map-seed20-atlas','seedance-2-0','provider-atlas','bytedance/seedance-2.0'),
  mapping('map-kling30-wave','kling-3-0','provider-wavespeed','kwaivgi/kling-v3.0-std'),
  mapping('map-omni-flash-wave','google-omni-flash','provider-wavespeed','google/gemini-omni-1.1-flash'),
  mapping('map-banana-pro-wave','nano-banana-pro-image','provider-wavespeed','google/nano-banana-pro'),
  mapping('map-banana2-wave','nano-banana-2-image','provider-wavespeed','google/nano-banana-2'),
  mapping('map-banana2-lite-wave','nano-banana-2-lite-image','provider-wavespeed','google/nano-banana-2-lite'),
  mapping('map-seed5-wave','seedream-5-pro-image','provider-wavespeed','bytedance/seedream-v5.0-pro'),
  mapping('map-gptimg2-wave','gpt-image-2','provider-wavespeed','openai/gpt-image-2'),
  mapping('map-banana-pro-atlas','nano-banana-pro-image','provider-atlas','google/nano-banana-pro'),
  mapping('map-banana2-atlas','nano-banana-2-image','provider-atlas','google/nano-banana-2'),
  mapping('map-seed5-atlas','seedream-5-pro-image','provider-atlas','bytedance/seedream-v5.0-pro'),
  mapping('map-gptimg2-atlas','gpt-image-2','provider-atlas','openai/gpt-image-2'),
];
const FEATURE_FLAG_SEED:FeatureFlag[]=INITIAL_FEATURE_FLAGS.map((flag)=>({...flag,updated_at:now()}));

async function listCollection<T>(collectionId:string):Promise<T[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId}],limit:500});
  return rows.map((row:any)=>row.data as T);
}

async function ensureSeed<T extends Record<string,any>>(
  collectionId:string,
  idField:keyof T,
  seed:T[],
):Promise<T[]>{
  const rows=await listCollection<T>(collectionId);
  const existing=new Set(rows.map((row)=>String(row[idField]||'')));
  const missing=seed.filter((row)=>!existing.has(String(row[idField]||'')));
  if(!missing.length)return rows;
  const writes=missing
    .map((row)=>{
      const id=String(row[idField]||'');
      return id?{
        update:{name:firestoreAdminRest.docName(`${collectionId}/${safe(id)}`),fields:firestoreAdminRest.fields(row)},
        currentDocument:{exists:false},
      }:null;
    })
    .filter(Boolean);
  try{
    if(writes.length)await firestoreAdminRest.commit(writes as any[]);
    return [...rows,...missing];
  }catch{
    // Another cold start may have seeded concurrently; re-read instead of overwriting.
    return listCollection<T>(collectionId);
  }
}

async function save<T extends Record<string,any>>(collectionId:string,id:string,value:T):Promise<T>{
  const next={...value,updated_at:now()};
  await firestoreAdminRest.set(`${collectionId}/${safe(id)}`,next);
  return next as T;
}

export const catalogRepository={
  async listModels(){
    const rows=await ensureSeed<ModelRegistryItem>('models','model_id',MODEL_CATALOG);
    const seedOrder=new Map(MODEL_CATALOG.map((model,index)=>[model.model_id,index]));
    return rows.filter((row)=>row.status!=='INACTIVE').sort((a,b)=>{
      const ai=seedOrder.get(a.model_id)??Number.MAX_SAFE_INTEGER;
      const bi=seedOrder.get(b.model_id)??Number.MAX_SAFE_INTEGER;
      return ai-bi||a.name.localeCompare(b.name);
    });
  },
  async getModel(id:string){
    await ensureSeed<ModelRegistryItem>('models','model_id',MODEL_CATALOG);
    const doc=await firestoreAdminRest.get(`models/${safe(id)}`);
    if(!doc.exists)return null;
    const model=doc.data as ModelRegistryItem;
    return model.status!=='INACTIVE'?model:null;
  },
  async saveModel(value:ModelRegistryItem){
    return save('models',value.model_id,value);
  },

  async listProviders(){
    const rows=await ensureSeed<ProviderRegistryItem>('providers','provider_id',PROVIDER_CATALOG);
    return rows.sort((a,b)=>b.priority-a.priority);
  },
  async getProvider(id:string){
    await ensureSeed<ProviderRegistryItem>('providers','provider_id',PROVIDER_CATALOG);
    const doc=await firestoreAdminRest.get(`providers/${safe(id)}`);
    return doc.exists?doc.data as ProviderRegistryItem:null;
  },
  async saveProvider(value:ProviderRegistryItem){
    return save('providers',value.provider_id,value);
  },

  async listMappings(){
    return ensureSeed<ProviderModelMapping>('provider_models','mapping_id',MODEL_MAPPINGS);
  },
  async saveMapping(value:ProviderModelMapping){
    return save('provider_models',value.mapping_id,value);
  },

  async listPromotions(){
    return listCollection<PromotionEntry>('promotions');
  },
  async getPromotion(id:string){
    const doc=await firestoreAdminRest.get(`promotions/${safe(id)}`);
    return doc.exists?doc.data as PromotionEntry:null;
  },
  async savePromotion(value:PromotionEntry){
    const next={...value,verified_at:value.verified_at||now()};
    await firestoreAdminRest.set(`promotions/${safe(value.promotion_id)}`,next);
    return next;
  },

  async listFeatureFlags(){
    return ensureSeed<FeatureFlag>('feature_flags','flag_key',FEATURE_FLAG_SEED);
  },
  async getFeatureFlag(id:string){
    await ensureSeed<FeatureFlag>('feature_flags','flag_key',FEATURE_FLAG_SEED);
    const doc=await firestoreAdminRest.get(`feature_flags/${safe(id)}`);
    return doc.exists?doc.data as FeatureFlag:null;
  },
  async saveFeatureFlag(value:FeatureFlag){
    return save('feature_flags',value.flag_key,value);
  },

  clearForTesting(){},
};
