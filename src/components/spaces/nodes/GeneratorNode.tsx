import React from'react';
import{Play,SlidersHorizontal}from'lucide-react';
import type{BetaCapability,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';

type ControlValue=string|number|boolean|null;
interface Props{
 node:FlowNode;capability:BetaCapability|null;models:BetaCapabilityModel[];nodeRun?:FlowNodeRunView;
 preview:React.ReactNode;busy:boolean;mediaLabel:'imagem'|'vídeo';
 onPatch:(patch:Partial<FlowNode>)=>void;onGenerate:()=>void;
}

const value=(node:FlowNode,key:string,fallback:string|number)=>node.controls?.[key]??fallback;
const options=(values:(string|number)[])=>Array.from(new Set(values.filter(v=>v!==''&&v!=null)));

export const GeneratorNode:React.FC<Props>=({node,capability,models,nodeRun,preview,busy,mediaLabel,onPatch,onGenerate})=>{
 const manualModels=models.filter(m=>m.model_id!=='AUTO'&&m.capabilities.some(c=>c.id===node.capability_id));
 const selectedModel=models.find(m=>m.model_id===node.model_id);
 const selectedCapability=selectedModel?.capabilities.find(c=>c.id===node.capability_id)||capability;
 const controls=new Set(selectedCapability?.controls||capability?.controls||[]);
 const aspectRatios=options(selectedCapability?.supported_aspect_ratios||selectedModel?.supported_aspect_ratios||[]);
 const resolutions=options(selectedCapability?.supported_resolutions||selectedModel?.supported_resolutions||[]);
 const durations=options(selectedCapability?.supported_durations||selectedModel?.supported_durations||[]);
 const patchControl=(key:string,next:ControlValue)=>onPatch({controls:{...(node.controls||{}),[key]:next}});
 const price=nodeRun?.authorized_credit_price;
 return <div className="space-y-3 p-3">
  <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/25">
   {preview||<div className="grid aspect-[4/3] min-h-[150px] place-items-center px-6 text-center"><div><strong className="block text-[10px] font-semibold text-zinc-500">Seu resultado aparecerá aqui</strong><span className="mt-1 block text-[8px] leading-relaxed text-zinc-700">Configure e gere sem sair deste card.</span></div></div>}
  </div>
  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.12em] text-zinc-600">Prompt</label><textarea rows={3} value={node.prompt||''} onChange={e=>onPatch({prompt:e.target.value})} placeholder={mediaLabel==='imagem'?'Descreva a imagem que deseja criar…':'Descreva o vídeo, movimento e cena…'} className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-300/25"/></div>
  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.12em] text-zinc-600">Modelo</label><select value={node.model_id||'AUTO'} onChange={e=>onPatch({model_id:e.target.value,controls:{}})} className="h-9 w-full rounded-xl border border-white/[0.07] bg-[#071018] px-3 text-[9px] font-semibold text-zinc-300 outline-none focus:border-cyan-300/25"><option value="AUTO">Auto · IA Conect escolhe por você</option>{manualModels.map(m=><option key={m.model_id} value={m.model_id}>{m.name}</option>)}</select></div>
  {(controls.has('aspect_ratio')||controls.has('resolution')||controls.has('duration'))&&<div className="grid grid-cols-2 gap-2">
   {controls.has('aspect_ratio')&&aspectRatios.length>0&&<label className="block"><span className="mb-1 block text-[7px] uppercase tracking-[.1em] text-zinc-700">Formato</span><select value={String(value(node,'aspect_ratio',aspectRatios[0]))} onChange={e=>patchControl('aspect_ratio',e.target.value)} className="h-8 w-full rounded-lg border border-white/[0.06] bg-[#071018] px-2 text-[8px] text-zinc-400 outline-none">{aspectRatios.map(v=><option key={String(v)} value={String(v)}>{v}</option>)}</select></label>}
   {controls.has('resolution')&&resolutions.length>0&&<label className="block"><span className="mb-1 block text-[7px] uppercase tracking-[.1em] text-zinc-700">Resolução</span><select value={String(value(node,'resolution',resolutions[0]))} onChange={e=>patchControl('resolution',e.target.value)} className="h-8 w-full rounded-lg border border-white/[0.06] bg-[#071018] px-2 text-[8px] text-zinc-400 outline-none">{resolutions.map(v=><option key={String(v)} value={String(v)}>{v}</option>)}</select></label>}
   {controls.has('duration')&&durations.length>0&&<label className="block"><span className="mb-1 block text-[7px] uppercase tracking-[.1em] text-zinc-700">Duração</span><select value={String(value(node,'duration',durations[0]))} onChange={e=>patchControl('duration',Number(e.target.value))} className="h-8 w-full rounded-lg border border-white/[0.06] bg-[#071018] px-2 text-[8px] text-zinc-400 outline-none">{durations.map(v=><option key={String(v)} value={String(v)}>{v}s</option>)}</select></label>}
  </div>}
  <div className="flex items-end justify-between gap-3 border-t border-white/[0.05] pt-2.5"><div className="min-w-0"><span className="flex items-center gap-1 text-[7px] uppercase tracking-[.1em] text-zinc-700"><SlidersHorizontal className="h-2.5 w-2.5"/>Custo</span><strong className="mt-0.5 block text-[9px] text-zinc-400">{price&&price>0?String(price)+' créditos':'Calculado ao executar'}</strong></div><button type="button" onClick={onGenerate} disabled={busy||!capability||!(node.prompt||'').trim()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-cyan-300 px-4 text-[9px] font-black text-[#031018] shadow-[0_8px_30px_rgba(103,232,249,.12)] disabled:cursor-not-allowed disabled:opacity-35"><Play className="h-3.5 w-3.5"/>{busy?'Gerando…':'Gerar'}</button></div>
 </div>;
};

export default GeneratorNode;