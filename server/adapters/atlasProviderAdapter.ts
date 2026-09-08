import { GenerationMode } from '../../src/types/index.js';
import { VideoProviderAdapter, ProviderGenerationParams, ProviderJobResult, ProviderJobStatusResult } from './videoProviderAdapter.js';

const FAMILIES: Record<string,string> = {
  'wan-3-0': 'alibaba/wan-3.0',
  'wan-3-0-prime': 'alibaba/wan-3.0-prime',
  'seedance-2-5': 'bytedance/seedance-2.5',
  'minimax-h3': 'minimax/h3',
};

function suffixFor(mode: GenerationMode) {
  if (mode === 'TEXT_TO_VIDEO') return 'text-to-video';
  if (mode === 'IMAGE_TO_VIDEO') return 'image-to-video';
  if (mode === 'REFERENCE_TO_VIDEO') return 'reference-to-video';
  return null;
}
function trimBase(value:string|undefined){
  return (value || 'https://api.atlascloud.ai').replace(/\/+$/,'').replace(/\/api\/v1$/,'');
}
function referenceGroups(params:ProviderGenerationParams){
  const images=params.references.filter(r=>r.type==='IMAGE');
  const videos=params.references.filter(r=>r.type==='VIDEO');
  const audios=params.references.filter(r=>r.type==='AUDIO');
  return {images,videos,audios};
}

export class AtlasProviderAdapter implements VideoProviderAdapter {
  readonly providerId='provider-atlas'; readonly name='Atlas Cloud';
  private get apiKey(){return process.env.ATLAS_API_KEY?.trim();}
  private get baseUrl(){return trimBase(process.env.ATLAS_BASE_URL);}
  isConfigured(){return Boolean(this.apiKey);}
  supports(modelId:string,mode:GenerationMode){return Boolean(FAMILIES[modelId] && suffixFor(mode));}

  private modelName(modelId:string,mode:GenerationMode){
    const family=FAMILIES[modelId], suffix=suffixFor(mode);
    if(!family||!suffix) throw Object.assign(new Error('Modelo/modo não suportado pela Atlas.'),{code:'PROVIDER_INCOMPATIBLE'});
    return `${family}/${suffix}`;
  }

  private buildPayload(params:ProviderGenerationParams){
    const model=this.modelName(params.model_id,params.mode);
    const {images,videos,audios}=referenceGroups(params);
    const base:any={model,prompt:params.prompt,duration:params.duration_seconds,resolution:params.resolution};
    if(params.seed!==null&&params.seed!==undefined) base.seed=params.seed;

    if(params.model_id==='minimax-h3'){
      base.ratio=params.aspect_ratio;
      if(params.mode==='REFERENCE_TO_VIDEO') base.refers=params.references.map(r=>({url:r.provider_accessible_url,type:r.type.toLowerCase()}));
      return base;
    }

    if(params.model_id==='seedance-2-5'){
      base.ratio=params.aspect_ratio;
      base.generate_audio=true;
      if(params.mode==='IMAGE_TO_VIDEO'){
        const initial=images.find(r=>r.slot_type==='INITIAL') || images[0];
        if(!initial) throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});
        base.image=initial.provider_accessible_url;
        const end=images.find(r=>r.slot_type==='END'); if(end) base.last_image=end.provider_accessible_url;
      } else if(params.mode==='REFERENCE_TO_VIDEO'){
        base.reference_images=images.map(r=>r.provider_accessible_url);
        base.reference_videos=videos.map(r=>r.provider_accessible_url);
        base.reference_audios=audios.map(r=>r.provider_accessible_url);
        base.omni_reference_task_type='reference';
      }
      return base;
    }

    // WAN 3.0 / Prime
    base.aspect_ratio=params.aspect_ratio;
    base.enable_audio=true;
    if(params.mode==='IMAGE_TO_VIDEO'){
      const initial=images.find(r=>r.slot_type==='INITIAL') || images[0];
      if(!initial) throw Object.assign(new Error('Imagem inicial obrigatória.'),{code:'REFERENCE_REQUIRED'});
      base.image=initial.provider_accessible_url;
      const end=images.find(r=>r.slot_type==='END'); if(end) base.last_image=end.provider_accessible_url;
    } else if(params.mode==='REFERENCE_TO_VIDEO'){
      // Atlas Wan 3 Prime uses all-in-one `refers`; this format is also accepted by the unified reference family.
      base.refers=params.references.map(r=>({url:r.provider_accessible_url,type:r.type.toLowerCase()}));
    }
    return base;
  }

  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{
    if(!this.apiKey) throw Object.assign(new Error('Atlas Cloud não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const res=await fetch(`${this.baseUrl}/api/v1/model/generateVideo`,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(this.buildPayload(params))});
      const text=await res.text(); let body:any={}; try{body=JSON.parse(text);}catch{}
      if(!res.ok) throw Object.assign(new Error(body?.message||body?.error||`Atlas HTTP ${res.status}`),{code:`ATLAS_HTTP_${res.status}`});
      const data=body?.data ?? body; if(!data?.id) throw Object.assign(new Error('Atlas não retornou prediction id.'),{code:'PROVIDER_INVALID_RESPONSE'});
      return {provider_job_id:data.id,provider_id:this.providerId,status:'QUEUED'};
    } finally {clearTimeout(timer);}
  }

  async checkStatus(id:string):Promise<ProviderJobStatusResult>{
    if(!this.apiKey) throw Object.assign(new Error('Atlas Cloud não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const res=await fetch(`${this.baseUrl}/api/v1/model/prediction/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${this.apiKey}`}});
    const text=await res.text(); let body:any={}; try{body=JSON.parse(text);}catch{}
    if(!res.ok) throw Object.assign(new Error(body?.message||`Atlas status HTTP ${res.status}`),{code:`ATLAS_HTTP_${res.status}`});
    const data=body?.data ?? body; const raw=String(data?.status||'').toLowerCase();
    if(['completed','succeeded','success'].includes(raw)) return {provider_job_id:id,status:'SUCCEEDED',progress_percent:100,result_video_url:Array.isArray(data.outputs)?data.outputs[0]:undefined};
    if(['failed','error','timeout','cancelled','canceled'].includes(raw)) return {provider_job_id:id,status:'FAILED',error_message:String(data?.error||data?.message||'Falha na Atlas.')};
    return {provider_job_id:id,status:raw==='queued'||raw==='pending'?'QUEUED':'PROCESSING',progress_percent:typeof data?.progress==='number'?data.progress:undefined};
  }

  async cancelJob(){return false;}
}
