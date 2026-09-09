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

const now = () => new Date().toISOString();
const durations = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const imageRatios = ['1:1','3:2','2:3','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
const videoRatios = ['16:9','9:16','1:1','4:3','3:4','21:9'];

/**
 * Production catalog is code-backed on purpose. Firebase Admin is not a hard
 * dependency for reads, so Cloudflare Workers can always render the studio and
 * route jobs even when Admin SDK is unavailable in the runtime.
 */
export const MODEL_CATALOG: ModelRegistryItem[] = [
  {
    model_id:'wan-3-0-prime', name:'WAN 3.0 Prime', slug:'wan-3-0-prime', category:'VIDEO',
    description:'Modelo premium de vídeo para texto, frames e referências multimodais, com até 30 segundos.',
    status:'ACTIVE', best_for:'Qualidade premium, produto e cinematografia', recommended_aspect_ratio:'16:9',
    supported_modes:['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
    supported_resolutions:['480p','720p','1080p'], supported_durations:durations(2,30), supported_aspect_ratios:videoRatios,
    supports_image_reference:true, supports_multiple_images:true, supports_video_reference:true, supports_audio_reference:true,
    supports_negative_prompt:false, supports_seed:true, supports_start_end_image:true,
    max_reference_images:10, max_reference_videos:5, max_reference_audio:5, max_prompt_length:20000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'seedance-2-5', name:'Seedance 2.5', slug:'seedance-2-5', category:'VIDEO',
    description:'Modelo cinematográfico multimodal com áudio nativo, referências e duração de até 30 segundos.',
    status:'ACTIVE', best_for:'Movimento, direção cinematográfica e consistência multimodal', recommended_aspect_ratio:'16:9',
    supported_modes:['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
    supported_resolutions:['480p','720p','1080p'], supported_durations:durations(4,30), supported_aspect_ratios:videoRatios,
    supports_image_reference:true, supports_multiple_images:true, supports_video_reference:true, supports_audio_reference:true,
    supports_negative_prompt:false, supports_seed:true, supports_start_end_image:true,
    max_reference_images:30, max_reference_videos:10, max_reference_audio:10, max_prompt_length:20000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'wan-3-0', name:'WAN 3.0', slug:'wan-3-0', category:'VIDEO',
    description:'Modelo forte e versátil para produção de vídeo com referências e duração de até 30 segundos.',
    status:'ACTIVE', best_for:'Custo-benefício sem abrir mão de qualidade', recommended_aspect_ratio:'16:9',
    supported_modes:['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
    supported_resolutions:['480p','720p','1080p'], supported_durations:durations(2,30), supported_aspect_ratios:videoRatios,
    supports_image_reference:true, supports_multiple_images:true, supports_video_reference:true, supports_audio_reference:true,
    supports_negative_prompt:false, supports_seed:true, supports_start_end_image:true,
    max_reference_images:10, max_reference_videos:5, max_reference_audio:5, max_prompt_length:20000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'minimax-h3', name:'MiniMax H3', slug:'minimax-h3', category:'VIDEO',
    description:'Modelo multimodal de alto nível para clipes curtos com imagem, vídeo e áudio de referência.',
    status:'ACTIVE', best_for:'Referências multimodais e clipes de até 15 segundos', recommended_aspect_ratio:'16:9',
    supported_modes:['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
    supported_resolutions:['768p'], supported_durations:durations(4,15), supported_aspect_ratios:videoRatios,
    supports_image_reference:true, supports_multiple_images:true, supports_video_reference:true, supports_audio_reference:true,
    supports_negative_prompt:false, supports_seed:true, supports_start_end_image:true,
    max_reference_images:9, max_reference_videos:3, max_reference_audio:3, max_prompt_length:10000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'seedance-2-0', name:'Seedance 2.0', slug:'seedance-2-0', category:'VIDEO',
    description:'Seedance multimodal para produção de clipes de até 15 segundos com áudio e referências.',
    status:'ACTIVE', best_for:'Clipes de 15s, movimento e referências', recommended_aspect_ratio:'16:9',
    supported_modes:['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO'],
    supported_resolutions:['480p','720p','1080p'], supported_durations:durations(4,15), supported_aspect_ratios:videoRatios,
    supports_image_reference:true, supports_multiple_images:true, supports_video_reference:true, supports_audio_reference:true,
    supports_negative_prompt:false, supports_seed:true, supports_start_end_image:true,
    max_reference_images:9, max_reference_videos:3, max_reference_audio:3, max_prompt_length:20000,
    created_at:now(), updated_at:now(),
  },

  {
    model_id:'nano-banana-pro-image', name:'Google Nano Banana Pro', slug:'nano-banana-pro-image', category:'IMAGE',
    description:'Google Gemini 3 Pro Image para geração e edição premium, alta fidelidade e saída até 4K.',
    status:'ACTIVE', best_for:'Fotorealismo, produto, composição e edição premium', recommended_aspect_ratio:'1:1',
    supported_modes:['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'], supported_resolutions:['1K','2K','4K'], supported_durations:[1],
    supported_aspect_ratios:imageRatios, supports_image_reference:true, supports_multiple_images:true,
    supports_video_reference:false, supports_audio_reference:false, supports_negative_prompt:false, supports_seed:false,
    max_reference_images:10, max_reference_videos:0, max_reference_audio:0, max_prompt_length:10000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'nano-banana-2-image', name:'Google Nano Banana 2', slug:'nano-banana-2-image', category:'IMAGE',
    description:'Google Gemini 3.1 Flash Image com qualidade Pro, alta velocidade, edição e saída até 4K.',
    status:'ACTIVE', best_for:'Produção rápida premium e consistência de referências', recommended_aspect_ratio:'1:1',
    supported_modes:['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'], supported_resolutions:['1K','2K','4K'], supported_durations:[1],
    supported_aspect_ratios:imageRatios, supports_image_reference:true, supports_multiple_images:true,
    supports_video_reference:false, supports_audio_reference:false, supports_negative_prompt:false, supports_seed:true,
    max_reference_images:14, max_reference_videos:0, max_reference_audio:0, max_prompt_length:10000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'seedream-5-pro-image', name:'Seedream 5.0 Pro', slug:'seedream-5-pro-image', category:'IMAGE',
    description:'ByteDance flagship para imagem profissional, tipografia, fotorealismo e edição multi-referência.',
    status:'ACTIVE', best_for:'Campanhas, produto, tipografia e composição profissional', recommended_aspect_ratio:'1:1',
    supported_modes:['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'], supported_resolutions:['1K','1.5K','2K'], supported_durations:[1],
    supported_aspect_ratios:imageRatios, supports_image_reference:true, supports_multiple_images:true,
    supports_video_reference:false, supports_audio_reference:false, supports_negative_prompt:false, supports_seed:false,
    max_reference_images:10, max_reference_videos:0, max_reference_audio:0, max_prompt_length:12000,
    created_at:now(), updated_at:now(),
  },
  {
    model_id:'gpt-image-2', name:'GPT Image 2', slug:'gpt-image-2', category:'IMAGE',
    description:'OpenAI GPT Image 2 para geração e edição premium com excelente aderência ao prompt e texto.',
    status:'ACTIVE', best_for:'Marketing, produto, texto e edição de alta qualidade', recommended_aspect_ratio:'1:1',
    supported_modes:['TEXT_TO_IMAGE','IMAGE_TO_IMAGE'], supported_resolutions:['1K','2K','4K'], supported_durations:[1],
    supported_aspect_ratios:imageRatios, supports_image_reference:true, supports_multiple_images:true,
    supports_video_reference:false, supports_audio_reference:false, supports_negative_prompt:false, supports_seed:false,
    max_reference_images:16, max_reference_videos:0, max_reference_audio:0, max_prompt_length:12000,
    created_at:now(), updated_at:now(),
  },
];

export const PROVIDER_CATALOG: ProviderRegistryItem[] = [
  {provider_id:'provider-wavespeed',name:'WaveSpeed AI',slug:'wavespeed',status:'ACTIVE',priority:110,is_configured:false,created_at:now(),updated_at:now()},
  {provider_id:'provider-atlas',name:'Atlas Cloud',slug:'atlas',status:'ACTIVE',priority:100,is_configured:false,created_at:now(),updated_at:now()},
];

const mapping = (id:string, model_id:string, provider_id:string, provider_model_identifier:string):ProviderModelMapping => ({
  mapping_id:id, model_id, provider_id, provider_model_identifier, status:'ACTIVE', updated_at:now(),
});

export const MODEL_MAPPINGS: ProviderModelMapping[] = [
  mapping('map-wan3p-atlas','wan-3-0-prime','provider-atlas','alibaba/wan-3.0-prime'),
  mapping('map-wan3p-wave','wan-3-0-prime','provider-wavespeed','alibaba/wan-3.0-prime'),
  mapping('map-seed25-atlas','seedance-2-5','provider-atlas','bytedance/seedance-2.5'),
  mapping('map-seed25-wave','seedance-2-5','provider-wavespeed','bytedance/seedance-2.5'),
  mapping('map-wan3-atlas','wan-3-0','provider-atlas','alibaba/wan-3.0'),
  mapping('map-wan3-wave','wan-3-0','provider-wavespeed','alibaba/wan-3.0'),
  mapping('map-h3-atlas','minimax-h3','provider-atlas','minimax/h3'),
  mapping('map-h3-wave','minimax-h3','provider-wavespeed','wavespeed-ai/minimax-h3'),
  mapping('map-seed20-atlas','seedance-2-0','provider-atlas','bytedance/seedance-2.0'),

  mapping('map-banana-pro-wave','nano-banana-pro-image','provider-wavespeed','google/nano-banana-pro'),
  mapping('map-banana2-wave','nano-banana-2-image','provider-wavespeed','google/nano-banana-2'),
  mapping('map-seed5-wave','seedream-5-pro-image','provider-wavespeed','bytedance/seedream-v5.0-pro'),
  mapping('map-gptimg2-wave','gpt-image-2','provider-wavespeed','openai/gpt-image-2'),
  mapping('map-banana-pro-atlas','nano-banana-pro-image','provider-atlas','google/nano-banana-pro'),
  mapping('map-banana2-atlas','nano-banana-2-image','provider-atlas','google/nano-banana-2'),
  mapping('map-seed5-atlas','seedream-5-pro-image','provider-atlas','bytedance/seedream-v5.0-pro'),
  mapping('map-gptimg2-atlas','gpt-image-2','provider-atlas','openai/gpt-image-2'),
];

const videoCostRows:Array<[string,string,string,number]> = [
  ['wan-3-0','provider-atlas','480p',20],['wan-3-0','provider-atlas','720p',41],['wan-3-0','provider-atlas','1080p',82],
  ['wan-3-0','provider-wavespeed','480p',24],['wan-3-0','provider-wavespeed','720p',48],['wan-3-0','provider-wavespeed','1080p',97],
  ['wan-3-0-prime','provider-atlas','480p',31],['wan-3-0-prime','provider-atlas','720p',64],['wan-3-0-prime','provider-atlas','1080p',129],
  ['wan-3-0-prime','provider-wavespeed','480p',36],['wan-3-0-prime','provider-wavespeed','720p',73],['wan-3-0-prime','provider-wavespeed','1080p',145],
  ['seedance-2-5','provider-atlas','480p',71],['seedance-2-5','provider-atlas','720p',153],['seedance-2-5','provider-atlas','1080p',302],
  ['seedance-2-5','provider-wavespeed','480p',75],['seedance-2-5','provider-wavespeed','720p',160],['seedance-2-5','provider-wavespeed','1080p',315],
  ['minimax-h3','provider-atlas','768p',41],['minimax-h3','provider-wavespeed','768p',51],
  ['seedance-2-0','provider-atlas','480p',57],['seedance-2-0','provider-atlas','720p',57],['seedance-2-0','provider-atlas','1080p',57],
];

const videoPricing: PricingEntry[] = videoCostRows.map(([model,provider,res,cost],i) => ({
  pricing_id:`premium-video-${i+1}`, provider_id:provider, model_id:model, resolution:res, duration_seconds:1,
  unit:'PER_SECOND', provider_cost_cents:cost, customer_price_cents:Math.ceil(cost*1.12), currency:'BRL',
  effective_from:'2026-09-09T00:00:00.000Z', active:true, updated_at:now(),
}));

const imagePrice = (id:string,provider:string,model:string,res:string,cost:number):PricingEntry => ({
  pricing_id:id, provider_id:provider, model_id:model, resolution:res, duration_seconds:1, unit:'PER_IMAGE',
  provider_cost_cents:cost, customer_price_cents:Math.ceil(cost*1.12), currency:'BRL',
  effective_from:'2026-09-09T00:00:00.000Z', active:true, updated_at:now(),
});

// Conservative 1K base prices (BRL cents). Higher tiers reserve more before dispatch.
const imagePricing: PricingEntry[] = [
  imagePrice('img-nbp-wave-1k','provider-wavespeed','nano-banana-pro-image','1K',72),
  imagePrice('img-nbp-wave-2k','provider-wavespeed','nano-banana-pro-image','2K',108),
  imagePrice('img-nbp-wave-4k','provider-wavespeed','nano-banana-pro-image','4K',144),
  imagePrice('img-nb2-wave-1k','provider-wavespeed','nano-banana-2-image','1K',36),
  imagePrice('img-nb2-wave-2k','provider-wavespeed','nano-banana-2-image','2K',54),
  imagePrice('img-nb2-wave-4k','provider-wavespeed','nano-banana-2-image','4K',72),
  imagePrice('img-seed5-wave-1k','provider-wavespeed','seedream-5-pro-image','1K',25),
  imagePrice('img-seed5-wave-15k','provider-wavespeed','seedream-5-pro-image','1.5K',25),
  imagePrice('img-seed5-wave-2k','provider-wavespeed','seedream-5-pro-image','2K',25),
  imagePrice('img-gpt2-wave-1k','provider-wavespeed','gpt-image-2','1K',36),
  imagePrice('img-gpt2-wave-2k','provider-wavespeed','gpt-image-2','2K',56),
  imagePrice('img-gpt2-wave-4k','provider-wavespeed','gpt-image-2','4K',97),

  imagePrice('img-nbp-atlas-1k','provider-atlas','nano-banana-pro-image','1K',72),
  imagePrice('img-nb2-atlas-1k','provider-atlas','nano-banana-2-image','1K',41),
  imagePrice('img-seed5-atlas-1k','provider-atlas','seedream-5-pro-image','1K',23),
  imagePrice('img-gpt2-atlas-1k','provider-atlas','gpt-image-2','1K',6),
];

export const PRICING_CATALOG: PricingEntry[] = [...videoPricing, ...imagePricing];

const promotions: PromotionEntry[] = [];
const flags: FeatureFlag[] = INITIAL_FEATURE_FLAGS.map((f) => ({ ...f, updated_at:now() }));

async function bestEffortWrite(collection:string, id:string, value:any) {
  const db = getAdminDb();
  if (!db) throw new Error('Firestore Admin indisponível para alteração administrativa.');
  await db.collection(collection).doc(id).set(value, { merge:true });
  return value;
}

export const catalogRepository = {
  async listModels() { return MODEL_CATALOG.filter((x) => x.status !== 'INACTIVE'); },
  async getModel(id:string) { return MODEL_CATALOG.find((x) => x.model_id === id && x.status !== 'INACTIVE') || null; },
  async saveModel(x:ModelRegistryItem) { x.updated_at=now(); return bestEffortWrite('models',x.model_id,x); },

  async listProviders() { return [...PROVIDER_CATALOG].sort((a,b) => b.priority-a.priority); },
  async getProvider(id:string) { return PROVIDER_CATALOG.find((x) => x.provider_id === id) || null; },
  async saveProvider(x:ProviderRegistryItem) { x.updated_at=now(); return bestEffortWrite('providers',x.provider_id,x); },

  async listMappings() { return MODEL_MAPPINGS; },
  async saveMapping(x:ProviderModelMapping) { x.updated_at=now(); return bestEffortWrite('provider_models',x.mapping_id,x); },

  async listPricing() { return PRICING_CATALOG; },
  async getPricing(id:string) { return PRICING_CATALOG.find((x) => x.pricing_id === id) || null; },
  async savePricing(x:PricingEntry) { x.updated_at=now(); return bestEffortWrite('pricing',x.pricing_id,x); },

  async listPromotions() { return promotions; },
  async getPromotion(id:string) { return promotions.find((x) => x.promotion_id === id) || null; },
  async savePromotion(x:PromotionEntry) { return bestEffortWrite('promotions',x.promotion_id,x); },

  async listFeatureFlags() { return flags; },
  async getFeatureFlag(id:string) { return flags.find((x) => x.flag_key === id) || null; },
  async saveFeatureFlag(x:FeatureFlag) { x.updated_at=now(); return bestEffortWrite('feature_flags',x.flag_key,x); },
  clearForTesting() {},
};
