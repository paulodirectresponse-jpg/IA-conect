import { GenerationMode } from '../../src/types/index.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { RoutingV2ProviderAdapter, RoutingV2GenerationInput } from './adapter.js';
import { RoutingV2Provider } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';

function modeForCapability(capabilityId:string):GenerationMode|null{
  if(capabilityId==='text-to-image')return'TEXT_TO_IMAGE';
  if(['image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(capabilityId))return'IMAGE_TO_IMAGE';
  if(capabilityId==='text-to-video')return'TEXT_TO_VIDEO';
  if(['image-to-video','first-frame','last-frame'].includes(capabilityId))return'IMAGE_TO_VIDEO';
  if(['video-extend','video-edit'].includes(capabilityId))return'REFERENCE_TO_VIDEO';
  if(capabilityId==='text-to-speech')return'TEXT_TO_SPEECH';
  if(['sound-effects','music'].includes(capabilityId))return'TEXT_TO_AUDIO';
  if(capabilityId==='transcription')return'AUDIO_TO_TEXT';
  if(capabilityId==='subtitles')return'MEDIA_TO_TEXT';
  if(capabilityId==='authorized-voice-clone')return'AUDIO_TO_AUDIO';
  if(capabilityId==='dubbing')return'MEDIA_DUBBING';
  if(capabilityId==='text-to-3d')return'TEXT_TO_3D';
  if(capabilityId==='image-to-3d')return'IMAGE_TO_3D';
  if(capabilityId==='multi-image-to-3d')return'MULTI_IMAGE_TO_3D';
  return null;
}

function legacyParams(input:RoutingV2GenerationInput){
  const mode=modeForCapability(input.capability_id);
  if(!mode)throw Object.assign(new Error('Capability V2 não possui modo compatível no adapter legado.'),{code:'ROUTING_V2_LEGACY_MODE_UNAVAILABLE'});
  const params=input.parameters||{};
  const references=(input.references||[]).map((ref,index)=>({
    asset_id:ref.asset_id||`routing-v2-ref-${index+1}`,
    alias:ref.alias||`ref${index+1}`,
    name:ref.name||`Referência ${index+1}`,
    type:ref.type,
    category:ref.category||'GENERIC',
    provider_accessible_url:ref.url,
    storage_path:ref.storage_path||`provider://routing-v2/reference/${index+1}`,
    mime_type:ref.mime_type||'application/octet-stream',
    slot_type:ref.slot_type,
    prompt_alias:ref.alias,
    role:ref.role as any,
  }));
  return{
    generation_id:input.generation_id,
    user_id:input.user_id,
    model_id:input.model_id,
    mode,
    capability_id:input.capability_id,
    provider_model_identifier:input.provider_model_identifier,
    provider_runtime_options:params,
    prompt:input.prompt||'Processar mídia',
    negative_prompt:input.negative_prompt,
    duration_seconds:Number(input.duration_seconds||params.duration_seconds||1),
    resolution:String(params.resolution||'1K'),
    aspect_ratio:String(params.aspect_ratio||'1:1'),
    number_of_outputs:Math.max(1,Number(input.number_of_outputs||params.number_of_outputs||1)),
    seed:params.seed===undefined?undefined:Number(params.seed),
    motion_strength:params.motion_strength===undefined?undefined:Number(params.motion_strength),
    audio_enabled:params.audio_enabled===undefined?undefined:Boolean(params.audio_enabled),
    model_variant:params.model_variant===undefined?undefined:String(params.model_variant),
    pricing_options:params,
    references,
  };
}

export function createRoutingV2LegacyAdapter(providerId:string):RoutingV2ProviderAdapter|null{
  const legacy=providerRegistry.getAdapter(providerId);
  if(!legacy)return null;
  return{
    adapter_id:`legacy:${providerId}`,
    provider_id:providerId,
    isConfigured:(_provider:RoutingV2Provider)=>legacy.isConfigured(),
    health:async()=>({
      status:legacy.isConfigured()?'UNKNOWN':'UNAVAILABLE',
      checked_at:new Date().toISOString(),
      message:'Compatibility bridge: configuration is known, live provider health remains authoritative in V2.',
    }),
    submitGeneration:async(_provider,input)=>{
      const params=legacyParams(input);
      if(!legacy.supports(input.model_id,params.mode,input.provider_model_identifier)){
        throw Object.assign(new Error('Adapter legado não suporta esta Route V2.'),{code:'ROUTING_V2_LEGACY_ROUTE_UNSUPPORTED'});
      }
      const result=await legacy.submitGeneration(params);
      if(result.status==='FAILED')throw Object.assign(new Error('Provider rejeitou a geração durante o envio.'),{code:'ROUTING_V2_LEGACY_SUBMIT_FAILED'});
      return{provider_job_id:result.provider_job_id,status:result.status};
    },
    checkGeneration:async(_provider,providerJobId)=>{
      const result=await legacy.checkStatus(providerJobId);
      return{
        provider_job_id:result.provider_job_id,
        status:result.status,
        progress_percent:result.progress_percent,
        result_urls:(result.result_urls||result.result_image_urls||[result.result_video_url]).filter(Boolean) as string[],
        error_code:result.error_code||null,
        error_message:result.error_message||null,
      };
    },
    cancelGeneration:legacy.cancelJob?async(_provider,providerJobId)=>legacy.cancelJob!(providerJobId):undefined,
  };
}

export function ensureRoutingV2LegacyAdapter(providerId:string){
  const adapterId=`legacy:${providerId}`;
  const existing=routingV2AdapterRegistry.get(adapterId);
  if(existing)return existing;
  const bridge=createRoutingV2LegacyAdapter(providerId);
  if(!bridge)return null;
  routingV2AdapterRegistry.register(bridge);
  return bridge;
}

export function ensureAllRoutingV2LegacyAdapters(){
  for(const legacy of providerRegistry.listAdapters())ensureRoutingV2LegacyAdapter(legacy.providerId);
  return routingV2AdapterRegistry.list().filter(adapter=>adapter.adapter_id.startsWith('legacy:'));
}
