import {Asset,GenerationMode,ModelRegistryItem,WorkspaceReference} from '../types/index.js';
import {getModelCapabilities} from './modelCapabilities.js';

export interface ConfigurationChange{field:string;from?:string;to?:string;message:string;}
export interface VideoConfigurationInput{
 resolution:string;
 durationSeconds:number;
 aspectRatio:string;
 initialImage:Asset|null;
 endImage:Asset|null;
 references:WorkspaceReference[];
 audioEnabled?:boolean;
 seed:number|'';
 motionStrength:number;
}
export interface VideoConfigurationPlan{
 valid:boolean;
 blockedReason?:string;
 mode:GenerationMode;
 resolution:string;
 durationSeconds:number;
 aspectRatio:string;
 initialImage:Asset|null;
 endImage:Asset|null;
 references:WorkspaceReference[];
 audioEnabled:boolean;
 seed:number|'';
 motionStrength:number;
 changes:ConfigurationChange[];
}
export interface ImageConfigurationInput{
 resolution:string;
 aspectRatio:string;
 references:WorkspaceReference[];
 seed:number|'';
}
export interface ImageConfigurationPlan{
 valid:boolean;
 blockedReason?:string;
 mode:GenerationMode;
 resolution:string;
 aspectRatio:string;
 references:WorkspaceReference[];
 seed:number|'';
 changes:ConfigurationChange[];
}

const resolutionRank=(value:string)=>{
 const normalized=String(value||'').trim().toUpperCase();
 if(normalized==='STANDARD')return 720;
 const match=normalized.match(/^([\d.]+)(P|K)$/);
 if(!match)return 0;
 const n=Number(match[1]);
 return match[2]==='K'?n*1024:n;
};
const nearestNumber=(current:number,values:number[])=>{
 const sorted=[...new Set(values.map(Number).filter((v)=>Number.isFinite(v)&&v>0))].sort((a,b)=>a-b);
 if(!sorted.length)return current;
 if(sorted.includes(current))return current;
 return [...sorted].sort((a,b)=>Math.abs(a-current)-Math.abs(b-current)||b-a)[0];
};
const nearestResolution=(current:string,values:string[])=>{
 const clean=[...new Set((values||[]).filter(Boolean))];
 if(!clean.length)return current;
 if(clean.includes(current))return current;
 const rank=resolutionRank(current);
 if(!rank)return clean[0];
 return [...clean].sort((a,b)=>Math.abs(resolutionRank(a)-rank)-Math.abs(resolutionRank(b)-rank)||resolutionRank(b)-resolutionRank(a))[0];
};
const nearestRatio=(current:string,values:string[],recommended?:string)=>{
 const clean=[...new Set((values||[]).filter(Boolean))];
 if(!clean.length)return current;
 if(clean.includes(current))return current;
 if(recommended&&clean.includes(recommended))return recommended;
 if(clean.includes('16:9'))return'16:9';
 if(clean.includes('1:1'))return'1:1';
 return clean[0];
};
const frameRole=(role?:string)=>['START_FRAME','INITIAL_FRAME','INITIAL','END_FRAME','END'].includes(String(role||'').toUpperCase());
const typeOf=(ref:WorkspaceReference)=>ref.asset?.type||'IMAGE';
const supportedReference=(ref:WorkspaceReference,caps:ReturnType<typeof getModelCapabilities>)=>{
 const type=typeOf(ref);
 if(type==='VIDEO')return Boolean(caps.supports_video_reference);
 if(type==='AUDIO')return Boolean(caps.supports_audio_reference);
 return Boolean(caps.supports_image_reference);
};
const capReferences=(refs:WorkspaceReference[],caps:ReturnType<typeof getModelCapabilities>)=>{
 let image=0,video=0,audio=0;
 const kept:WorkspaceReference[]=[];
 for(const ref of refs){
  if(!supportedReference(ref,caps))continue;
  const type=typeOf(ref);
  if(type==='IMAGE'){if(image>=caps.max_reference_images)continue;image++;}
  if(type==='VIDEO'){if(video>=caps.max_reference_videos)continue;video++;}
  if(type==='AUDIO'){if(audio>=caps.max_reference_audio)continue;audio++;}
  kept.push(ref);
 }
 return kept;
};
const change=(changes:ConfigurationChange[],field:string,from:any,to:any,message:string)=>{
 if(String(from)===String(to))return;
 changes.push({field,from:String(from??''),to:String(to??''),message});
};

