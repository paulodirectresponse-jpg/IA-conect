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
  'minimax-h3': 'minimax/h3',
};

function videoSuffixFor(mode:GenerationMode,capabilityId?:string){if(mode==='TEXT_TO_VIDEO')return'text-to-video';if(mode==='IMAGE_TO_VIDEO')return'image-to-video';if(mode==='REFERENCE_TO_VIDEO'){if(capabilityId==='video-edit')return'video-edit';if(capabilityId==='video-extend')return'video-extend';return'reference-to-video';}return null;}
const VIDEO_OPERATION_SUFFIXES=['text-to-video','image-to-video','reference-to-video','video-edit','video-extend'];
function normalizeVideoIdentifier(identifier:string,suffix:string){const clean=String(identifier||'').replace(/\/+$/,'');const current=VIDEO_OPERATION_SUFFIXES.find(op=>clean.endsWith('/'+op));if(current)return current===suffix?clean:clean.slice(0,-current.length)+suffix;return clean+'/'+suffix;}
function trimBase(value:string|undefined){return (value||'https://api.atlascloud.ai').replace(/\/+$/,'').replace(/\/api\/v1$/,'');}
function groups(params:ProviderGenerationParams){return {
  images:params.references.filter((r)=>r.type==='IMAGE'),
  videos:params.references.filter((r)=>r.type==='VIDEO'),
  audios:params.references.filter((r)=>r.type==='AUDIO'),
};}
function atlasResolution(modelId:string,res:string){
  if(modelId==='minimax-h3'&&res.toLowerCase()==='768p')return '768P';
  if(modelId==='minimax-h3'&&res.toLowerCase()==='2k')return '2K';
  return res;
}
function audioEnabled(params:ProviderGenerationParams){return params.audio_enabled!==false;}

export class AtlasProviderAdapter implements VideoProviderAdapter {
  readonly providerId='provider-atlas';
  readonly name='Atlas Cloud';
  private get apiKey(){return process.env.ATLAS_API_KEY?.trim();}
  private get baseUrl(){return trimBase(process.env.ATLAS_BASE_URL);}
  isConfigured(){return Boolean(this.apiKey);}

  supports(modelId:string,mode:GenerationMode,providerModelIdentifier?:string){
    if(mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE')return Boolean(providerModelIdentifier);
    return Boolean((providerModelIdentifier||VIDEO_FAMILIES[modelId])&&videoSuffixFor(mode));
  }

  private modelName(modelId:string,mode:GenerationMode,providerModelIdentifier?:string,capabilityId?:string){
    if(mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE'){
      if(!providerModelIdentifier)throw Object.assign(new Error('Mapping de imagem indisponível na Atlas.'),{code:'PROVIDER_INCOMPATIBLE'});
      return providerModelIdentifier;
    }
    const family=providerModelIdentifier||VIDEO_FAMILIES[modelId];
    const suffix=videoSuffixFor(mode,capabilityId);
    if(!family||!suffix)throw Object.assign(new Error('Modelo/modo não suportado pela Atlas.'),{code:'PROVIDER_INCOMPATIBLE'});
    return normalizeVideoIdentifier(family,suffix);
  }

  private buildPayload(params:ProviderGenerationParams){
    const model=this.modelName(params.model_id,params.mode,params.provider_model_identifier,String(params.capability_id||''));
    const {images,videos,audios}=groups(params);
    const prompt=compileProviderReferencePrompt(params,'atlas');

    if(params.mode==='TEXT_TO_IMAGE'||params.mode==='IMAGE_TO_IMAGE'){
      const out:any={
        model,
        prompt,
        enable_sync_mode:false,
        enable_base64_output:false,
      };
      if(params.seed!==null&&params.seed!==undefined)out.seed=params.seed;
      if(params.negative_prompt?.trim())out.negative_prompt=params.negative_prompt.trim();
      if(params.mode==='IMAGE_TO_IMAGE'){
        const source=images.find(r=>r.role==='SOURCE')||images[0];
        if(!source)throw Object.assign(new Error('Imagem de origem obrigatória para edição na Atlas.'),{code:'REFERENCE_REQUIRED'});
        out.image=source.provider_accessible_url;
        if(images.length>1)out.images=images.map(r=>r.provider_accessible_url);
      }
      return out;
    }

    if(params.model_id==='minimax-h3'){
      const base:any={model,prompt,duration:params.duration_seconds,resolution:atlasResolution(params.model_id,params.resolution)};
      if(params.seed!==null&&params.seed!==undefined)base.seed=params.seed;
      if(params.mode==='TEXT_TO_VIDEO')base.ratio=params.aspect_ratio;
      if(params.mode==='IMAGE_TO_VIDEO'){
        const initial=images.find((r)=>r.slot_type==='INITIAL')||images[0];
        if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});
        base.image=initial.provider_accessible_url;
        const end=images.find((r)=>r.slot_type==='END');
        if(end)base.end_image=end.provider_accessible_url;
      }else if(params.mode==='REFERENCE_TO_VIDEO'){
        base.ratio=params.aspect_ratio;
        base.refers=params.references.map((r)=>({url:r.provider_accessible_url,type:r.type.toLowerCase()}));
      }
      return base;
    }

