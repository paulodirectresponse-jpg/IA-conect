import { ProviderRegistryItem } from '../../src/types/index.js';
import { catalogRepository } from '../repositories/catalogRepository.js';

const now=()=>new Date().toISOString();

/**
 * Canonical provider control-plane catalog. Existing Firestore rows win so Admin
 * status/priority changes remain authoritative. Missing rows are seeded lazily.
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
    const existing=await catalogRepository.listProviders();
    const ids=new Set(existing.map(item=>String(item.provider_id)));
    for(const item of PROVIDER_DEFINITIONS){
      if(ids.has(item.provider_id))continue;
      await catalogRepository.saveProvider(item);
      ids.add(item.provider_id);
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