export function planVideoConfiguration(model:ModelRegistryItem,input:VideoConfigurationInput):VideoConfigurationPlan{
 const caps=getModelCapabilities(model),changes:ConfigurationChange[]=[];
 let initial=input.initialImage,end=input.endImage,refs=input.references.filter((r)=>!frameRole(r.role));
 let mode:GenerationMode='TEXT_TO_VIDEO';

 const filtered=capReferences(refs,caps);
 if(filtered.length!==refs.length)change(changes,'references',refs.length,filtered.length,'Referências incompatíveis foram retiradas desta geração.');
 refs=filtered;

 if(initial&&!caps.supported_modes.includes('IMAGE_TO_VIDEO')){
  change(changes,'initialImage',initial.name,'','A imagem inicial foi retirada porque esta IA não aceita image-to-video.');
  initial=null;end=null;
 }
 if(end&&!caps.supports_start_end_image){
  change(changes,'endImage',end.name,'','A imagem final foi retirada porque esta IA aceita apenas o quadro inicial.');
  end=null;
 }

 if(initial){
  if(refs.length){
   change(changes,'references',refs.length,0,'Referências extras foram pausadas porque esta rota usa quadro inicial/final.');
   refs=[];
  }
  mode='IMAGE_TO_VIDEO';
 }else if(refs.length){
  if(caps.supported_modes.includes('REFERENCE_TO_VIDEO')){
   mode='REFERENCE_TO_VIDEO';
  }else{
   const imageRef=refs.find((ref)=>typeOf(ref)==='IMAGE'&&ref.asset);
   if(imageRef&&caps.supported_modes.includes('IMAGE_TO_VIDEO')){
    initial=imageRef.asset||null;
    change(changes,'mode','REFERENCES','INITIAL_FRAME','A primeira imagem foi usada como quadro inicial para esta IA.');
    if(refs.length>1)change(changes,'references',refs.length,0,'As demais referências foram pausadas para usar esta IA.');
    refs=[];
    mode='IMAGE_TO_VIDEO';
   }else if(caps.supported_modes.includes('TEXT_TO_VIDEO')){
    change(changes,'references',refs.length,0,'Esta IA não usa essas referências; elas foram retiradas desta geração.');
    refs=[];
    mode='TEXT_TO_VIDEO';
   }else{
    return{valid:false,blockedReason:'Esta IA não consegue executar os inputs atuais.',mode:'TEXT_TO_VIDEO',resolution:input.resolution,durationSeconds:input.durationSeconds,aspectRatio:input.aspectRatio,initialImage:initial,endImage:end,references:refs,audioEnabled:false,seed:input.seed,motionStrength:input.motionStrength,changes};
   }
  }
 }else if(caps.supported_modes.includes('TEXT_TO_VIDEO')){
  mode='TEXT_TO_VIDEO';
 }else if(caps.supported_modes.includes('IMAGE_TO_VIDEO')){
  return{valid:false,blockedReason:'Esta IA precisa de uma imagem inicial.',mode:'IMAGE_TO_VIDEO',resolution:input.resolution,durationSeconds:input.durationSeconds,aspectRatio:input.aspectRatio,initialImage:null,endImage:null,references:[],audioEnabled:false,seed:input.seed,motionStrength:input.motionStrength,changes};
 }else{
  return{valid:false,blockedReason:'Nenhum modo de vídeo compatível.',mode:'TEXT_TO_VIDEO',resolution:input.resolution,durationSeconds:input.durationSeconds,aspectRatio:input.aspectRatio,initialImage:null,endImage:null,references:[],audioEnabled:false,seed:input.seed,motionStrength:input.motionStrength,changes};
 }

 const resolution=nearestResolution(input.resolution,caps.supported_resolutions);
 const durationSeconds=nearestNumber(input.durationSeconds,caps.supported_durations);
 const aspectRatio=nearestRatio(input.aspectRatio,caps.supported_aspect_ratios,model.recommended_aspect_ratio);
 change(changes,'resolution',input.resolution,resolution,`Resolução ajustada para ${resolution}.`);
 change(changes,'duration',input.durationSeconds,durationSeconds,`Duração ajustada para ${durationSeconds}s.`);
 change(changes,'aspectRatio',input.aspectRatio,aspectRatio,`Proporção ajustada para ${aspectRatio}.`);

 const audioEnabled=Boolean(caps.supports_audio_generation&&(input.audioEnabled??caps.default_audio_enabled??true));
 if(Boolean(input.audioEnabled)&&!audioEnabled)change(changes,'audio','on','off','Áudio nativo desativado porque esta IA não oferece essa saída.');
 const seed=caps.supports_seed?input.seed:'';
 if(input.seed!==''&&seed==='')change(changes,'seed',input.seed,'','Seed removida porque esta IA não suporta seed.');
 const motionStrength=caps.supports_motion_strength?input.motionStrength:5;

 return{valid:true,mode,resolution,durationSeconds,aspectRatio,initialImage:initial,endImage:end,references:refs,audioEnabled,seed,motionStrength,changes};
}

