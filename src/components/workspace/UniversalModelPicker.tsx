import React,{useEffect,useState}from'react';
import type{ModelRegistryItem}from'../../types/index.js';
import{workspaceService}from'../../services/workspaceService.js';
import{CompactModelPicker}from'./CompactModelPicker.js';

interface Props{
 models:ModelRegistryItem[];
 selectedModelId:string;
 onSelect:(modelId:string)=>void;
 loading?:boolean;
 unitPricesByModelId?:Record<string,number|null>;
 priceLoadingModelIds?:string[];
 autoResolvedModel?:ModelRegistryItem|null;
 selectedCoverUrl?:string|null;
 selectedCoverSources?:{avif:string;webp:string;png:string}|null;
 favoriteModelIds?:string[];
 recentModelIds?:string[];
 onToggleFavorite?:(modelId:string)=>void;
}

export const UniversalModelPicker:React.FC<Props>=({
 models,selectedModelId,onSelect,loading=false,unitPricesByModelId,priceLoadingModelIds,
 autoResolvedModel,selectedCoverUrl,selectedCoverSources,
 favoriteModelIds,recentModelIds,onToggleFavorite,
})=>{
 const[internalFavorites,setInternalFavorites]=useState<string[]>([]),
  [internalRecent,setInternalRecent]=useState<string[]>([]);
 const controlledPreferences=Array.isArray(favoriteModelIds)&&Array.isArray(recentModelIds);
 useEffect(()=>{
  if(controlledPreferences)return;
  void workspaceService.getUserPreferences().then(p=>{
   setInternalFavorites(p.favorite_model_ids||[]);
   setInternalRecent(p.recent_model_ids||[]);
  }).catch(()=>{});
 },[controlledPreferences]);
 const favorites=controlledPreferences?favoriteModelIds!:internalFavorites,
  recent=controlledPreferences?recentModelIds!:internalRecent;
 const select=(id:string)=>{
  onSelect(id);
  if(id!=='AUTO'&&!controlledPreferences)
   void workspaceService.trackRecentModel(id).then(p=>setInternalRecent(p.recent_model_ids||[])).catch(()=>{});
 };
 const toggle=(id:string)=>{
  if(onToggleFavorite)return onToggleFavorite(id);
  void workspaceService.toggleFavoriteModel(id).then(p=>setInternalFavorites(p.favorite_model_ids||[])).catch(()=>{});
 };
 return <div className={loading?'pointer-events-none opacity-60':''} aria-busy={loading||undefined}>
  <CompactModelPicker
   models={models}
   selectionMode={selectedModelId==='AUTO'?'AUTO':'MANUAL'}
   selectedModelId={selectedModelId==='AUTO'?(autoResolvedModel?.model_id||models[0]?.model_id||''):selectedModelId}
   autoResolvedModel={autoResolvedModel}
   onSelectAuto={()=>select('AUTO')}
   showAuto={models.length>0}
   onSelectModel={model=>select(model.model_id)}
   favoriteModelIds={favorites}
   recentModelIds={recent}
   onToggleFavorite={toggle}
   unitPricesByModelId={unitPricesByModelId}
   priceLoadingModelIds={priceLoadingModelIds}
   selectedCoverUrl={selectedCoverUrl}
   selectedCoverSources={selectedCoverSources}
  />
 </div>;
};

export default UniversalModelPicker;
