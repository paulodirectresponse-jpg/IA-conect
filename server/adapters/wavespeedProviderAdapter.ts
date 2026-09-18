import { GenerationMode } from '../../src/types/index.js';
import {
  VideoProviderAdapter,
  ProviderGenerationParams,
  ProviderJobResult,
  ProviderJobStatusResult,
  ProviderCostQuote,
} from './videoProviderAdapter.js';
import { compileProviderReferencePrompt } from './providerPromptReferences.js';

const VIDEO_FAMILIES: Record<string, string> = {
  'wan-3-0': 'alibaba/wan-3.0',
  'wan-3-0-prime': 'alibaba/wan-3.0-prime',
  'seedance-2-5': 'bytedance/seedance-2.5',
  'seedance-2-0': 'bytedance/seedance-2.0',
  'minimax-h3': 'wavespeed-ai/minimax-h3',
  'kling-3-0': 'kwaivgi/kling-v3.0-std',
  'google-omni-flash': 'google/gemini-omni-1.1-flash',
};

const IMAGE_ENDPOINTS: Record<string, Partial<Record<GenerationMode, string>>> = {
  'nano-banana-pro-image': { TEXT_TO_IMAGE:'google/nano-banana-pro/text-to-image', IMAGE_TO_IMAGE:'google/nano-banana-pro/edit' },
  'nano-banana-2-image': { TEXT_TO_IMAGE:'google/nano-banana-2/text-to-image', IMAGE_TO_IMAGE:'google/nano-banana-2/edit' },
  'nano-banana-2-lite-image': { TEXT_TO_IMAGE:'google/nano-banana-2-lite/text-to-image', IMAGE_TO_IMAGE:'google/nano-banana-2-lite/edit' },
  'seedream-5-pro-image': { TEXT_TO_IMAGE:'bytedance/seedream-v5.0-pro', IMAGE_TO_IMAGE:'bytedance/seedream-v5.0-pro/edit' },
  'gpt-image-2': { TEXT_TO_IMAGE:'openai/gpt-image-2/text-to-image', IMAGE_TO_IMAGE:'openai/gpt-image-2/edit' },
};

function videoSuffix(mode: GenerationMode) { if(mode==='TEXT_TO_VIDEO')return'text-to-video';if(mode==='IMAGE_TO_VIDEO')return'image-to-video';if(mode==='REFERENCE_TO_VIDEO')return'reference-to-video';return null; }
function base(value:string|undefined){return(value||'https://api.wavespeed.ai').replace(/\/+$/,'').replace(/\/api\/v3$/,'');}
function audioEnabled(params:ProviderGenerationParams){return params.audio_enabled!==false;}
const AUDIO_MODES=new Set<GenerationMode>(['TEXT_TO_SPEECH','TEXT_TO_AUDIO','AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING']);
const THREE_D_MODES=new Set<GenerationMode>(['TEXT_TO_3D','IMAGE_TO_3D','MULTI_IMAGE_TO_3D']);
const VOICES:Record<string,string>={
  'calm-female':'Calm_Woman','wise-female':'Wise_Woman','friendly':'Friendly_Person',
  'casual-male':'Casual_Guy','narrator-male':'Deep_Voice_Man','narrator-female':'Elegant_Man',
};
const LANGUAGE_BOOSTS:Record<string,string>={auto:'auto',pt:'Portuguese',en:'English',es:'Spanish',fr:'French',de:'German'};
function languageBoost(value:any){const key=String(value||'auto').trim();return LANGUAGE_BOOSTS[key]||key||'auto';}
function isAudioMode(mode:GenerationMode){return AUDIO_MODES.has(mode);}
function isThreeDMode(mode:GenerationMode){return THREE_D_MODES.has(mode);}
function option(params:ProviderGenerationParams,key:string,fallback?:any){const value=params.pricing_options?.[key];return value===undefined?fallback:value;}
function logicalVoice(value:any){const key=String(value||'calm-female');if(key.startsWith('voice_'))return VOICES['calm-female'];return VOICES[key]||VOICES['calm-female'];}
function firstRef(params:ProviderGenerationParams,type:'AUDIO'|'VIDEO'){return params.references.find(ref=>ref.type===type);}
function cloneVoiceId(params:ProviderGenerationParams){const explicit=String(params.provider_runtime_options?.provider_voice_id||'').trim();if(explicit)return explicit;return `ia_${String(params.generation_id).replace(/[^a-zA-Z0-9]/g,'').slice(-28)||'voiceclone'}`;}


