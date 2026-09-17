import { ProviderRegistryItem, ModelRegistryItem } from '../../src/types/index.js';
import { CURATED_MODEL_SEEDS } from '../../src/config/curatedModelInventory.js';
import { catalogRepository } from '../repositories/catalogRepository.js';

const now=()=>new Date().toISOString();

/**
 * Canonical provider control-plane catalog.
 *
 * IMPORTANT FOR CLOUDFLARE WORKERS:
 * Read paths must not seed the full curated model inventory. Doing dozens of
 * Firestore writes inside one request can exceed the Worker subrequest budget
 * and return a platform-level 503 before Express can serialize JSON.
 *
 * Provider definitions are therefore merged in memory with persisted Admin
 * overrides. Provider/model rows are persisted lazily only when an operation
 * actually needs a durable record (for example, approving a mapping).
 */
export const PROVIDER_DEFINITIONS:ProviderRegistryItem[]=[
  {provider_id:'provider-wavespeed',name:'WaveSpeed AI',slug:'wavespeed',status:'ACTIVE',priority:110,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',status:'ACTIVE',priority:100,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-runware',name:'Runware',slug:'runware',status:'ACTIVE',priority:95,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-fal',name:'fal.ai',slug:'fal',status:'ACTIVE',priority:90,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-deepinfra',name:'DeepInfra',slug:'deepinfra',status:'ACTIVE',priority:85,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-replicate',name:'Replicate',slug:'replicate',status:'ACTIVE',priority:80,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-aiml',name:'AI/ML API',slug:'aiml',status:'ACTIVE',priority:75,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-piapi',name:'PiAPI',slug:'piapi',status:'ACTIVE',priority:70,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-kie',name:'Kie.ai',slug:'kie',status:'ACTIVE',priority:65,is_configured:false,created_at:now(),updated_at:now()},
];

const definitionById=new Map(PROVIDER_DEFINITIONS.map(item=>[item.provider_id,item]));
const modelSeedById=new Map(CURATED_MODEL_SEEDS.map(item=>[item.model_id,item]));

function mergeProviders(existing:ProviderRegistryItem[]){
  const stored=new Map(existing.map(item=>[String(item.provider_id),item]));
  const canonical=PROVIDER_DEFINITIONS.map(definition=>{
    const override=stored.get(definition.provider_id);
    return override?{...definition,...override,provider_id:definition.provider_id}:definition;
  });
  const known=new Set(PROVIDER_DEFINITIONS.map(item=>item.provider_id));
  const custom=existing.filter(item=>!known.has(String(item.provider_id)));
  return [...canonical,...custom];
}

async function listProviders(){
  const existing=await catalogRepository.listProviders();
  return mergeProviders(existing);
}

async function getProvider(providerId:string){
  const existing=await catalogRepository.getProvider(providerId);
  if(existing)return existing;
  return definitionById.get(providerId)||null;
}

async function ensureProviderRecord(providerId:string){
  const existing=await catalogRepository.getProvider(providerId);
  if(existing)return existing;
  const definition=definitionById.get(providerId);
  if(!definition)return null;
  return catalogRepository.saveProvider({...definition,created_at:now(),updated_at:now()});
}

async function ensureCuratedModel(modelId:string):Promise<ModelRegistryItem|null>{
  const existing=await catalogRepository.getModel(modelId);
  if(existing)return existing;
  const seed=modelSeedById.get(modelId);
  if(!seed)return null;
  return catalogRepository.saveModel({...seed,created_at:seed.created_at||now(),updated_at:now()});
}

/**
 * Backwards-compatible hook used by older catalog routes.
 * It is intentionally read-only now. Curated models are created lazily via
 * ensureCuratedModel() when a verified mapping is approved.
 */
async function ensureSeeded(){return;}

export const providerCatalogService={
  listProviders,
  getProvider,
  ensureProviderRecord,
  ensureCuratedModel,
  ensureSeeded,
};