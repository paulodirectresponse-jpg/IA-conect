import { ProviderRegistryItem } from '../../src/types/index.js';
import { CURATED_MODEL_SEEDS } from '../../src/config/curatedModelInventory.js';
import { catalogRepository } from '../repositories/catalogRepository.js';

const now=()=>new Date().toISOString();

/**
 * Canonical provider control-plane catalog. Existing Firestore rows win so Admin
 * status/priority changes remain authoritative. Missing rows are seeded lazily.
 * Curated model positions are also seeded here as EXPERIMENTAL/Beta-only until
 * a provider mapping + capability + verified pricing rule are approved.
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

let seeding:Promise<void>|null=null;
async function ensureSeeded(){
  if(seeding)return seeding;
  seeding=(async()=>{
    const existingProviders=await catalogRepository.listProviders();
    const providerIds=new Set(existingProviders.map(item=>String(item.provider_id)));
    for(const item of PROVIDER_DEFINITIONS){
      if(providerIds.has(item.provider_id))continue;
      await catalogRepository.saveProvider(item);
      providerIds.add(item.provider_id);
    }

    const existingModels=await catalogRepository.listModels();
    const modelIds=new Set(existingModels.map(item=>String(item.model_id)));
    for(const model of CURATED_MODEL_SEEDS){
      if(modelIds.has(model.model_id))continue;
      await catalogRepository.saveModel(model);
      modelIds.add(model.model_id);
    }
  })().finally(()=>{seeding=null;});
  return seeding;
}

export const providerCatalogService={
  async listProviders(){
    await ensureSeeded();
    return catalogRepository.listProviders();
  },
  async getProvider(providerId:string){
    await ensureSeeded();
    return catalogRepository.getProvider(providerId);
  },
  ensureSeeded,
};
