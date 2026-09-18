import { GenerationMode, ModelRegistryItem, ProviderModelMapping } from '../../src/types/index.js';
import { CapabilityId, capabilityIdsForModel } from '../beta/capabilityRegistry.js';
import { ProviderGenerationParams, ProviderGenerationReference } from '../adapters/videoProviderAdapter.js';
import { ProviderPricingUnit } from './providerPricingCatalogService.js';

const IMAGE_REF='https://storage.googleapis.com/ia-conect-pricing-probes/reference-image.png';
const VIDEO_REF='https://storage.googleapis.com/ia-conect-pricing-probes/reference-video.mp4';
const AUDIO_REF='https://storage.googleapis.com/ia-conect-pricing-probes/reference-audio.mp3';

export interface RoutePricingProfile{capability_id:CapabilityId;mode:GenerationMode;pricing_unit:ProviderPricingUnit;baseline_quantity:number;params:ProviderGenerationParams;}

export function modeForCapability(id:string):GenerationMode|null{
  if(id==='text-to-image')return'TEXT_TO_IMAGE';
  if(['image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(id))return'IMAGE_TO_IMAGE';
  if(id==='text-to-video')return'TEXT_TO_VIDEO';
  if(['image-to-video','first-frame','last-frame'].includes(id))return'IMAGE_TO_VIDEO';
  if(['video-extend','video-edit'].includes(id))return'REFERENCE_TO_VIDEO';
  if(id==='text-to-speech')return'TEXT_TO_SPEECH';
  if(['sound-effects','music'].includes(id))return'TEXT_TO_AUDIO';
  if(id==='transcription')return'AUDIO_TO_TEXT';
  if(id==='subtitles')return'MEDIA_TO_TEXT';
  if(id==='authorized-voice-clone')return'AUDIO_TO_AUDIO';
  if(id==='dubbing')return'MEDIA_DUBBING';
  if(id==='text-to-3d')return'TEXT_TO_3D';
  if(id==='image-to-3d')return'IMAGE_TO_3D';
  if(id==='multi-image-to-3d')return'MULTI_IMAGE_TO_3D';
  return null;
}

export function defaultPricingUnit(capabilityId:string):ProviderPricingUnit{
  if(capabilityId==='text-to-speech')return'CHARACTER';
  if(['text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit','sound-effects','music'].includes(capabilityId))return'SECOND';
  if(['text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(capabilityId))return'OUTPUT';
  if(['transcription','subtitles','dubbing'].includes(capabilityId))return'MINUTE';
  return'REQUEST';
}

function ref(type:'IMAGE'|'VIDEO'|'AUDIO',url:string,role:'SOURCE'|'REFERENCE'='SOURCE'):ProviderGenerationReference{
  return{asset_id:'pricing-'+type.toLowerCase(),type,provider_accessible_url:url,slot_type:'GENERAL',role};
}

function firstResolution(model:ModelRegistryItem,capabilityId:string){
  const values=model.supported_resolutions||[];
  if(capabilityId==='text-to-speech'||['sound-effects','music','transcription','subtitles','authorized-voice-clone','dubbing'].includes(capabilityId))return'audio';
  if(capabilityId.includes('3d'))return'3D';
  return['720p','1K','1080p','2K','480p','4K'].find(value=>values.includes(value))||values[0]||(model.category==='IMAGE'?'1K':'720p');
}
function firstAspect(model:ModelRegistryItem,capabilityId:string){
  if(capabilityId.includes('3d'))return'3D';
  if(['text-to-speech','sound-effects','music','transcription','subtitles','authorized-voice-clone','dubbing'].includes(capabilityId))return'audio';
  return model.recommended_aspect_ratio||model.supported_aspect_ratios?.[0]||(model.category==='IMAGE'?'1:1':'16:9');
}
function durationFor(model:ModelRegistryItem,capabilityId:string){
  if(capabilityId==='text-to-speech')return 1;
  if(capabilityId==='music')return model.supported_durations?.find(v=>Number(v)>=30)||30;
  if(capabilityId==='sound-effects')return model.supported_durations?.[0]||5;
  if(['transcription','subtitles','dubbing'].includes(capabilityId))return 60;
  if(['text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit'].includes(capabilityId))return model.supported_durations?.[0]||5;
  return 1;
}

export function pricingCapabilities(model:ModelRegistryItem,mapping:ProviderModelMapping){
  const declared=capabilityIdsForModel(model);
  const mapped=(mapping.capabilities||[]).filter((id):id is CapabilityId=>declared.includes(id as CapabilityId));
  return mapped.length?mapped:declared;
}

export function routePricingProfile(model:ModelRegistryItem,mapping:ProviderModelMapping,capabilityId:CapabilityId):RoutePricingProfile|null{
  const mode=modeForCapability(capabilityId);if(!mode)return null;
  const unit=defaultPricingUnit(capabilityId),duration=durationFor(model,capabilityId);
  const references:ProviderGenerationReference[]=[];
  if(['image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations','image-to-video','first-frame','last-frame','image-to-3d','multi-image-to-3d'].includes(capabilityId))references.push(ref('IMAGE',IMAGE_REF));
  if(['video-extend','video-edit'].includes(capabilityId))references.push(ref('VIDEO',VIDEO_REF));
  if(['transcription','authorized-voice-clone'].includes(capabilityId))references.push(ref('AUDIO',AUDIO_REF));
  if(['subtitles','dubbing'].includes(capabilityId))references.push(ref('VIDEO',VIDEO_REF));
  const prompt=capabilityId==='text-to-speech'?'x'.repeat(1000):capabilityId==='video-extend'?'Continue the source video naturally while preserving continuity.':'Pricing verification probe';
  const params:ProviderGenerationParams={generation_id:'pricing-sync',user_id:'pricing-sync',model_id:model.model_id,mode,capability_id:capabilityId,provider_model_identifier:mapping.provider_model_identifier,prompt,duration_seconds:Number(duration)||1,resolution:firstResolution(model,capabilityId),aspect_ratio:firstAspect(model,capabilityId),number_of_outputs:1,references,audio_enabled:false,model_variant:'default',pricing_options:{pricing_probe:true,text_chars:capabilityId==='text-to-speech'?1000:undefined}};
  const baselineQuantity=unit==='CHARACTER'?1000:unit==='SECOND'?Math.max(1,params.duration_seconds):unit==='MINUTE'?Math.max(1,params.duration_seconds)/60:1;
  return{capability_id:capabilityId,mode,pricing_unit:unit,baseline_quantity:baselineQuantity,params};
}