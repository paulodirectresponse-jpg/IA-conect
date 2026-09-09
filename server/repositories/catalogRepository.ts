import {
  ModelRegistryItem,
  ProviderRegistryItem,
  ProviderModelMapping,
  PricingEntry,
  PromotionEntry,
  FeatureFlag,
} from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';
import { INITIAL_FEATURE_FLAGS } from '../../src/config/constants.js';
import { STUDIO_FALLBACK_MODELS, STUDIO_FALLBACK_PRICING } from '../../src/config/studioCatalog.js';

const now=()=>new Date().toISOString();

/** One code-backed catalog keeps UI, validation, routing and pricing health in sync. */
export const MODEL_CATALOG:ModelRegistryItem[]=STUDIO_FALLBACK_MODELS;

export const PROVIDER_CATALOG:ProviderRegistryItem[]=[
  {provider_id:'provider-wavespeed',name:'WaveSpeed AI',slug:'wavespeed',status:'ACTIVE',priority:110,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',status:'ACTIVE',priority:100,is_configured:false,created_at:now(),updated_at:now()},
];

const mapping=(id:string,model_id:string,provider_id:string,provider_model_identifier:string):ProviderModelMapping=>({mapping_id:id,model_id,provider_id,provider_model_identifier,status:'ACTIVE',updated_at:now()});

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

export const PRICING_CATALOG:PricingEntry[]=STUDIO_FALLBACK_PRICING;
const promotions:PromotionEntry[]=[];
const flags:FeatureFlag[]=INITIAL_FEATURE_FLAGS.map(f=>({...f,updated_at:now()}));

async function bestEffortWrite(collection:string,id:string,value:any){const db=getAdminDb();if(!db)throw new Error('Firestore Admin indisponível para alteração administrativa.');await db.collection(collection).doc(id).set(value,{merge:true});return value;}

export const catalogRepository={
  async listModels(){return MODEL_CATALOG.filter(x=>x.status!=='INACTIVE');},
  async getModel(id:string){return MODEL_CATALOG.find(x=>x.model_id===id&&x.status!=='INACTIVE')||null;},
  async saveModel(x:ModelRegistryItem){x.updated_at=now();return bestEffortWrite('models',x.model_id,x);},
  async listProviders(){return[...PROVIDER_CATALOG].sort((a,b)=>b.priority-a.priority);},
  async getProvider(id:string){return PROVIDER_CATALOG.find(x=>x.provider_id===id)||null;},
  async saveProvider(x:ProviderRegistryItem){x.updated_at=now();return bestEffortWrite('providers',x.provider_id,x);},
  async listMappings(){return MODEL_MAPPINGS;},
  async saveMapping(x:ProviderModelMapping){x.updated_at=now();return bestEffortWrite('provider_models',x.mapping_id,x);},
  async listPricing(){return PRICING_CATALOG;},
  async getPricing(id:string){return PRICING_CATALOG.find(x=>x.pricing_id===id)||null;},
  async savePricing(x:PricingEntry){x.updated_at=now();return bestEffortWrite('pricing',x.pricing_id,x);},
  async listPromotions(){return promotions;},
  async getPromotion(id:string){return promotions.find(x=>x.promotion_id===id)||null;},
  async savePromotion(x:PromotionEntry){return bestEffortWrite('promotions',x.promotion_id,x);},
  async listFeatureFlags(){return flags;},
  async getFeatureFlag(id:string){return flags.find(x=>x.flag_key===id)||null;},
  async saveFeatureFlag(x:FeatureFlag){x.updated_at=now();return bestEffortWrite('feature_flags',x.flag_key,x);},
  clearForTesting(){},
};