export class WaveSpeedProviderAdapter implements VideoProviderAdapter {
  readonly providerId='provider-wavespeed';readonly name='WaveSpeed AI';
  private get apiKey(){return process.env.WAVESPEED_API_KEY?.trim();}private get baseUrl(){return base(process.env.WAVESPEED_BASE_URL);}
  isConfigured(){return Boolean(this.apiKey);}
  supports(modelId:string,mode:GenerationMode,providerModelIdentifier?:string){if(isAudioMode(mode)||isThreeDMode(mode))return Boolean(providerModelIdentifier);if(mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE')return Boolean(IMAGE_ENDPOINTS[modelId]?.[mode]||providerModelIdentifier);if((modelId==='seedance-2-5'||modelId==='seedance-2-0'||modelId==='kling-3-0')&&mode==='REFERENCE_TO_VIDEO')return false;return Boolean((providerModelIdentifier||VIDEO_FAMILIES[modelId])&&videoSuffix(mode));}
  private modelName(modelId:string,mode:GenerationMode,providerModelIdentifier?:string){
    if(isAudioMode(mode)){if(!providerModelIdentifier)throw Object.assign(new Error('Mapping de áudio indisponível na WaveSpeed.'),{code:'PROVIDER_INCOMPATIBLE'});return providerModelIdentifier;}
    if(isThreeDMode(mode)){if(!providerModelIdentifier)throw Object.assign(new Error('Mapping 3D indisponível na WaveSpeed.'),{code:'PROVIDER_INCOMPATIBLE'});const suffix=mode==='TEXT_TO_3D'?'text-to-3d':'image-to-3d';return providerModelIdentifier.endsWith('/'+suffix)?providerModelIdentifier:`${providerModelIdentifier}/${suffix}`;}
    if(mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE'){
      const endpoint=IMAGE_ENDPOINTS[modelId]?.[mode]||providerModelIdentifier;
      if(!endpoint)throw Object.assign(new Error('Modelo/modo de imagem não suportado pela WaveSpeed.'),{code:'PROVIDER_INCOMPATIBLE'});
      return endpoint;
    }
    const family=providerModelIdentifier||VIDEO_FAMILIES[modelId],suffix=videoSuffix(mode);
    if(!family||!suffix||!this.supports(modelId,mode,providerModelIdentifier))throw Object.assign(new Error('Modelo/modo não suportado pela WaveSpeed.'),{code:'PROVIDER_INCOMPATIBLE'});
    return family.endsWith('/'+suffix)?family:`${family}/${suffix}`;
  }

  private imagePayload(params:ProviderGenerationParams){
    const refs=params.references.filter(r=>r.type==='IMAGE'),endpoint=this.modelName(params.model_id,params.mode,params.provider_model_identifier),capability=String(params.capability_id||'');
    const source=refs.find(ref=>ref.role==='SOURCE')||refs.find(ref=>ref.role!=='MASK')||refs[0],mask=refs.find(ref=>ref.role==='MASK');
    const out:any={prompt:compileProviderReferencePrompt(params,'wavespeed'),aspect_ratio:params.aspect_ratio,resolution:String(params.resolution||'1K').toLowerCase(),output_format:'png',enable_sync_mode:false,enable_base64_output:false};
    if(params.mode==='IMAGE_TO_IMAGE'){
      if(!source)throw Object.assign(new Error('Adicione uma imagem de origem.'),{code:'REFERENCE_REQUIRED'});
      out.images=[source.provider_accessible_url];
      if(capability==='inpaint-mask'){
        if(!mask)throw Object.assign(new Error('Máscara obrigatória para inpaint.'),{code:'MASK_REQUIRED'});
        out.mask=mask.provider_accessible_url;
      }
      if(capability==='background-remove-replace'){
        const mode=String(option(params,'background_mode','TRANSPARENT')).toUpperCase();
        if(mode==='TRANSPARENT'){out.prompt='Remove the background precisely. Preserve the foreground subject and fine edges. Return a transparent background.';out.background='transparent';}
      }
      if(capability==='upscale')out.prompt='Upscale this image faithfully. Preserve identity, composition, text and details. Increase clarity without changing content.';
      if(capability==='variations'){
        const strength=Math.max(0,Math.min(1,Number(option(params,'variation_strength',0.35))||0.35));
        out.prompt=(params.prompt||'Create a faithful visual variation of this image.')+' Keep the original subject and composition recognizable. Variation strength: '+strength.toFixed(2)+'.';
      }
      if(capability==='outpaint')out.prompt=params.prompt||'Extend the image naturally into the new canvas while preserving the original content.';
    }
    if(endpoint.startsWith('openai/gpt-image-2/'))out.quality='medium';
    if(endpoint.startsWith('google/nano-banana-2/')||endpoint.startsWith('google/nano-banana-2-lite/')){delete out.resolution;out.enable_web_search=false;out.enable_image_search=false;}
    return out;
  }

  private audioPayload(params:ProviderGenerationParams){
    const capability=String(params.capability_id||'');
    const format=String(option(params,'output_format','mp3'));
    if(capability==='text-to-speech'){
      const out:any={text:params.prompt,voice_id:String(params.provider_runtime_options?.provider_voice_id||logicalVoice(option(params,'voice','calm-female'))),format,
        speed:Number(option(params,'speed',1)),volume:Number(option(params,'volume',1)),pitch:Number(option(params,'pitch',0)),
        language_boost:languageBoost(option(params,'language','auto')),english_normalization:true};
      const style=String(option(params,'style','')).trim();if(style)out.emotion=style;return out;
    }
    if(capability==='sound-effects')return{prompt:params.prompt,duration:Math.max(1,Math.min(180,params.duration_seconds)),audio_format:format};
    if(capability==='music'){const out:any={prompt:params.prompt,instrumental:Boolean(option(params,'instrumental',false)),duration:Math.max(5,Math.min(240,params.duration_seconds))};if(params.seed!==null&&params.seed!==undefined)out.seed=params.seed;return out;}
    if(capability==='transcription'){
      const audio=firstRef(params,'AUDIO');if(!audio)throw Object.assign(new Error('Áudio obrigatório para transcrição.'),{code:'REFERENCE_REQUIRED'});
      return{audio:audio.provider_accessible_url,language:String(option(params,'language','auto')),task:'transcribe',enable_timestamps:Boolean(option(params,'timestamps',true)),prompt:params.prompt||undefined};
    }
    if(capability==='subtitles'){
      const media=firstRef(params,'VIDEO');if(!media)throw Object.assign(new Error('Vídeo obrigatório para legendas.'),{code:'REFERENCE_REQUIRED'});
      return{video:media.provider_accessible_url,language:String(option(params,'language','auto')),task:'transcribe',enable_timestamps:Boolean(option(params,'timestamps',true)),prompt:params.prompt||undefined};
    }
    if(capability==='authorized-voice-clone'){
      const audio=firstRef(params,'AUDIO');if(!audio)throw Object.assign(new Error('Áudio autorizado obrigatório para clonagem.'),{code:'REFERENCE_REQUIRED'});
      return{audio:audio.provider_accessible_url,custom_voice_id:cloneVoiceId(params),model:'speech-2.6-turbo',
        noise_reduction:true,volume_normalization:true,accuracy:0.8,language_boost:languageBoost(option(params,'language','auto'))};
    }
    if(capability==='dubbing'){
      const video=firstRef(params,'VIDEO'),audio=firstRef(params,'AUDIO'),media=video||audio;
      if(!media)throw Object.assign(new Error('Áudio ou vídeo obrigatório para dublagem.'),{code:'REFERENCE_REQUIRED'});
      const out:any={target_lang:String(option(params,'target_language','pt')),source_lang:String(option(params,'source_language','auto')),
        preserve_background_audio:true};
      if(video)out.video=video.provider_accessible_url;else out.audio=audio!.provider_accessible_url;return out;
    }
    throw Object.assign(new Error('Capability de áudio não suportada pela WaveSpeed.'),{code:'PROVIDER_INCOMPATIBLE'});
  }

  private threeDPayload(params:ProviderGenerationParams){
    const meshMode=String(option(params,'mesh_mode','TEXTURED')).toUpperCase();
    const generateType=meshMode==='GEOMETRY'?'Geometry':meshMode==='LOW_POLY'?'LowPoly':'Normal';
    const topology=String(option(params,'topology','TRIANGLE')).toUpperCase()==='QUAD'?'quadrilateral':'triangle';
    const faceCount=Math.max(40000,Math.min(1500000,Math.round(Number(option(params,'target_faces',500000))||500000)));
    const out:any={generate_type:generateType,face_count:faceCount,polygon_type:topology};
    if(generateType!=='Geometry')out.enable_pbr=Boolean(option(params,'pbr',false));
    if(params.mode==='TEXT_TO_3D'){out.prompt=params.prompt;return out;}
    const images=params.references.filter(ref=>ref.type==='IMAGE');
    if(!images.length)throw Object.assign(new Error('Imagem obrigatória para geração 3D.'),{code:'REFERENCE_REQUIRED'});
    out.image=images[0].provider_accessible_url;
    if(images[1])out.back_image=images[1].provider_accessible_url;
    if(images[2])out.left_image=images[2].provider_accessible_url;
    if(images[3])out.right_image=images[3].provider_accessible_url;
    return out;
  }

  private videoPayload(params:ProviderGenerationParams){
    const images=params.references.filter(r=>r.type==='IMAGE'),videos=params.references.filter(r=>r.type==='VIDEO'),audios=params.references.filter(r=>r.type==='AUDIO'),prompt=compileProviderReferencePrompt(params,'wavespeed');
    if(params.model_id==='minimax-h3'){const out:any={prompt,resolution:params.resolution,duration:params.duration_seconds};if(params.seed!==null&&params.seed!==undefined)out.seed=params.seed;if(params.mode==='TEXT_TO_VIDEO')out.aspect_ratio=params.aspect_ratio;if(params.mode==='IMAGE_TO_VIDEO'){const initial=images.find(r=>r.slot_type==='INITIAL')||images[0];if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});out.image=initial.provider_accessible_url;const end=images.find(r=>r.slot_type==='END');if(end)out.last_image=end.provider_accessible_url;}if(params.mode==='REFERENCE_TO_VIDEO'){out.aspect_ratio=params.aspect_ratio;out.reference_images=images.map(r=>r.provider_accessible_url);out.reference_videos=videos.map(r=>r.provider_accessible_url);out.reference_audios=audios.map(r=>r.provider_accessible_url);}return out;}
    if(params.model_id==='google-omni-flash'){const out:any={prompt,aspect_ratio:params.aspect_ratio,resolution:String(params.resolution||'720p').toLowerCase(),duration:params.duration_seconds};if(params.mode==='IMAGE_TO_VIDEO'){const initial=images.find(r=>r.slot_type==='INITIAL')||images[0];if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});out.image=initial.provider_accessible_url;const end=images.find(r=>r.slot_type==='END');if(end)out.last_image=end.provider_accessible_url;}else if(params.mode==='REFERENCE_TO_VIDEO'){out.images=images.map(r=>r.provider_accessible_url);out.reference_videos=videos.map(r=>r.provider_accessible_url);}return out;}
    if(params.model_id==='kling-3-0'){const out:any={prompt,duration:params.duration_seconds,aspect_ratio:params.aspect_ratio,sound:audioEnabled(params)};if(params.negative_prompt?.trim())out.negative_prompt=params.negative_prompt.trim();if(params.mode==='IMAGE_TO_VIDEO'){const initial=images.find(r=>r.slot_type==='INITIAL')||images[0];if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});out.image=initial.provider_accessible_url;const end=images.find(r=>r.slot_type==='END');if(end)out.end_image=end.provider_accessible_url;}return out;}
    const capability=String(params.capability_id||''),providerFamily=String(params.provider_model_identifier||VIDEO_FAMILIES[params.model_id]||'');
    const out:any={prompt,resolution:params.resolution,aspect_ratio:params.aspect_ratio,duration:params.duration_seconds};if(params.negative_prompt?.trim())out.negative_prompt=params.negative_prompt.trim();if(params.seed!==null&&params.seed!==undefined)out.seed=params.seed;if(params.mode==='IMAGE_TO_VIDEO'){const initial=images.find(r=>r.slot_type==='INITIAL')||images[0];if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});out.image=initial.provider_accessible_url;const end=images.find(r=>r.slot_type==='END');if(end)out.last_image=end.provider_accessible_url;}else if(params.mode==='REFERENCE_TO_VIDEO'){const source=videos.find(r=>r.role==='SOURCE')||videos[0];if(['video-extend','video-edit'].includes(capability)&&!source)throw Object.assign(new Error('Vídeo de origem obrigatório.'),{code:'REFERENCE_REQUIRED'});out.reference_images=images.map(r=>r.provider_accessible_url);out.reference_videos=source?[source.provider_accessible_url]:videos.map(r=>r.provider_accessible_url);out.reference_audios=audios.map(r=>r.provider_accessible_url);if(capability==='video-extend')out.prompt=params.prompt?.trim()||'Continue the source video naturally while preserving continuity, subjects, camera and motion.';}if(providerFamily.startsWith('alibaba/wan-3.0')){out.enable_prompt_expansion=false;out.enable_audio=audioEnabled(params);}if(providerFamily.includes('seedance-2.5')||providerFamily.includes('seedance-2.0'))out.generate_audio=audioEnabled(params);return out;
  }
  private payload(params:ProviderGenerationParams){if(isAudioMode(params.mode))return this.audioPayload(params);if(isThreeDMode(params.mode))return this.threeDPayload(params);return params.mode==='TEXT_TO_IMAGE'||params.mode==='IMAGE_TO_IMAGE'?this.imagePayload(params):this.videoPayload(params);}
  async quoteCostUsd(params:ProviderGenerationParams):Promise<ProviderCostQuote>{if(!this.apiKey)throw Object.assign(new Error('WaveSpeed não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const model=this.modelName(params.model_id,params.mode,params.provider_model_identifier),single={...params,number_of_outputs:1},controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const res=await fetch(`${this.baseUrl}/api/v3/model/price`,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model_id:model,inputs:this.payload(single)})});const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}if(!res.ok)throw Object.assign(new Error(body?.message||body?.error||`WaveSpeed pricing HTTP ${res.status}`),{code:`WAVESPEED_PRICE_HTTP_${res.status}`});const data=body?.data??body,unit=Number(data?.discounted_price??data?.price);if(!Number.isFinite(unit)||unit<0)throw Object.assign(new Error('WaveSpeed retornou preço inválido.'),{code:'PROVIDER_PRICE_INVALID'});return{effective_price_usd:unit*Math.max(1,params.number_of_outputs),list_price_usd:Number.isFinite(Number(data?.price))?Number(data.price)*Math.max(1,params.number_of_outputs):null,discount_rate:Number.isFinite(Number(data?.discount_rate))?Number(data.discount_rate):null,estimated:false,source:'LIVE_API'};}finally{clearTimeout(timer);}}
  private encodeBatchJobIds(ids:string[]){return ids.length===1?ids[0]:`batch:${Buffer.from(JSON.stringify(ids),'utf8').toString('base64url')}`;}
  private decodeBatchJobIds(id:string){if(!id.startsWith('batch:'))return[id];try{const decoded=JSON.parse(Buffer.from(id.slice(6),'base64url').toString('utf8'));return Array.isArray(decoded)&&decoded.every(v=>typeof v==='string'&&v)?decoded:[id];}catch{return[id];}}
  private async submitSingle(params:ProviderGenerationParams){
    const model=this.modelName(params.model_id,params.mode,params.provider_model_identifier),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const res=await fetch(`${this.baseUrl}/api/v3/${model}`,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(this.payload({...params,number_of_outputs:1}))});
      const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}
      if(!res.ok)throw Object.assign(new Error(body?.message||body?.error||`WaveSpeed HTTP ${res.status}`),{code:`WAVESPEED_HTTP_${res.status}`});
      const data=body?.data??body;if(!data?.id)throw Object.assign(new Error('WaveSpeed não retornou prediction id.'),{code:'PROVIDER_INVALID_RESPONSE'});
      return String(data.id);
    }finally{clearTimeout(timer);}
  }
  private async checkSingleStatus(id:string):Promise<ProviderJobStatusResult>{
    const res=await fetch(`${this.baseUrl}/api/v3/predictions/${encodeURIComponent(id)}/result`,{headers:{Authorization:`Bearer ${this.apiKey}`}}),text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}
    if(!res.ok)throw Object.assign(new Error(body?.message||`WaveSpeed status HTTP ${res.status}`),{code:`WAVESPEED_HTTP_${res.status}`});
    const data=body?.data??body,raw=String(data?.status||'').toLowerCase();
    if(raw==='completed'){
      const rawOutputs=Array.isArray(data.outputs)?data.outputs:[data.output,data.result,data.output?.video_url,data.video_url,data.output?.image_url,data.image_url,data.output?.audio_url,data.audio_url].filter(Boolean);
      const urls:string[]=[],objects:any[]=[];let textOutput='';
      const visit=(value:any)=>{if(value==null)return;if(typeof value==='string'){if(/^https:\/\//i.test(value))urls.push(value);else if(!textOutput)textOutput=value;return;}if(typeof value==='object'){objects.push(value);for(const key of ['url','audio_url','video_url','output_url','file_url','model_url','glb_url','mesh_url','model','glb'])if(typeof value[key]==='string'&&/^https:\/\//i.test(value[key]))urls.push(value[key]);for(const key of ['text','transcript','transcription','content'])if(!textOutput&&typeof value[key]==='string')textOutput=value[key];}};
      rawOutputs.forEach(visit);
      if(!textOutput)for(const key of ['text','transcript','transcription'])if(typeof data?.[key]==='string'){textOutput=data[key];break;}
      return{provider_job_id:id,status:'SUCCEEDED',progress_percent:100,result_video_url:urls[0],result_urls:Array.from(new Set(urls)),result_text:textOutput||undefined,result_structured:objects.length?{outputs:objects}:undefined};
    }
    if(['failed','cancelled','canceled','timeout','deleted'].includes(raw))return{provider_job_id:id,status:'FAILED',error_message:String(data?.error||data?.message||'Falha na WaveSpeed.')};
    return{provider_job_id:id,status:raw==='pending'||raw==='queued'?'QUEUED':'PROCESSING',progress_percent:typeof data?.progress==='number'?data.progress:undefined};
  }
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{
    if(!this.apiKey)throw Object.assign(new Error('WaveSpeed não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const imageJob=params.mode==='TEXT_TO_IMAGE'||params.mode==='IMAGE_TO_IMAGE';
    const requested=imageJob?Math.max(1,Math.min(4,Number(params.number_of_outputs||1))):1;
    const ids:string[]=[];
    for(let i=0;i<requested;i++)ids.push(await this.submitSingle(params));
    return{provider_job_id:this.encodeBatchJobIds(ids),provider_id:this.providerId,status:'QUEUED'};
  }
  async checkStatus(id:string):Promise<ProviderJobStatusResult>{
    if(!this.apiKey)throw Object.assign(new Error('WaveSpeed não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const ids=this.decodeBatchJobIds(id),statuses=await Promise.all(ids.map(jobId=>this.checkSingleStatus(jobId)));
    const failed=statuses.find(s=>s.status==='FAILED');
    if(failed)return{provider_job_id:id,status:'FAILED',error_message:failed.error_message||'Uma das saídas falhou na WaveSpeed.'};
    if(statuses.every(s=>s.status==='SUCCEEDED')){
      const outputs=statuses.flatMap(s=>s.result_urls||s.result_image_urls||[s.result_video_url].filter(Boolean) as string[]).filter(Boolean);
      const first=statuses[0];return{provider_job_id:id,status:'SUCCEEDED',progress_percent:100,result_video_url:outputs[0],result_urls:outputs,result_text:first?.result_text,result_structured:first?.result_structured};
    }
    const progress=Math.round(statuses.reduce((sum,s)=>sum+Number(s.progress_percent??(s.status==='SUCCEEDED'?100:8)),0)/Math.max(1,statuses.length));
    return{provider_job_id:id,status:statuses.some(s=>s.status==='PROCESSING'||s.status==='SUCCEEDED')?'PROCESSING':'QUEUED',progress_percent:progress};
  }
  async cancelJob(){return false;}
}
