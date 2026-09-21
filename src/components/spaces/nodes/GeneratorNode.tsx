import React from'react';
import{Play,SlidersHorizontal}from'lucide-react';
import type{BetaCapability,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import{NodeResultPreview,type NodeOutputHistoryItem}from'./NodeResultPreview.js';

type ControlValue=string|number|boolean|null;
interface Props{
 node:FlowNode;capability:BetaCapability|null;models:BetaCapabilityModel[];nodeRun?:FlowNodeRunView;
 history:NodeOutputHistoryItem[];historyIndex:number;busy:boolean;mediaLabel:'imagem'|'vídeo';
 onHistoryIndexChange:(index:number)=>void;onPatch:(patch:Partial<FlowNode>)=>void;onGenerate:()=>void;
}

const value=(node:FlowNode,key:string,fallback:string|number)=>node.controls?.[key]??fallback;
const options=(values:(string|number)[])=>Array.from(new Set(values.filter(v=>v!==''&&v!=null)));

export const GeneratorNode:React.FC<Props>=({node,capability,models,nodeRun,history,historyIndex,busy,mediaLabel,onHistoryIndexChange,onPatch,onGenerate})=>{
 const manualModels=models.filter(m=>m.model_id!=='AUTO'&&m.capabilities.some(c=>c.id===node.capability_id));
 const selectedModel=models.find(m=>m.model_id===node.model_id);
 const selectedCapability=selectedModel?.capabilities.find(c=>c.id===node.capability_id)||capability;
 const controls=new Set(selectedCapability?.controls||capability?.controls||[]);
 const aspectRatios=options(selectedCapability?.supported_aspect_ratios||selectedModel?.supported_aspect_ratios||[]);
 const resolutions=options(selectedCapability?.supported_resolutions||selectedModel?.supported_resolutions||[]);
 const durations=options(selectedCapability?.supported_durations||selectedModel?.supported_durations||[]);
 const patchControl=(key:string,next:ControlValue)=>onPatch({controls:{...(node.controls||{}),[key]:next}});
 const selectedHistory=history[Math.max(0,Math.min(historyIndex,Math.max(0,history.length-1)))];
 const price=selectedHistory?.authorized_credit_price||nodeRun?.authorized_credit_price;
 return <div className="relative h-[390px] overflow-hidden">
  <NodeResultPreview items={history} index={historyIndex} onIndexChange={onHistoryIndexChange} fullBleed/>
  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-40% to-[#03070c]/95"/>
  <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-2.5 pt-16">
   <textarea rows={2} value={node.prompt||''} onChange={e=>onPatch({prompt:e.target.value})} placeholder={mediaLabel==='imagem'?'Descreva a imagem que deseja criar…':'Descreva o vídeo, movimento e cena…'} className="max-h-[66px] min-h-[48px] w-full resize-none rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-[9px] leading-relaxed text-white outline-none backdrop-blur-md placeholder:text-white/35 focus:border-cyan-300/30"/>
   <div className="flex items-center gap-1.5">
    <select value={node.model_id||'AUTO'} onChange={e=>onPatch({model_id:e.target.value,controls:{}})} className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-[8px] font-semibold text-white/75 outline-none backdrop-blur-md"><option value="AUTO">Auto</option>{manualModels.map(m=><option key={m.model_id} value={m.model_id}>{m.name}</option>)}</select>
    {controls.has('aspect_ratio')&&aspectRatios.length>0&&<select aria-label="Formato" value={String(value(node,'aspect_ratio',aspectRatios[0]))} onChange={e=>patchControl('aspect_ratio',e.target.value)} className="h-8 max-w-[66px] rounded-lg border border-white/10 bg-black/40 px-1.5 text-[8px] text-white/70 outline-none backdrop-blur-md">{aspectRatios.map(v=><option key={String(v)} value={String(v)}>{v}</option>)}</select>}
    {controls.has('duration')&&durations.length>0&&<select aria-label="Duração" value={String(value(node,'duration',durations[0]))} onChange={e=>patchControl('duration',Number(e.target.value))} className="h-8 max-w-[58px] rounded-lg border border-white/10 bg-black/40 px-1.5 text-[8px] text-white/70 outline-none backdrop-blur-md">{durations.map(v=><option key={String(v)} value={String(v)}>{v}s</option>)}</select>}
   </div>
   <div className="flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-1 text-[7px] text-white/45"><SlidersHorizontal className="h-2.5 w-2.5"/><span className="truncate">{price&&price>0?String(price)+' créditos':'Custo ao executar'}</span>{controls.has('resolution')&&resolutions.length>0&&<select aria-label="Resolução" value={String(value(node,'resolution',resolutions[0]))} onChange={e=>patchControl('resolution',e.target.value)} className="h-6 max-w-[64px] rounded-md border border-white/10 bg-black/35 px-1 text-[7px] text-white/55 outline-none"><option value={String(value(node,'resolution',resolutions[0]))}>{String(value(node,'resolution',resolutions[0]))}</option>{resolutions.filter(v=>String(v)!==String(value(node,'resolution',resolutions[0]))).map(v=><option key={String(v)} value={String(v)}>{v}</option>)}</select>}</div>
    <button type="button" onClick={onGenerate} disabled={busy||!capability||!(node.prompt||'').trim()} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/90 px-3 text-[8px] font-black text-[#071018] shadow-lg disabled:cursor-not-allowed disabled:opacity-35"><Play className="h-3 w-3"/>{busy?'Gerando…':'Gerar'}</button>
   </div>
  </div>
 </div>;
};

export default GeneratorNode;