export function planImageConfiguration(model:ModelRegistryItem,input:ImageConfigurationInput):ImageConfigurationPlan{
 const caps=getModelCapabilities(model),changes:ConfigurationChange[]=[];
 let refs=capReferences(input.references,caps).filter((ref)=>typeOf(ref)==='IMAGE');
 if(refs.length!==input.references.length)change(changes,'references',input.references.length,refs.length,'Referências incompatíveis foram retiradas desta geração.');
 const mode:GenerationMode=refs.length?'IMAGE_TO_IMAGE':'TEXT_TO_IMAGE';
 if(!caps.supported_modes.includes(mode)){
  if(mode==='IMAGE_TO_IMAGE'&&caps.supported_modes.includes('TEXT_TO_IMAGE')){
   change(changes,'references',refs.length,0,'Esta IA não edita referências; elas foram retiradas desta geração.');
   refs=[];
  }else return{valid:false,blockedReason:'Esta IA não suporta esta forma de geração.',mode,resolution:input.resolution,aspectRatio:input.aspectRatio,references:refs,seed:input.seed,changes};
 }
 const finalMode:GenerationMode=refs.length?'IMAGE_TO_IMAGE':'TEXT_TO_IMAGE';
 const resolution=nearestResolution(input.resolution,caps.supported_resolutions);
 const aspectRatio=nearestRatio(input.aspectRatio,caps.supported_aspect_ratios,model.recommended_aspect_ratio);
 change(changes,'resolution',input.resolution,resolution,`Resolução ajustada para ${resolution}.`);
 change(changes,'aspectRatio',input.aspectRatio,aspectRatio,`Proporção ajustada para ${aspectRatio}.`);
 const seed=caps.supports_seed?input.seed:'';
 if(input.seed!==''&&seed==='')change(changes,'seed',input.seed,'','Seed removida porque esta IA não suporta seed.');
 return{valid:true,mode:finalMode,resolution,aspectRatio,references:refs,seed,changes};
}

export function adaptationSummary(changes:ConfigurationChange[]):string{
 if(!changes.length)return'Configuração atual compatível';
 const important=changes.filter((item)=>['resolution','duration','aspectRatio','audio','mode','references','endImage'].includes(item.field)).slice(0,3);
 return important.length?important.map((item)=>item.to?item.to:item.message).join(' · '):'Ajustes automáticos ao selecionar';
}
