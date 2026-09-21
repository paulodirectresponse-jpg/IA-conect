import React,{useEffect,useState}from'react';
import type{ModelRegistryItem}from'../../types/index.js';
import{workspaceService}from'../../services/workspaceService.js';
import{CompactModelPicker}from'./CompactModelPicker.js';

interface Props{models:ModelRegistryItem[];selectedModelId:string;onSelect:(modelId:string)=>void;loading?:boolean;unitPricesByModelId?:Record<string,number|null>;}

export const UniversalModelPicker:React.FC<Props>=({models,selectedModelId,onSelect,loading=false,unitPricesByModelId})=>{
 const[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]);
 useEffect(()=>{void workspaceService.getUserPreferences().then(p=>{setFavorites(p.favorite_model_ids||[]);setRecent(p.recent_model_ids||[])}).catch(()=>{})},[]);
 const select=(id:string)=>{onSelect(id);if(id!=='AUTO')void workspaceService.trackRecentModel(id).then(p=>setRecent(p.recent_model_ids||[])).catch(()=>{})};
 const toggle=(id:string)=>void workspaceService.toggleFavoriteModel(id).then(p=>setFavorites(p.favorite_model_ids||[])).catch(()=>{});
 return <div className={loading?'pointer-events-none opacity-60':''} aria-busy={loading||undefined}><CompactModelPicker models={models} selectionMode={selectedModelId==='AUTO'?'AUTO':'MANUAL'} selectedModelId={selectedModelId==='AUTO'?(models[0]?.model_id||''):selectedModelId} autoResolvedModel={null} onSelectAuto={()=>select('AUTO')} showAuto={models.length>0} onSelectModel={model=>select(model.model_id)} favoriteModelIds={favorites} recentModelIds={recent} onToggleFavorite={toggle} unitPricesByModelId={unitPricesByModelId}/></div>;
};

export default UniversalModelPicker;
