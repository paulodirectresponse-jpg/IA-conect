import React,{useMemo}from'react';
import{ModelRegistryItem}from'../../types/index.js';
import{CompactModelPicker}from'./CompactModelPicker.js';

export interface StableGeneratorModelOption{model_id:string;name:string;description?:string;supported_durations?:number[];}
interface Props{models:StableGeneratorModelOption[];selectedModelId:string;onSelect:(modelId:string)=>void;loading?:boolean;accentClass?:string;}

const now='1970-01-01T00:00:00.000Z';
export const StableGeneratorModelPicker:React.FC<Props>=({models,selectedModelId,onSelect,loading=false})=>{
 const adapted=useMemo<ModelRegistryItem[]>(()=>models.map(model=>({
  model_id:model.model_id,
  name:model.name,
  slug:model.model_id,
  category:'OTHER',
  description:model.description||'Modelo disponível',
  status:'ACTIVE',
  best_for:model.description||'Modelo específico',
  supported_durations:model.supported_durations||[],
  supported_resolutions:[],
  supported_aspect_ratios:[],
  supported_modes:[],
  supports_image_reference:false,
  supports_multiple_images:false,
  supports_video_reference:false,
  supports_audio_reference:false,
  supports_negative_prompt:false,
  supports_seed:false,
  max_reference_images:0,
  max_reference_videos:0,
  max_reference_audio:0,
  max_prompt_length:4000,
  created_at:now,
  updated_at:now,
 })),[models]);
 const manualId=selectedModelId==='AUTO'?(adapted[0]?.model_id||''):selectedModelId;
 return <div className={loading?'pointer-events-none opacity-60':''} aria-busy={loading||undefined}>
  <CompactModelPicker
   models={adapted}
   selectionMode={selectedModelId==='AUTO'?'AUTO':'MANUAL'}
   selectedModelId={manualId}
   autoResolvedModel={null}
   onSelectAuto={()=>onSelect('AUTO')}
   onSelectModel={model=>onSelect(model.model_id)}
   favoriteModelIds={[]}
   recentModelIds={[]}
   onToggleFavorite={()=>{}}
  />
 </div>;
};

export default StableGeneratorModelPicker;