    if(params.model_id==='seedance-2-5'||params.model_id==='seedance-2-0'){
      const base:any={model,prompt,duration:params.duration_seconds,resolution:params.resolution,generate_audio:audioEnabled(params)};
      if(params.seed!==null&&params.seed!==undefined)base.seed=params.seed;
      if(params.mode==='TEXT_TO_VIDEO')base.ratio=params.aspect_ratio;
      if(params.mode==='IMAGE_TO_VIDEO'){
        const initial=images.find((r)=>r.slot_type==='INITIAL')||images[0];
        if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});
        base.image=initial.provider_accessible_url;
        base.ratio=params.model_id==='seedance-2-5'?'adaptive':params.aspect_ratio;
        const end=images.find((r)=>r.slot_type==='END');
        if(end)base.last_image=end.provider_accessible_url;
      }else if(params.mode==='REFERENCE_TO_VIDEO'){
        base.ratio=params.aspect_ratio;
        base.reference_images=images.map((r)=>r.provider_accessible_url);
        base.reference_videos=videos.map((r)=>r.provider_accessible_url);
        base.reference_audios=audios.map((r)=>r.provider_accessible_url);
        base.omni_reference_task_type='reference';
      }
      return base;
    }

    const base:any={model,prompt,duration:params.duration_seconds,resolution:params.resolution,ratio:params.aspect_ratio,audio:audioEnabled(params)};
    if(params.seed!==null&&params.seed!==undefined)base.seed=params.seed;
    if(params.mode==='IMAGE_TO_VIDEO'){
      const initial=images.find((r)=>r.slot_type==='INITIAL')||images[0];
      if(!initial)throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});
      base.image=initial.provider_accessible_url;
      const end=images.find((r)=>r.slot_type==='END');
      if(end)base.last_image=end.provider_accessible_url;
    }else if(params.mode==='REFERENCE_TO_VIDEO'){
      base.refers=params.references.map((r)=>({url:r.provider_accessible_url,type:r.type.toLowerCase()}));
    }
    return base;
  }

  async quoteCostUsd(params:ProviderGenerationParams):Promise<ProviderCostQuote>{
    if(!this.apiKey)throw Object.assign(new Error('Atlas Cloud não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const single={...params,number_of_outputs:1};
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
    try{
      const res=await fetch(`${this.baseUrl}/api/v1/model/calculate`,{
        method:'POST',signal:controller.signal,
        headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify(this.buildPayload(single)),
      });
      const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}
      if(!res.ok)throw Object.assign(new Error(body?.message||body?.error||`Atlas pricing HTTP ${res.status}`),{code:`ATLAS_PRICE_HTTP_${res.status}`});
      const data=body?.data??body;
      const unit=Number(data?.price);
      if(!Number.isFinite(unit)||unit<0)throw Object.assign(new Error('Atlas retornou preço inválido.'),{code:'PROVIDER_PRICE_INVALID'});
      return {
        effective_price_usd:unit*Math.max(1,params.number_of_outputs),
        list_price_usd:Number.isFinite(Number(data?.origin_price))?Number(data.origin_price)*Math.max(1,params.number_of_outputs):null,
        discount_rate:Number.isFinite(Number(data?.discount))?Number(data.discount):null,
        estimated:Boolean(data?.estimated),
        source:'LIVE_API',
      };
    }finally{clearTimeout(timer);}
  }

  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{
    if(!this.apiKey)throw Object.assign(new Error('Atlas Cloud não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const endpoint=(params.mode==='TEXT_TO_IMAGE'||params.mode==='IMAGE_TO_IMAGE')?'generateImage':'generateVideo';
      const res=await fetch(`${this.baseUrl}/api/v1/model/${endpoint}`,{
        method:'POST',signal:controller.signal,
        headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify(this.buildPayload(params)),
      });
      const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}
      if(!res.ok)throw Object.assign(new Error(body?.message||body?.error||`Atlas HTTP ${res.status}`),{code:`ATLAS_HTTP_${res.status}`});
      const data=body?.data??body;
      if(!data?.id)throw Object.assign(new Error('Atlas não retornou prediction id.'),{code:'PROVIDER_INVALID_RESPONSE'});
      return {provider_job_id:data.id,provider_id:this.providerId,status:'QUEUED'};
    }finally{clearTimeout(timer);}
  }

  async checkStatus(id:string):Promise<ProviderJobStatusResult>{
    if(!this.apiKey)throw Object.assign(new Error('Atlas Cloud não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const res=await fetch(`${this.baseUrl}/api/v1/model/prediction/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${this.apiKey}`}});
    const text=await res.text();let body:any={};try{body=JSON.parse(text);}catch{}
    if(!res.ok)throw Object.assign(new Error(body?.message||`Atlas status HTTP ${res.status}`),{code:`ATLAS_HTTP_${res.status}`});
    const data=body?.data??body;const raw=String(data?.status||'').toLowerCase();
    if(['completed','succeeded','success'].includes(raw)){
      const outputs=Array.isArray(data.outputs)?data.outputs.filter(Boolean):[data.output?.video_url,data.video_url].filter(Boolean);
      return {provider_job_id:id,status:'SUCCEEDED',progress_percent:100,result_video_url:outputs[0],result_urls:outputs};
    }
    if(['failed','error','timeout','cancelled','canceled'].includes(raw))return {provider_job_id:id,status:'FAILED',error_message:String(data?.error||data?.message||'Falha na Atlas.')};
    return {provider_job_id:id,status:raw==='queued'||raw==='pending'?'QUEUED':'PROCESSING',progress_percent:typeof data?.progress==='number'?data.progress:undefined};
  }
  async cancelJob(){return false;}
}
