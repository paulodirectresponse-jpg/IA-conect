import { GenerationMode, ModelRegistryItem } from '../types/index.js';

export type CuratedModelFunction=
  |'IMAGE_GENERATION'|'IMAGE_EDIT'|'VIDEO_GENERATION'|'VIDEO_EDIT'|'VIDEO_EXTEND'
  |'VOICE'|'MUSIC'|'SFX'|'THREE_D';

export interface CuratedModelBlueprint{
  function_id:CuratedModelFunction;
  model_id:string;
  name:string;
  aliases:string[];
  existing:boolean;
}

const c=(function_id:CuratedModelFunction,model_id:string,name:string,existing=false,aliases:string[]=[]):CuratedModelBlueprint=>({
  function_id,model_id,name,existing,aliases:Array.from(new Set([name,model_id,...aliases])),
});

/**
 * Product-curated inventory. This is intentionally not a mirror of provider catalogs:
 * only models approved for IA Connect product quality belong here.
 *
 * Existing=true means the canonical model already exists in studioCatalog.ts.
 * New entries are seeded as EXPERIMENTAL + beta_only until a provider mapping,
 * schema/capability and pricing rule are explicitly verified.
 */
export const CURATED_MODEL_BLUEPRINTS:CuratedModelBlueprint[]=[
  // Image generation — 12
  c('IMAGE_GENERATION','nano-banana-2-image','Google Nano Banana 2',true,['google/nano-banana-2','google/nano-banana-2/text-to-image']),
  c('IMAGE_GENERATION','nano-banana-pro-image','Google Nano Banana Pro',true,['google/nano-banana-pro','google/nano-banana-pro/text-to-image']),
  c('IMAGE_GENERATION','gpt-image-2','GPT Image 2',true,['openai/gpt-image-2','openai/gpt-image-2/text-to-image']),
  c('IMAGE_GENERATION','seedream-5-pro-image','Seedream 5.0 Pro',true,['bytedance/seedream-v5.0-pro','seedream 5 pro']),
  c('IMAGE_GENERATION','nano-banana-2-lite-image','Google Nano Banana 2 Lite',true,['google/nano-banana-2-lite','google/nano-banana-2-lite/text-to-image']),
  c('IMAGE_GENERATION','flux-2-max-image','FLUX.2 Max',false,['black-forest-labs/flux-2-max','flux 2 max']),
  c('IMAGE_GENERATION','flux-2-pro-image','FLUX.2 Pro',false,['black-forest-labs/flux-2-pro','flux 2 pro']),
  c('IMAGE_GENERATION','flux-2-flex-image','FLUX.2 Flex',false,['black-forest-labs/flux-2-flex','flux 2 flex']),
  c('IMAGE_GENERATION','imagen-4-ultra-image','Imagen 4 Ultra',false,['google/imagen-4-ultra','imagen 4 ultra']),
  c('IMAGE_GENERATION','recraft-v4-pro-image','Recraft V4 Pro',false,['recraft-ai/recraft-v4-pro','recraft v4 pro']),
  c('IMAGE_GENERATION','grok-imagine-image','Grok Imagine Image',false,['xai/grok-imagine-image','x-ai/grok-imagine-image']),
  c('IMAGE_GENERATION','qwen-image-3-pro','Qwen Image 3 Pro',false,['qwen image 3','qwen-image-3','alibaba/qwen-image-3']),

  // Image editor — 10
  c('IMAGE_EDIT','gpt-image-2','GPT Image 2',true,['openai/gpt-image-2/edit','gpt image 2 edit']),
  c('IMAGE_EDIT','nano-banana-2-image','Google Nano Banana 2',true,['google/nano-banana-2/edit','nano banana 2 edit']),
  c('IMAGE_EDIT','nano-banana-pro-image','Google Nano Banana Pro',true,['google/nano-banana-pro/edit','nano banana pro edit']),
  c('IMAGE_EDIT','seedream-5-pro-image','Seedream 5.0 Pro',true,['bytedance/seedream-v5.0-pro/edit','seedream 5 pro edit']),
  c('IMAGE_EDIT','seedream-4-5-image','Seedream 4.5',false,['seedream 4.5 edit','bytedance/seedream-4.5/edit']),
  c('IMAGE_EDIT','flux-2-max-image','FLUX.2 Max',false,['flux 2 max edit','black-forest-labs/flux-2-max']),
  c('IMAGE_EDIT','flux-2-pro-image','FLUX.2 Pro',false,['flux 2 pro edit','black-forest-labs/flux-2-pro']),
  c('IMAGE_EDIT','qwen-image-3-pro','Qwen Image 3 Pro',false,['qwen image 3 edit','qwen-image-3/edit']),
  c('IMAGE_EDIT','wan-2-7-image','Wan 2.7 Image',false,['wan 2.7 image edit','alibaba/wan-2.7/image-edit']),
  c('IMAGE_EDIT','flux-fill-pro-image','FLUX Fill Pro',false,['black-forest-labs/flux-fill-pro','flux fill pro']),

  // Video generation — 12
  c('VIDEO_GENERATION','wan-3-0-prime','WAN 3.0 Prime',true,['alibaba/wan-3.0-prime']),
  c('VIDEO_GENERATION','seedance-2-5','Seedance 2.5',true,['bytedance/seedance-2.5']),
  c('VIDEO_GENERATION','wan-3-0','WAN 3.0',true,['alibaba/wan-3.0']),
  c('VIDEO_GENERATION','kling-3-0','Kling 3.0',true,['kwaivgi/kling-v3.0','kling v3.0']),
  c('VIDEO_GENERATION','google-omni-flash','Google Omni Flash',true,['google/gemini-omni-1.1-flash','gemini omni 1.1 flash']),
  c('VIDEO_GENERATION','minimax-h3','MiniMax H3',true,['wavespeed-ai/minimax-h3','minimax/h3']),
  c('VIDEO_GENERATION','seedance-2-0','Seedance 2.0',true,['bytedance/seedance-2.0']),
  c('VIDEO_GENERATION','veo-3-1','Veo 3.1',false,['google/veo3.1','google/veo-3.1','veo 3.1']),
  c('VIDEO_GENERATION','veo-3-1-fast','Veo 3.1 Fast',false,['google/veo3.1-fast','google/veo-3.1-fast','veo 3.1 fast']),
  c('VIDEO_GENERATION','runway-gen-4-5','Runway Gen-4.5',false,['runway gen 4.5','runwayml/gen-4.5']),
  c('VIDEO_GENERATION','luma-ray-3-2','Luma Ray 3.2',false,['luma/ray-3.2','luma ray 3.2']),
  c('VIDEO_GENERATION','grok-imagine-video','Grok Imagine Video',false,['x-ai/grok-imagine-video','xai/grok-imagine-video']),

  // Video editor — 10
  c('VIDEO_EDIT','seedance-2-5','Seedance 2.5',true,['bytedance/seedance-2.5/video-edit']),
  c('VIDEO_EDIT','seedance-2-5','Seedance 2.5',true,['bytedance/seedance-2.5/video-edit-turbo']),
  c('VIDEO_EDIT','wan-3-0-prime','WAN 3.0 Prime',true,['alibaba/wan-3.0-prime/video-edit']),
  c('VIDEO_EDIT','wan-3-0','WAN 3.0',true,['alibaba/wan-3.0/video-edit']),
  c('VIDEO_EDIT','minimax-h3','MiniMax H3',true,['wavespeed-ai/minimax-h3/video-edit']),
  c('VIDEO_EDIT','kling-o3-pro','Kling O3 Pro',false,['kwaivgi/kling-video-o3-pro/video-edit','kling o3 pro video edit']),
  c('VIDEO_EDIT','luma-ray-3-2','Luma Ray 3.2',false,['luma/ray-3.2/video-edit']),
  c('VIDEO_EDIT','google-omni-flash','Google Omni Flash',true,['google/gemini-omni-1.1-flash/video-edit']),
  c('VIDEO_EDIT','kling-o3-4k','Kling O3 4K',false,['kwaivgi/kling-video-o3-4k/video-edit']),
  c('VIDEO_EDIT','kling-o1','Kling O1',false,['kwaivgi/kling-video-o1/video-edit','kling omni o1 video edit']),

  // Video extend — 10
  c('VIDEO_EXTEND','seedance-2-5','Seedance 2.5',true,['bytedance/seedance-2.5/video-extend']),
  c('VIDEO_EXTEND','wan-3-0-prime','WAN 3.0 Prime',true,['alibaba/wan-3.0-prime/video-extend']),
  c('VIDEO_EXTEND','wan-3-0','WAN 3.0',true,['alibaba/wan-3.0/video-extend']),
  c('VIDEO_EXTEND','minimax-h3','MiniMax H3',true,['wavespeed-ai/minimax-h3/video-extend']),
  c('VIDEO_EXTEND','veo-3-1','Veo 3.1',false,['google/veo3.1/video-extend']),
  c('VIDEO_EXTEND','veo-3-1-fast','Veo 3.1 Fast',false,['google/veo3.1-fast/video-extend']),
  c('VIDEO_EXTEND','ltx-2-3','LTX 2.3',false,['wavespeed-ai/ltx-2.3/video-extend']),
  c('VIDEO_EXTEND','wan-2-7-video','WAN 2.7 Video',false,['alibaba/wan-2.7/video-extend']),
  c('VIDEO_EXTEND','pixverse-v6','PixVerse V6',false,['pixverse/pixverse-v6/extend']),
  c('VIDEO_EXTEND','grok-imagine-video','Grok Imagine Video',false,['x-ai/grok-imagine-video/video-extend']),

  // Voice — 10
  c('VOICE','minimax-speech-2-6-turbo','MiniMax Speech 2.6 Turbo',false,['minimax/speech-2.6-turbo']),
  c('VOICE','minimax-speech-2-8-hd','MiniMax Speech 2.8 HD',false,['minimax/speech-2.8-hd']),
  c('VOICE','minimax-speech-2-8-turbo','MiniMax Speech 2.8 Turbo',false,['minimax/speech-2.8-turbo']),
  c('VOICE','inworld-realtime-tts-2','Inworld Realtime TTS 2.0',false,['inworld/realtime-tts-2']),
  c('VOICE','gemini-3-1-flash-tts','Gemini 3.1 Flash TTS',false,['google/gemini-3.1-flash-tts']),
  c('VOICE','elevenlabs-v3-tts','ElevenLabs v3',false,['elevenlabs/v3']),
  c('VOICE','elevenlabs-multilingual-v2-tts','ElevenLabs Multilingual v2',false,['elevenlabs/v2-multilingual']),
  c('VOICE','elevenlabs-turbo-v2-5-tts','ElevenLabs Turbo v2.5',false,['elevenlabs/turbo-v2.5']),
  c('VOICE','qwen3-tts','Qwen3 TTS',false,['qwen/qwen3-tts','qwen3 tts']),
  c('VOICE','chatterbox-turbo-tts','Chatterbox Turbo',false,['resemble-ai/chatterbox-turbo']),

  // Music — 8. Suno is intentionally excluded because the PiAPI integration is no longer available.
  c('MUSIC','ace-step-music','ACE-Step',false,['Qubico/ace-step','ace-step','ace step']),
  c('MUSIC','udio-music','Udio',false,['udio']),
  c('MUSIC','elevenlabs-music-v2-5','ElevenLabs Music 2.5',false,['elevenlabs/music-v2.5']),
  c('MUSIC','minimax-music-2-6','MiniMax Music 2.6',false,['minimax/music-2.6']),
  c('MUSIC','minimax-music-2-5','MiniMax Music 2.5',false,['minimax/music-2.5']),
  c('MUSIC','minimax-music-02','MiniMax Music 02',false,['minimax/music-02']),
  c('MUSIC','stable-audio-2-5','Stable Audio 2.5',false,['stable audio 2.5','stability-ai/stable-audio-2.5']),
  c('MUSIC','yue2-3b-music','YuE2 3B',false,['wavespeed-ai/yue2-3b/text-to-music','yue2 3b']),

  // Sound effects — 6
  c('SFX','sonilo-v1-sfx','Sonilo V1',false,['sonilo/v1/text-to-sfx','sonilo v1']),
  c('SFX','elevenlabs-sfx-v2','ElevenLabs Sound Effects V2',false,['elevenlabs/sound-effects/v2','elevenlabs sound effects v2']),
  c('SFX','stable-audio-2-5-sfx','Stable Audio 2.5 SFX',false,['stable audio 2.5']),
  c('SFX','mmaudio-v2','MMAudio V2',false,['mmaudio-v2','mmaudio v2']),
  c('SFX','thinksound-sfx','ThinkSound',false,['thinksound']),
  c('SFX','sonilo-video-to-sfx','Sonilo Video-to-SFX',false,['sonilo video to sfx','sonilo/video-to-sfx']),

  // 3D — 8
  c('THREE_D','hunyuan3d-v3','Hunyuan3D V3',false,['wavespeed-ai/hunyuan3d-v3','hunyuan3d v3']),
  c('THREE_D','hunyuan3d-3-1','Hunyuan3D 3.1',false,['tencent/hunyuan-3d-3.1','hunyuan 3d 3.1']),
  c('THREE_D','hunyuan3d-3-1-pro','Hunyuan3D 3.1 Pro',false,['hunyuan3d 3.1 pro','hunyuan 3d 3.1 pro']),
  c('THREE_D','trellis-2','Trellis 2',false,['wavespeed-ai/trellis-2/image-to-3d','fishwowater/trellis2','trellis 2']),
  c('THREE_D','rodin-gen-2','Rodin Gen-2',false,['hyper3d/rodin','rodin gen 2']),
  c('THREE_D','meshy-7','Meshy 7',false,['meshy 7','meshy-v7']),
  c('THREE_D','tripo-h3-1','Tripo H3.1',false,['tripo h3.1','tripo h3 1']),
  c('THREE_D','sam-3d-objects','SAM 3D Objects',false,['sam 3d objects','sam3d objects']),
];

