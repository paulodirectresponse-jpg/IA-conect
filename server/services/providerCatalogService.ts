import { ProviderRegistryItem, ModelRegistryItem } from '../../src/types/index.js';
import { CURATED_CANONICAL_MODELS } from '../../src/config/curatedModelInventory.js';
import { canonicalModelId } from '../../src/config/modelCanonicalization.js';
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
const modelSeedById=new Map(CURATED_CANONICAL_MODELS.map(item=>[item.model_id,item]));

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

function mergeCuratedDefinition(existing:ModelRegistryItem,seed:ModelRegistryItem):ModelRegistryItem{
  const uniq=<T,>(values:T[])=>Array.from(new Set(values));
  return{
    ...existing,
    model_id:seed.model_id,slug:seed.model_id,
    supported_modes:uniq([...(existing.supported_modes||[]),...(seed.supported_modes||[])]),
    supported_resolutions:uniq([...(existing.supported_resolutions||[]),...(seed.supported_resolutions||[])]),
    supported_durations:uniq([...(existing.supported_durations||[]),...(seed.supported_durations||[])]).sort((a,b)=>Number(a)-Number(b)),
    supported_aspect_ratios:uniq([...(existing.supported_aspect_ratios||[]),...(seed.supported_aspect_ratios||[])]),
    supports_image_reference:Boolean(existing.supports_image_reference||seed.supports_image_reference),
    supports_multiple_images:Boolean(existing.supports_multiple_images||seed.supports_multiple_images),
    supports_video_reference:Boolean(existing.supports_video_reference||seed.supports_video_reference),
    supports_audio_reference:Boolean(existing.supports_audio_reference||seed.supports_audio_reference),
    supports_negative_prompt:Boolean(existing.supports_negative_prompt||seed.supports_negative_prompt),
    supports_seed:Boolean(existing.supports_seed||seed.supports_seed),
    supports_start_end_image:Boolean(existing.supports_start_end_image||seed.supports_start_end_image),
    max_reference_images:Math.max(existing.max_reference_images||0,seed.max_reference_images||0),
    max_reference_videos:Math.max(existing.max_reference_videos||0,seed.max_reference_videos||0),
    max_reference_audio:Math.max(existing.max_reference_audio||0,seed.max_reference_audio||0),
    max_prompt_length:Math.max(existing.max_prompt_length||0,seed.max_prompt_length||0),
    beta_capability_ids:uniq([...(existing.beta_capability_ids||[]),...(seed.beta_capability_ids||[])]),
  };
}

async function ensureCuratedModel(modelId:string):Promise<ModelRegistryItem|null>{
  const id=canonicalModelId(modelId);
  const [existing,seed]=await Promise.all([catalogRepository.getModel(id),Promise.resolve(modelSeedById.get(id)||null)]);
  if(existing&&seed)return catalogRepository.saveModel({...mergeCuratedDefinition(existing,seed),updated_at:now()});
  if(existing)return existing;
  if(!seed)return null;
  return catalogRepository.saveModel({...seed,created_at:seed.created_at||now(),updated_at:now()});
}

async function ensureCuratedModels(modelIds:string[]){
  const ids=Array.from(new Set(modelIds.map(String).map(value=>canonicalModelId(value.trim())).filter(Boolean))).slice(0,50);
  const existing=await catalogRepository.listModels();
  const existingById=new Map(existing.map(model=>[model.model_id,model]));
  const added:ModelRegistryItem[]=[];
  const alreadyPresent:ModelRegistryItem[]=[];
  const rejected:string[]=[];
  for(const modelId of ids){
    const current=existingById.get(modelId);
    if(current){alreadyPresent.push(current);continue;}
    const seed=modelSeedById.get(modelId);
    if(!seed){rejected.push(modelId);continue;}
    added.push({...seed,created_at:seed.created_at||now(),updated_at:now()});
  }
  if(added.length)await catalogRepository.saveModelsBulk(added);
  return{added,alreadyPresent,rejected};
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
  ensureCuratedModels,
  ensureSeeded,
};