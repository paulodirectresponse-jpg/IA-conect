import crypto from 'crypto';
import { GenerationMode } from '../../src/types/index.js';
import { ProviderGenerationParams, ProviderJobResult, ProviderJobStatusResult, VideoProviderAdapter } from './videoProviderAdapter.js';
import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';

const timeoutMs=45_000;
const imageModes=new Set<GenerationMode>(['TEXT_TO_IMAGE','IMAGE_TO_IMAGE']);
const videoModes=new Set<GenerationMode>(['TEXT_TO_VIDEO','IMAGE_TO_VIDEO','REFERENCE_TO_VIDEO','VIDEO_TO_VIDEO']);
const audioModes=new Set<GenerationMode>(['TEXT_TO_SPEECH','TEXT_TO_AUDIO','AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING']);
const threeDModes=new Set<GenerationMode>(['TEXT_TO_3D','IMAGE_TO_3D','MULTI_IMAGE_TO_3D']);

function base(value:string|undefined,fallback:string){return String(value||fallback).replace(/\/+$/,'');}
function firstRef(params:ProviderGenerationParams,type:'IMAGE'|'VIDEO'|'AUDIO'){return params.references.find(ref=>ref.type===type);}
function refs(params:ProviderGenerationParams,type:'IMAGE'|'VIDEO'|'AUDIO'){return params.references.filter(ref=>ref.type===type).map(ref=>ref.provider_accessible_url);}
function model(params:ProviderGenerationParams){const value=String(params.provider_model_identifier||'').trim();if(!value)throw Object.assign(new Error('Mapping do provider não configurado.'),{code:'PROVIDER_MAPPING_INVALID'});return value;}
function parseJson(text:string){try{return JSON.parse(text);}catch{return{};}}
async function requestJson(url:string,init:RequestInit){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{...init,signal:controller.signal});
    const text=await res.text();const body=parseJson(text);
    if(!res.ok)throw Object.assign(new Error(body?.error?.message||body?.message||body?.msg||body?.detail||`HTTP ${res.status}`),{code:`PROVIDER_HTTP_${res.status}`,status:res.status,body});
    return body;
  }finally{clearTimeout(timer);}
}
function extractUrls(value:any,out:string[]=[]):string[]{
  if(typeof value==='string'&&/^https?:\/\//i.test(value)){out.push(value);return out;}
  if(Array.isArray(value)){for(const item of value)extractUrls(item,out);return out;}
  if(value&&typeof value==='object'){for(const [key,item] of Object.entries(value)){if(/url|uri|file|output|result|image|video|audio|mesh|model/i.test(key))extractUrls(item,out);} }
  return Array.from(new Set(out));
}
function result(id:string,raw:string,body:any,error?:string):ProviderJobStatusResult{
  const status=raw.toLowerCase();
  if(['failed','fail','error','canceled','cancelled'].includes(status))return{provider_job_id:id,status:'FAILED',error_message:error||String(body?.error||body?.message||'Falha no provider.')};
  if(['succeeded','success','completed','complete','done','finished'].includes(status)){
    const urls=extractUrls(body);return{provider_job_id:id,status:'SUCCEEDED',progress_percent:100,result_urls:urls,result_image_urls:urls.filter(url=>/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)),result_video_url:urls.find(url=>/\.(mp4|webm|mov)(\?|$)/i.test(url)),result_text:typeof body?.text==='string'?body.text:undefined,result_structured:body&&typeof body==='object'?body:null};
  }
  const progress=Number(body?.progress??body?.progress_percent??body?.percentage);
  return{provider_job_id:id,status:['queued','pending','waiting','starting','in_queue','queuing'].includes(status)?'QUEUED':'PROCESSING',progress_percent:Number.isFinite(progress)?Math.max(0,Math.min(100,progress)):undefined};
}
function syncId(payload:any){return `sync:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;}
function syncStatus(id:string):ProviderJobStatusResult|null{if(!id.startsWith('sync:'))return null;try{return JSON.parse(Buffer.from(id.slice(5),'base64url').toString('utf8')) as ProviderJobStatusResult;}catch{return{provider_job_id:id,status:'FAILED',error_message:'Resultado síncrono inválido.'};}}
function dimensions(resolution:string,ratio:string){
  const r=String(ratio||'1:1').split(':').map(Number),long=String(resolution||'1K').toLowerCase()==='4k'?4096:String(resolution||'').toLowerCase()==='2k'?2048:1024;
  const a=r[0]>0?r[0]:1,b=r[1]>0?r[1]:1;if(a>=b)return{width:long,height:Math.max(64,Math.round(long*b/a/64)*64)};return{width:Math.max(64,Math.round(long*a/b/64)*64),height:long};
}
function genericInput(params:ProviderGenerationParams){
  const images=refs(params,'IMAGE'),videos=refs(params,'VIDEO'),audios=refs(params,'AUDIO');
  const input:any={prompt:params.prompt};
  if(params.negative_prompt)input.negative_prompt=params.negative_prompt;
  if(params.aspect_ratio)input.aspect_ratio=params.aspect_ratio;
  if(params.resolution)input.resolution=params.resolution;
  if(params.duration_seconds>1){input.duration=params.duration_seconds;input.seconds=params.duration_seconds;}
  if(params.seed!==null&&params.seed!==undefined)input.seed=params.seed;
  if(params.audio_enabled!==undefined)input.audio_enabled=params.audio_enabled;
  if(images[0]){input.image_url=images[0];input.image=images[0];}
  if(images.length>1){input.image_urls=images;input.images=images;}
  if(videos[0]){input.video_url=videos[0];input.video=videos[0];}
  if(audios[0]){input.audio_url=audios[0];input.audio=audios[0];}
  const opts=params.pricing_options||{};for(const[key,value]of Object.entries(opts))if(value!==undefined&&!(key in input))input[key]=value;
  return input;
}

abstract class CatalogPricedAdapter implements VideoProviderAdapter{
  abstract readonly providerId:string;abstract readonly name:string;abstract isConfigured():boolean;
  supports(_modelId:string,_mode:GenerationMode,providerModelIdentifier?:string){return Boolean(providerModelIdentifier);}
  quoteCostUsd(params:ProviderGenerationParams){return providerPricingCatalogService.quote(this.providerId,params);}
  abstract submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>;
  abstract checkStatus(providerJobId:string):Promise<ProviderJobStatusResult>;
  async cancelJob(_providerJobId:string){return false;}
}

export class RunwareProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-runware';readonly name='Runware';
  private get key(){return process.env.RUNWARE_API_KEY?.trim();}private get url(){return base(process.env.RUNWARE_BASE_URL,'https://api.runware.ai/v1');}
  isConfigured(){return Boolean(this.key);}
  private headers(){return{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{
    if(!this.key)throw Object.assign(new Error('Runware não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const taskUUID=crypto.randomUUID(),identifier=model(params),dim=dimensions(params.resolution,params.aspect_ratio),input:any={taskUUID,model:identifier,deliveryMethod:'async',includeCost:true,positivePrompt:params.prompt,...dim};
    if(params.negative_prompt)input.negativePrompt=params.negative_prompt;if(params.seed!=null)input.seed=params.seed;
    if(imageModes.has(params.mode)){input.taskType='imageInference';input.numberResults=Math.max(1,params.number_of_outputs);const image=firstRef(params,'IMAGE');if(image)input.seedImage=image.provider_accessible_url;}
    else if(videoModes.has(params.mode)){input.taskType='videoInference';input.duration=params.duration_seconds;const image=firstRef(params,'IMAGE'),video=firstRef(params,'VIDEO');if(image)input.seedImage=image.provider_accessible_url;if(video)input.video=video.provider_accessible_url;}
    else if(audioModes.has(params.mode)){input.taskType='audioInference';input.duration=params.duration_seconds;const audio=firstRef(params,'AUDIO');if(audio)input.audio=audio.provider_accessible_url;}
    else if(threeDModes.has(params.mode)){input.taskType='3dInference';const image=firstRef(params,'IMAGE');if(image)input.image=image.provider_accessible_url;}
    else throw Object.assign(new Error('Modo não suportado pela Runware.'),{code:'PROVIDER_INCOMPATIBLE'});
    const body=await requestJson(this.url,{method:'POST',headers:this.headers(),body:JSON.stringify([input])});
    const err=body?.errors?.[0];if(err)throw Object.assign(new Error(err.message||'Falha na Runware.'),{code:err.code||'RUNWARE_ERROR'});
    return{provider_job_id:taskUUID,provider_id:this.providerId,status:'QUEUED'};
  }
  async checkStatus(id:string):Promise<ProviderJobStatusResult>{
    if(!this.key)throw Object.assign(new Error('Runware não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});
    const body=await requestJson(this.url,{method:'POST',headers:this.headers(),body:JSON.stringify([{taskType:'getResponse',taskUUID:id}])});
    const err=body?.errors?.[0];if(err)return{provider_job_id:id,status:'FAILED',error_code:String(err.code||''),error_message:String(err.message||'Falha na Runware.')};
    const data=body?.data?.find?.((item:any)=>item?.taskUUID===id)||body?.data?.[0]||{};return result(id,String(data.status||'processing'),data);
  }
}

function falJob(endpoint:string,id:string){return `fal|${encodeURIComponent(endpoint)}|${id}`;}
function parseFalJob(value:string){const parts=value.split('|');if(parts.length<3)throw new Error('Fal job id inválido.');return{endpoint:decodeURIComponent(parts[1]),id:parts.slice(2).join('|')};}
export class FalProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-fal';readonly name='fal.ai';
  private get key(){return process.env.FAL_API_KEY?.trim();}private get url(){return base(process.env.FAL_BASE_URL,'https://queue.fal.run');}
  isConfigured(){return Boolean(this.key);}
  private headers(){return{Authorization:`Key ${this.key}`,'Content-Type':'application/json','x-app-fal-disable-fallback':'true'};}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{if(!this.key)throw Object.assign(new Error('fal.ai não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const endpoint=model(params),body=await requestJson(`${this.url}/${endpoint}`,{method:'POST',headers:this.headers(),body:JSON.stringify(genericInput(params))});const id=String(body?.request_id||body?.requestId||'');if(!id)throw Object.assign(new Error('fal.ai não retornou request_id.'),{code:'PROVIDER_INVALID_RESPONSE'});return{provider_job_id:falJob(endpoint,id),provider_id:this.providerId,status:'QUEUED'};}
  async checkStatus(job:string):Promise<ProviderJobStatusResult>{if(!this.key)throw Object.assign(new Error('fal.ai não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const{endpoint,id}=parseFalJob(job),statusBody=await requestJson(`${this.url}/${endpoint}/requests/${encodeURIComponent(id)}/status`,{headers:this.headers()});const raw=String(statusBody?.status||'IN_PROGRESS').toUpperCase();if(raw==='COMPLETED'){const body=await requestJson(`${this.url}/${endpoint}/requests/${encodeURIComponent(id)}`,{headers:this.headers()});return result(job,'success',body?.data??body);}if(['FAILED','CANCELED','CANCELLED'].includes(raw))return result(job,'failed',statusBody,statusBody?.error);return result(job,raw==='IN_QUEUE'?'queued':'processing',statusBody);}
}

export class DeepInfraProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-deepinfra';readonly name='DeepInfra';
  private get key(){return process.env.DEEPINFRA_API_KEY?.trim();}private get url(){return base(process.env.DEEPINFRA_BASE_URL,'https://api.deepinfra.com');}
  isConfigured(){return Boolean(this.key);}private headers(){return{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};}
  supports(_modelId:string,mode:GenerationMode,identifier?:string){return Boolean(identifier)&&(imageModes.has(mode)||videoModes.has(mode)||mode==='TEXT_TO_SPEECH'||mode==='AUDIO_TO_TEXT');}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{
    if(!this.key)throw Object.assign(new Error('DeepInfra não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const identifier=model(params),input=genericInput(params);input.model=identifier;
    const endpoint=imageModes.has(params.mode)?'/v1/images/generations':videoModes.has(params.mode)?'/v1/videos':params.mode==='TEXT_TO_SPEECH'?`/v1/inference/${identifier}`:`/v1/inference/${identifier}`;
    const body=await requestJson(`${this.url}${endpoint}`,{method:'POST',headers:this.headers(),body:JSON.stringify(input)});const id=String(body?.id||body?.request_id||body?.requestId||'');
    if(id)return{provider_job_id:`deep:${id}`,provider_id:this.providerId,status:'QUEUED'};
    const urls=extractUrls(body),sync:ProviderJobStatusResult={provider_job_id:'',status:'SUCCEEDED',progress_percent:100,result_urls:urls,result_image_urls:urls,result_video_url:urls.find(url=>/\.(mp4|webm|mov)(\?|$)/i.test(url)),result_text:typeof body?.text==='string'?body.text:undefined,result_structured:body};const job=syncId(sync);sync.provider_job_id=job;return{provider_job_id:job,provider_id:this.providerId,status:'SUCCEEDED'};
  }
  async checkStatus(job:string):Promise<ProviderJobStatusResult>{const sync=syncStatus(job);if(sync){sync.provider_job_id=job;return sync;}if(!this.key)throw Object.assign(new Error('DeepInfra não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const id=job.replace(/^deep:/,'');const body=await requestJson(`${this.url}/v1/videos/${encodeURIComponent(id)}`,{headers:this.headers()});return result(job,String(body?.status||'processing'),body,body?.error?.message);}
}

function replicateInput(params:ProviderGenerationParams){const input=genericInput(params);delete input.image;delete input.video;delete input.audio;return input;}
export class ReplicateProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-replicate';readonly name='Replicate';
  private get key(){return process.env.REPLICATE_API_TOKEN?.trim();}private get url(){return base(process.env.REPLICATE_BASE_URL,'https://api.replicate.com/v1');}
  isConfigured(){return Boolean(this.key);}private headers(){return{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{if(!this.key)throw Object.assign(new Error('Replicate não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const identifier=model(params),colon=identifier.lastIndexOf(':'),hasVersion=colon>identifier.indexOf('/'),modelName=hasVersion?identifier.slice(0,colon):identifier,version=hasVersion?identifier.slice(colon+1):'';let url=`${this.url}/predictions`,payload:any={input:replicateInput(params)};if(version)payload.version=version;else{const parts=modelName.split('/');if(parts.length!==2)throw Object.assign(new Error('Identificador Replicate deve ser owner/model ou owner/model:version.'),{code:'PROVIDER_MAPPING_INVALID'});url=`${this.url}/models/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/predictions`;}
    const body=await requestJson(url,{method:'POST',headers:this.headers(),body:JSON.stringify(payload)}),id=String(body?.id||'');if(!id)throw Object.assign(new Error('Replicate não retornou prediction id.'),{code:'PROVIDER_INVALID_RESPONSE'});return{provider_job_id:id,provider_id:this.providerId,status:['succeeded'].includes(String(body.status))?'SUCCEEDED':'QUEUED'};}
  async checkStatus(id:string):Promise<ProviderJobStatusResult>{if(!this.key)throw Object.assign(new Error('Replicate não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const body=await requestJson(`${this.url}/predictions/${encodeURIComponent(id)}`,{headers:this.headers()});return result(id,String(body?.status||'processing'),body?.output??body,body?.error);}
  async cancelJob(id:string){if(!this.key)return false;try{await requestJson(`${this.url}/predictions/${encodeURIComponent(id)}/cancel`,{method:'POST',headers:this.headers()});return true;}catch{return false;}}
}

export class AimlProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-aiml';readonly name='AI/ML API';
  private get key(){return process.env.AIML_API_KEY?.trim();}private get url(){return base(process.env.AIML_BASE_URL,'https://api.aimlapi.com');}
  isConfigured(){return Boolean(this.key);}private headers(){return{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};}
  supports(_modelId:string,mode:GenerationMode,identifier?:string){return Boolean(identifier)&&(imageModes.has(mode)||videoModes.has(mode));}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{if(!this.key)throw Object.assign(new Error('AI/ML API não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const input=genericInput(params);input.model=model(params);const endpoint=imageModes.has(params.mode)?'/v1/images/generations':'/v2/video/generations';const body=await requestJson(`${this.url}${endpoint}`,{method:'POST',headers:this.headers(),body:JSON.stringify(input)});const id=String(body?.generation_id||body?.id||'');if(id)return{provider_job_id:`aiml:${id}`,provider_id:this.providerId,status:'QUEUED'};const urls=extractUrls(body),sync:ProviderJobStatusResult={provider_job_id:'',status:'SUCCEEDED',progress_percent:100,result_urls:urls,result_image_urls:urls,result_structured:body};const job=syncId(sync);sync.provider_job_id=job;return{provider_job_id:job,provider_id:this.providerId,status:'SUCCEEDED'};}
  async checkStatus(job:string):Promise<ProviderJobStatusResult>{const sync=syncStatus(job);if(sync){sync.provider_job_id=job;return sync;}if(!this.key)throw Object.assign(new Error('AI/ML API não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const id=job.replace(/^aiml:/,'');const body=await requestJson(`${this.url}/v2/video/generations?generation_id=${encodeURIComponent(id)}`,{headers:this.headers()});const data=body?.data??body;return result(job,String(data?.status||data?.state||'processing'),data,data?.error);}
}

function piIdentifier(value:string){const [modelName,taskType]=value.split('::');return{modelName,taskType:taskType||''};}
export class PiApiProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-piapi';readonly name='PiAPI';
  private get key(){return process.env.PIAPI_API_KEY?.trim();}private get url(){return base(process.env.PIAPI_BASE_URL,'https://api.piapi.ai');}
  isConfigured(){return Boolean(this.key);}private headers(){return{'x-api-key':String(this.key),'Content-Type':'application/json'};}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{if(!this.key)throw Object.assign(new Error('PiAPI não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const{id:_,...input}=genericInput(params) as any,{modelName,taskType}=piIdentifier(model(params));if(!taskType)throw Object.assign(new Error('Mapping PiAPI deve usar model::task_type.'),{code:'PROVIDER_MAPPING_INVALID'});const body=await requestJson(`${this.url}/api/v1/task`,{method:'POST',headers:this.headers(),body:JSON.stringify({model:modelName,task_type:taskType,input})}),data=body?.data??body,id=String(data?.task_id||data?.taskId||data?.id||'');if(!id)throw Object.assign(new Error('PiAPI não retornou task id.'),{code:'PROVIDER_INVALID_RESPONSE'});return{provider_job_id:id,provider_id:this.providerId,status:'QUEUED'};}
  async checkStatus(id:string):Promise<ProviderJobStatusResult>{if(!this.key)throw Object.assign(new Error('PiAPI não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const body=await requestJson(`${this.url}/api/v1/task/${encodeURIComponent(id)}`,{headers:this.headers()}),data=body?.data??body;return result(id,String(data?.status||data?.state||'processing'),data?.output??data,data?.error?.message||data?.error);}
}

export class KieProviderAdapter extends CatalogPricedAdapter{
  readonly providerId='provider-kie';readonly name='Kie.ai';
  private get key(){return process.env.KIE_API_KEY?.trim();}private get url(){return base(process.env.KIE_BASE_URL,'https://api.kie.ai');}
  isConfigured(){return Boolean(this.key);}private headers(){return{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'};}
  async submitGeneration(params:ProviderGenerationParams):Promise<ProviderJobResult>{if(!this.key)throw Object.assign(new Error('Kie.ai não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const payload:any={model:model(params),input:genericInput(params)};if(params.callback_url)payload.callBackUrl=params.callback_url;const body=await requestJson(`${this.url}/api/v1/jobs/createTask`,{method:'POST',headers:this.headers(),body:JSON.stringify(payload)}),data=body?.data??body,id=String(data?.taskId||data?.task_id||'');if(!id)throw Object.assign(new Error(body?.msg||'Kie.ai não retornou taskId.'),{code:'PROVIDER_INVALID_RESPONSE'});return{provider_job_id:id,provider_id:this.providerId,status:'QUEUED'};}
  async checkStatus(id:string):Promise<ProviderJobStatusResult>{if(!this.key)throw Object.assign(new Error('Kie.ai não configurada.'),{code:'PROVIDER_NOT_CONFIGURED'});const body=await requestJson(`${this.url}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`,{headers:this.headers()}),data=body?.data??body;let payload:any=data;try{if(typeof data?.resultJson==='string')payload={...data,...JSON.parse(data.resultJson)};}catch{}return result(id,String(data?.state||'generating'),payload,data?.failMsg);}
}
