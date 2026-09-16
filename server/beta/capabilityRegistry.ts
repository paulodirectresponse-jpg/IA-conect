import { ModelRegistryItem } from '../../src/types/index.js';

export const CAPABILITY_IDS = [
  'text-to-image','image-to-image','image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations',
  'text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit',
  'text-to-speech','sound-effects','music','transcription','subtitles','authorized-voice-clone','dubbing',
  'text-to-3d','image-to-3d','multi-image-to-3d','texture-3d',
] as const;
export type CapabilityId = typeof CAPABILITY_IDS[number];
export type CapabilityMediaType = 'TEXT'|'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D'|'MASK'|'STRUCTURED_DATA';
export type CapabilityControl = 'aspect_ratio'|'resolution'|'duration'|'seed'|'guidance'|'negative_prompt'|'reference_image'|'first_frame'|'last_frame'|'language'|'voice'|'output_format'|'style'|'instrumental'|'timestamps'|'source_language'|'target_language'|'voice_clone_consent'|'voice_label'|'mesh_mode'|'pbr'|'target_faces'|'topology'|'background_mode'|'variation_strength';

export interface CapabilityDefinition {
  id: CapabilityId;
  inputs: CapabilityMediaType[];
  outputs: CapabilityMediaType[];
  controls: CapabilityControl[];
}

const defs: CapabilityDefinition[] = [
  {id:'text-to-image',inputs:['TEXT'],outputs:['IMAGE'],controls:['aspect_ratio','resolution','seed','guidance','negative_prompt','output_format']},
  {id:'image-to-image',inputs:['TEXT','IMAGE'],outputs:['IMAGE'],controls:['aspect_ratio','resolution','seed','guidance','negative_prompt','reference_image','output_format']},
  {id:'image-edit',inputs:['TEXT','IMAGE'],outputs:['IMAGE'],controls:['aspect_ratio','resolution','reference_image','output_format']},
  {id:'inpaint-mask',inputs:['TEXT','IMAGE','MASK'],outputs:['IMAGE'],controls:['resolution','reference_image','output_format']},
  {id:'background-remove-replace',inputs:['IMAGE'],outputs:['IMAGE'],controls:['resolution','output_format','background_mode']},
  {id:'outpaint',inputs:['TEXT','IMAGE'],outputs:['IMAGE'],controls:['aspect_ratio','resolution','output_format']},
  {id:'upscale',inputs:['IMAGE'],outputs:['IMAGE'],controls:['resolution','output_format']},
  {id:'variations',inputs:['IMAGE'],outputs:['IMAGE'],controls:['reference_image','resolution','output_format','variation_strength']},
  {id:'text-to-video',inputs:['TEXT'],outputs:['VIDEO'],controls:['aspect_ratio','resolution','duration','seed','guidance','negative_prompt','output_format']},
  {id:'image-to-video',inputs:['TEXT','IMAGE'],outputs:['VIDEO'],controls:['aspect_ratio','resolution','duration','seed','negative_prompt','reference_image','output_format']},
  {id:'first-frame',inputs:['TEXT','IMAGE'],outputs:['VIDEO'],controls:['aspect_ratio','resolution','duration','first_frame','output_format']},
  {id:'last-frame',inputs:['TEXT','IMAGE'],outputs:['VIDEO'],controls:['aspect_ratio','resolution','duration','first_frame','last_frame','output_format']},
  {id:'video-extend',inputs:['VIDEO'],outputs:['VIDEO'],controls:['duration','resolution','output_format']},
  {id:'video-edit',inputs:['TEXT','VIDEO'],outputs:['VIDEO'],controls:['duration','resolution','output_format']},
  {id:'text-to-speech',inputs:['TEXT'],outputs:['AUDIO'],controls:['language','voice','output_format','style']},
  {id:'sound-effects',inputs:['TEXT'],outputs:['AUDIO'],controls:['duration','output_format']},
  {id:'music',inputs:['TEXT'],outputs:['AUDIO'],controls:['duration','seed','output_format','instrumental']},
  {id:'transcription',inputs:['AUDIO'],outputs:['TEXT','STRUCTURED_DATA'],controls:['language','output_format','timestamps']},
  {id:'subtitles',inputs:['VIDEO','AUDIO'],outputs:['TEXT','STRUCTURED_DATA'],controls:['language','output_format','timestamps']},
  {id:'authorized-voice-clone',inputs:['AUDIO'],outputs:['STRUCTURED_DATA'],controls:['language','voice_clone_consent','voice_label']},
  {id:'dubbing',inputs:['VIDEO','AUDIO'],outputs:['VIDEO','AUDIO'],controls:['source_language','target_language','output_format']},
  {id:'text-to-3d',inputs:['TEXT'],outputs:['MODEL_3D'],controls:['output_format','mesh_mode','pbr','target_faces','topology']},
  {id:'image-to-3d',inputs:['IMAGE'],outputs:['MODEL_3D'],controls:['reference_image','output_format','mesh_mode','pbr','target_faces','topology']},
  {id:'multi-image-to-3d',inputs:['IMAGE'],outputs:['MODEL_3D'],controls:['reference_image','output_format','mesh_mode','pbr','target_faces','topology']},
  {id:'texture-3d',inputs:['TEXT','MODEL_3D'],outputs:['MODEL_3D'],controls:['output_format']},
];
const byId=new Map<CapabilityId,CapabilityDefinition>(defs.map(def=>[def.id,def]));

