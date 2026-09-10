import {GenerationMode} from '../../src/types/index.js';
import {getModelCapabilities} from '../../src/services/modelCapabilities.js';
import {catalogRepository} from '../repositories/catalogRepository.js';

export interface GenerationCapabilityInput{
 model_id:string;
 mode:GenerationMode;
 resolution:string;
 duration_seconds:number;
 aspect_ratio:string;
 number_of_outputs:number;
 audio_enabled?:boolean;
 references?:Array<{asset_id:string;slot_type?:string;role?:string;type?:string;asset?:{type?:string}}>;
}

export async function assertGenerationCapability(input:GenerationCapabilityInput){
 const model=await catalogRepository.getModel(input.model_id);
 if(!model)throw Object.assign(new Error('IA indisponível.'),{code:'MODEL_NOT_AVAILABLE'});
 const caps=getModelCapabilities(model);
 const errors:string[]=[];
 if(!caps.supported_modes.includes(input.mode))errors.push(`${model.name} não suporta este modo de geração.`);
 if(!caps.supported_resolutions.includes(String(input.resolution)))errors.push(`${model.name} não suporta ${input.resolution}.`);
 if(model.category==='VIDEO'&&!caps.supported_durations.includes(Number(input.duration_seconds)))errors.push(`${model.name} não suporta ${input.duration_seconds}s.`);
 if(!caps.supported_aspect_ratios.includes(String(input.aspect_ratio)))errors.push(`${model.name} não suporta proporção ${input.aspect_ratio}.`);
 if(Number(input.number_of_outputs)!==1)errors.push('A geração atual suporta uma saída por vez.');
 const audioMode=caps.audio_generation_mode||(caps.supports_audio_generation?'OPTIONAL':'NONE');
 if(input.audio_enabled===true&&audioMode==='NONE')errors.push(`${model.name} não gera áudio nativo.`);
 if(input.audio_enabled===false&&audioMode==='ALWAYS')errors.push(`${model.name} sempre inclui áudio nativo.`);
 const refs=input.references||[];
 const refType=(ref:any)=>String(ref.type||ref.asset?.type||'IMAGE').toUpperCase();
 const generalRefs=refs.filter((ref)=>!['INITIAL','START_FRAME','INITIAL_FRAME','END','END_FRAME'].includes(String(ref.slot_type||ref.role||'').toUpperCase()));
 const imageRefs=generalRefs.filter((ref)=>refType(ref)==='IMAGE'),videoRefs=generalRefs.filter((ref)=>refType(ref)==='VIDEO'),audioRefs=generalRefs.filter((ref)=>refType(ref)==='AUDIO');
 if(imageRefs.length&&!caps.supports_image_reference)errors.push(`${model.name} não aceita imagens de referência neste fluxo.`);
 if(videoRefs.length&&!caps.supports_video_reference)errors.push(`${model.name} não aceita vídeos de referência.`);
 if(audioRefs.length&&!caps.supports_audio_reference)errors.push(`${model.name} não aceita áudios de referência.`);
 if(imageRefs.length>caps.max_reference_images)errors.push(`${model.name} aceita no máximo ${caps.max_reference_images} imagens de referência.`);
 if(videoRefs.length>caps.max_reference_videos)errors.push(`${model.name} aceita no máximo ${caps.max_reference_videos} vídeos de referência.`);
 if(audioRefs.length>caps.max_reference_audio)errors.push(`${model.name} aceita no máximo ${caps.max_reference_audio} áudios de referência.`);
 if(input.mode==='REFERENCE_TO_VIDEO'&&generalRefs.length&&!generalRefs.some((ref)=>['IMAGE','VIDEO'].includes(refType(ref))))errors.push('Áudio de referência precisa de uma imagem ou vídeo de referência.');
 const hasEnd=refs.some((ref)=>['END','END_FRAME'].includes(String(ref.slot_type||ref.role||'').toUpperCase()));
 if(hasEnd&&!caps.supports_start_end_image)errors.push(`${model.name} não suporta quadro final.`);
 if(input.mode==='IMAGE_TO_VIDEO'&&!refs.some((ref)=>['INITIAL','START_FRAME','INITIAL_FRAME'].includes(String(ref.slot_type||ref.role||'').toUpperCase()))){
  errors.push('Imagem inicial obrigatória para image-to-video.');
 }
 if(input.mode==='REFERENCE_TO_VIDEO'&&!refs.length)errors.push('Adicione ao menos uma referência para este modo.');
 if(errors.length){
  const error:any=new Error(errors[0]);
  error.code='MODEL_CONFIGURATION_UNSUPPORTED';
  error.details=errors;
  throw error;
 }
 return{model,capabilities:caps};
}