const imageRatios=['1:1','3:2','2:3','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
const videoRatios=['16:9','9:16','1:1','4:3','3:4'];
const createdAt='2026-09-17T00:00:00.000Z';

function modes(...values:GenerationMode[]){return values;}
function seedFromBlueprint(row:CuratedModelBlueprint):ModelRegistryItem{
  const common={model_id:row.model_id,name:row.name,slug:row.model_id,status:'EXPERIMENTAL' as const,beta_only:true,created_at:createdAt,updated_at:createdAt};
  switch(row.function_id){
    case'IMAGE_GENERATION':return{...common,category:'IMAGE',description:'Modelo curado para geração de imagem no IA Conect.',best_for:'Geração de imagem premium',supported_modes:modes('TEXT_TO_IMAGE','IMAGE_TO_IMAGE'),supported_resolutions:['1K','2K','4K'],supported_durations:[1],supported_aspect_ratios:imageRatios,supports_image_reference:true,supports_multiple_images:true,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:10,max_reference_videos:0,max_reference_audio:0,max_prompt_length:12000,beta_capability_ids:['text-to-image','image-to-image']};
    case'IMAGE_EDIT':return{...common,category:'IMAGE',description:'Modelo curado para edição generativa de imagem.',best_for:'Edição por prompt e transformação de imagem',supported_modes:modes('IMAGE_TO_IMAGE'),supported_resolutions:['1K','2K','4K'],supported_durations:[1],supported_aspect_ratios:imageRatios,supports_image_reference:true,supports_multiple_images:true,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:10,max_reference_videos:0,max_reference_audio:0,max_prompt_length:12000,beta_capability_ids:row.model_id==='flux-fill-pro-edit'?['image-edit','inpaint-mask','outpaint']:['image-edit']};
    case'VIDEO_GENERATION':return{...common,category:'VIDEO',description:'Modelo curado para geração de vídeo.',best_for:'Vídeo generativo premium',recommended_aspect_ratio:'16:9',supported_modes:modes('TEXT_TO_VIDEO','IMAGE_TO_VIDEO'),supported_resolutions:['720p','1080p'],supported_durations:[5,8,10],supported_aspect_ratios:videoRatios,supports_image_reference:true,supports_multiple_images:false,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,supports_start_end_image:false,max_reference_images:1,max_reference_videos:0,max_reference_audio:0,max_prompt_length:12000,beta_capability_ids:['text-to-video','image-to-video']};
    case'VIDEO_EDIT':return{...common,category:'VIDEO',description:'Modelo curado para edição generativa de vídeo.',best_for:'Modificar vídeo preservando movimento e continuidade',recommended_aspect_ratio:'16:9',supported_modes:modes('VIDEO_TO_VIDEO'),supported_resolutions:['720p','1080p'],supported_durations:[5,10,15],supported_aspect_ratios:videoRatios,supports_image_reference:true,supports_multiple_images:true,supports_video_reference:true,supports_audio_reference:true,supports_negative_prompt:false,supports_seed:false,max_reference_images:4,max_reference_videos:1,max_reference_audio:1,max_prompt_length:12000,beta_capability_ids:['video-edit']};
    case'VIDEO_EXTEND':return{...common,category:'VIDEO',description:'Modelo curado para continuação e extensão de vídeo.',best_for:'Continuar vídeo com coerência temporal',recommended_aspect_ratio:'16:9',supported_modes:modes('VIDEO_TO_VIDEO'),supported_resolutions:['720p','1080p'],supported_durations:[5,7,10,15],supported_aspect_ratios:videoRatios,supports_image_reference:false,supports_multiple_images:false,supports_video_reference:true,supports_audio_reference:true,supports_negative_prompt:false,supports_seed:false,max_reference_images:0,max_reference_videos:1,max_reference_audio:1,max_prompt_length:12000,beta_capability_ids:['video-extend']};
    case'VOICE':return{...common,category:'AUDIO',description:'Modelo curado de síntese de voz.',best_for:'Locução e voz natural',supported_modes:modes('TEXT_TO_SPEECH'),supported_resolutions:['audio'],supported_durations:[1],supported_aspect_ratios:['audio'],supports_image_reference:false,supports_multiple_images:false,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:0,max_reference_videos:0,max_reference_audio:0,max_prompt_length:10000,beta_capability_ids:['text-to-speech']};
    case'MUSIC':return{...common,category:'AUDIO',description:'Modelo curado para geração de música.',best_for:'Música, trilhas e canções',supported_modes:modes('TEXT_TO_AUDIO'),supported_resolutions:['audio'],supported_durations:[15,30,60,120,180,240],supported_aspect_ratios:['audio'],supports_image_reference:false,supports_multiple_images:false,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:0,max_reference_videos:0,max_reference_audio:0,max_prompt_length:4100,beta_capability_ids:['music']};
    case'SFX':return{...common,category:'AUDIO',description:'Modelo curado para efeitos sonoros e áudio para vídeo.',best_for:'Foley, ambientes e efeitos',supported_modes:modes('TEXT_TO_AUDIO'),supported_resolutions:['audio'],supported_durations:[1,5,10,15,30],supported_aspect_ratios:['audio'],supports_image_reference:false,supports_multiple_images:false,supports_video_reference:row.model_id.includes('video-to-sfx')||row.model_id==='mmaudio-v2',supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:0,max_reference_videos:row.model_id.includes('video-to-sfx')||row.model_id==='mmaudio-v2'?1:0,max_reference_audio:0,max_prompt_length:4000,beta_capability_ids:['sound-effects']};
    case'THREE_D':return{...common,category:'MODEL_3D',description:'Modelo curado para geração de assets 3D.',best_for:'Produtos, props e protótipos 3D',supported_modes:modes('TEXT_TO_3D','IMAGE_TO_3D'),supported_resolutions:['3D'],supported_durations:[1],supported_aspect_ratios:['3D'],supports_image_reference:true,supports_multiple_images:false,supports_video_reference:false,supports_audio_reference:false,supports_negative_prompt:false,supports_seed:false,max_reference_images:1,max_reference_videos:0,max_reference_audio:0,max_prompt_length:4000,beta_capability_ids:['text-to-3d','image-to-3d']};
  }
}

function mergeSeedModels(base:ModelRegistryItem,next:ModelRegistryItem):ModelRegistryItem{
  const uniq=<T,>(values:T[])=>Array.from(new Set(values));
  return{
    ...base,
    name:base.name||next.name,
    category:base.category,
    description:base.description,
    best_for:base.best_for,
    supported_modes:uniq([...(base.supported_modes||[]),...(next.supported_modes||[])]),
    supported_resolutions:uniq([...(base.supported_resolutions||[]),...(next.supported_resolutions||[])]),
    supported_durations:uniq([...(base.supported_durations||[]),...(next.supported_durations||[])]).sort((a,b)=>Number(a)-Number(b)),
    supported_aspect_ratios:uniq([...(base.supported_aspect_ratios||[]),...(next.supported_aspect_ratios||[])]),
    supports_image_reference:Boolean(base.supports_image_reference||next.supports_image_reference),
    supports_multiple_images:Boolean(base.supports_multiple_images||next.supports_multiple_images),
    supports_video_reference:Boolean(base.supports_video_reference||next.supports_video_reference),
    supports_audio_reference:Boolean(base.supports_audio_reference||next.supports_audio_reference),
    supports_negative_prompt:Boolean(base.supports_negative_prompt||next.supports_negative_prompt),
    supports_seed:Boolean(base.supports_seed||next.supports_seed),
    supports_start_end_image:Boolean(base.supports_start_end_image||next.supports_start_end_image),
    max_reference_images:Math.max(base.max_reference_images||0,next.max_reference_images||0),
    max_reference_videos:Math.max(base.max_reference_videos||0,next.max_reference_videos||0),
    max_reference_audio:Math.max(base.max_reference_audio||0,next.max_reference_audio||0),
    max_prompt_length:Math.max(base.max_prompt_length||0,next.max_prompt_length||0),
    beta_capability_ids:uniq([...(base.beta_capability_ids||[]),...(next.beta_capability_ids||[])]),
  };
}

const canonicalSeedById=new Map<string,ModelRegistryItem>();
for(const row of CURATED_MODEL_BLUEPRINTS){
  const seed=seedFromBlueprint(row);
  const current=canonicalSeedById.get(row.model_id);
  canonicalSeedById.set(row.model_id,current?mergeSeedModels(current,seed):seed);
}
export const CURATED_CANONICAL_MODELS:ModelRegistryItem[]=Array.from(canonicalSeedById.values());
export const CURATED_MODEL_SEEDS:ModelRegistryItem[]=CURATED_CANONICAL_MODELS.filter(model=>!CURATED_MODEL_BLUEPRINTS.some(row=>row.model_id===model.model_id&&row.existing));

export const CURATED_MODEL_POSITION_COUNTS=CURATED_MODEL_BLUEPRINTS.reduce<Record<CuratedModelFunction,number>>((acc,row)=>{
  acc[row.function_id]=(acc[row.function_id]||0)+1;return acc;
},{IMAGE_GENERATION:0,IMAGE_EDIT:0,VIDEO_GENERATION:0,VIDEO_EDIT:0,VIDEO_EXTEND:0,VOICE:0,MUSIC:0,SFX:0,THREE_D:0});