export function isCapabilityId(value:string):value is CapabilityId{return byId.has(value as CapabilityId);}
export function getCapabilityDefinition(id:string){return isCapabilityId(id)?byId.get(id)!:null;}

export function capabilityIdsForModel(model:Pick<ModelRegistryItem,'supported_modes'|'supports_start_end_image'|'beta_capability_ids'>):CapabilityId[]{
  const modes=model.supported_modes||[];const out:CapabilityId[]=(model.beta_capability_ids||[]).filter(isCapabilityId);
  if(modes.includes('TEXT_TO_IMAGE'))out.push('text-to-image');
  if(modes.includes('IMAGE_TO_IMAGE'))out.push('image-to-image');
  if(modes.includes('TEXT_TO_VIDEO'))out.push('text-to-video');
  if(modes.includes('IMAGE_TO_VIDEO'))out.push('image-to-video');
  if(model.supports_start_end_image){out.push('first-frame','last-frame');}
  return Array.from(new Set(out));
}

function controlsForModel(model:ModelRegistryItem,id:CapabilityId):CapabilityControl[]{
  const def=getCapabilityDefinition(id);if(!def)return [];
  return def.controls.filter(control=>{
    if(control==='seed')return Boolean(model.supports_seed);
    if(control==='negative_prompt')return Boolean(model.supports_negative_prompt);
    if(control==='reference_image')return Boolean(model.supports_image_reference);
    if(control==='first_frame'||control==='last_frame')return Boolean(model.supports_start_end_image);
    if(control==='duration')return (model.supported_durations||[]).length>0;
    if(control==='resolution')return (model.supported_resolutions||[]).length>0;
    if(control==='aspect_ratio')return (model.supported_aspect_ratios||[]).length>0;
    if(['language','voice','output_format','style','instrumental','timestamps','source_language','target_language','voice_clone_consent','voice_label','mesh_mode','pbr','target_faces','topology','background_mode','variation_strength'].includes(control))return true;
    return control!=='guidance';
  });
}

export function publicCapabilityCatalog(models:ModelRegistryItem[]){
  return models.filter(model=>model.status!=='INACTIVE').map(model=>({
    model_id:model.model_id,name:model.name,category:model.category,
    supported_durations:[...(model.supported_durations||[])],
    supported_resolutions:[...(model.supported_resolutions||[])],
    supported_aspect_ratios:[...(model.supported_aspect_ratios||[])],
    capabilities:capabilityIdsForModel(model).map(id=>{
      const def=getCapabilityDefinition(id)!;
      const controls=controlsForModel(model,id);
      return{
        id,inputs:def.inputs,outputs:def.outputs,controls,
        supported_durations:controls.includes('duration')?[...(model.supported_durations||[])]:[],
        supported_resolutions:controls.includes('resolution')?[...(model.supported_resolutions||[])]:[],
        supported_aspect_ratios:controls.includes('aspect_ratio')?[...(model.supported_aspect_ratios||[])]:[],
      };
    }),
  })).filter(model=>model.capabilities.length>0);
}

export function validateModelCapability(model:ModelRegistryItem|null,id:string,requestedControls:string[]=[]){
  if(!isCapabilityId(id))return{valid:false,code:'UNKNOWN_CAPABILITY',message:'Capability desconhecida.'};
  if(!model||model.status==='INACTIVE')return{valid:false,code:'MODEL_NOT_FOUND',message:'Modelo indisponível.'};
  if(!capabilityIdsForModel(model).includes(id))return{valid:false,code:'CAPABILITY_NOT_SUPPORTED',message:'Capability incompatível com o modelo selecionado.'};
  const allowed=new Set(controlsForModel(model,id));
  const incompatible=requestedControls.filter(control=>!allowed.has(control as CapabilityControl));
  if(incompatible.length)return{valid:false,code:'CAPABILITY_CONTROL_NOT_SUPPORTED',message:`Controle incompatível: ${incompatible[0]}.`};
  return{valid:true as const,code:null,message:null};
}
