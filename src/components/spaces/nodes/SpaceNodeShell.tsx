import React from'react';
import{Copy,GitBranch,Image as ImageIcon,SlidersHorizontal,Trash2,Video}from'lucide-react';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import{SPACE_BASE_NODE_H,spaceNodeWidth}from'../canvas/spaceLayout.js';

interface Props{
 node:FlowNode;selected:boolean;nodeRun?:FlowNodeRunView;outputTypes:string[];subtitle:string;children:React.ReactNode;
 onPointerDown:(event:React.PointerEvent<HTMLDivElement>)=>void;
 onInputPointerUp?:(event:React.PointerEvent<HTMLButtonElement>)=>void;
 onOutputPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>void;
 onLabelChange:(value:string)=>void;onDuplicate:()=>void;onDelete:()=>void;onRunFromHere?:()=>void;onInspect?:()=>void;
}

const GENERATORS=new Set(['text-to-image','image-to-image','text-to-video','image-to-video']);

export const SpaceNodeShell:React.FC<Props>=({node,selected,nodeRun,outputTypes,subtitle,children,onPointerDown,onInputPointerUp,onOutputPointerDown,onLabelChange,onDuplicate,onDelete,onRunFromHere,onInspect})=>{
 const generator=node.kind==='TOOL'&&Boolean(node.capability_id&&GENERATORS.has(node.capability_id));
 const visual=generator||node.kind==='ASSET';
 const status=nodeRun?.status;
 const actionButtons=<div className="flex items-center gap-0.5">{node.kind==='TOOL'&&onInspect&&<button onClick={onInspect} title="Abrir Inspector" aria-label="Abrir Inspector" className="grid h-6 w-6 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"><SlidersHorizontal className="h-3 w-3"/></button>}{node.kind==='TOOL'&&onRunFromHere&&<button onClick={onRunFromHere} title="Executar daqui para frente" aria-label="Executar daqui para frente" className="grid h-6 w-6 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-cyan-200"><GitBranch className="h-3 w-3"/></button>}<button onClick={onDuplicate} aria-label="Duplicar node" className="grid h-6 w-6 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"><Copy className="h-3 w-3"/></button><button onClick={onDelete} aria-label="Excluir node" className="grid h-6 w-6 place-items-center rounded-full text-white/40 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-3 w-3"/></button></div>;
 return <div data-space-node={node.node_id} className={`group absolute overflow-hidden rounded-[16px] bg-[#071018] shadow-[0_14px_38px_rgba(0,0,0,.24)] transition-all duration-150 ${selected?'ring-1 ring-cyan-300/45 shadow-[0_18px_44px_rgba(34,211,238,.07)]':'ring-1 ring-white/[0.04] hover:ring-white/[0.10] hover:shadow-[0_18px_46px_rgba(0,0,0,.30)]'}`} style={{left:node.x,top:node.y,width:spaceNodeWidth(node),minHeight:SPACE_BASE_NODE_H}} onPointerDown={onPointerDown}>
  {node.kind==='TOOL'&&<button onPointerUp={onInputPointerUp} className="absolute -left-1 top-1/2 z-30 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#050a10] bg-zinc-600 transition group-hover:bg-zinc-400" title="Entrada" aria-label="Entrada do node"/>}
  <button onPointerDown={onOutputPointerDown} className="absolute -right-1 top-1/2 z-30 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#050a10] bg-cyan-300/85 shadow-[0_0_8px_rgba(103,232,249,.24)] transition group-hover:bg-cyan-200" title="Arraste para conectar" aria-label="Saída do node; arraste para conectar"/>
  {visual?<div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-2.5 pb-8 pt-2">
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-black/30 text-cyan-200 backdrop-blur">{outputTypes.includes('VIDEO')?<Video className="h-3 w-3"/>:<ImageIcon className="h-3 w-3"/>}</span>
    <div className="pointer-events-auto min-w-0 flex-1"><input value={node.label} onChange={e=>onLabelChange(e.target.value)} aria-label="Nome do node" className="w-full truncate bg-transparent text-[8px] font-bold text-white/90 outline-none"/><span className="block truncate text-[6px] uppercase tracking-[.12em] text-white/35">{subtitle}</span></div>
    {status&&<span className={`h-1.5 w-1.5 rounded-full ${status==='SUCCEEDED'?'bg-emerald-300':status==='FAILED'?'bg-rose-300':status==='RUNNING'?'animate-pulse bg-cyan-200':'bg-white/30'}`}/>}
    <div className="pointer-events-auto">{actionButtons}</div>
  </div>:<>
    <div className="flex items-start gap-2 px-2.5 pb-2 pt-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-300/[0.06] text-cyan-200">{outputTypes.includes('VIDEO')?<Video className="h-3.5 w-3.5"/>:<ImageIcon className="h-3.5 w-3.5"/>}</span><div className="min-w-0 flex-1"><input value={node.label} onChange={e=>onLabelChange(e.target.value)} aria-label="Nome do node" className="w-full truncate bg-transparent text-[9px] font-bold text-white outline-none"/><span className="block truncate text-[6px] uppercase tracking-[.12em] text-zinc-600">{subtitle}</span></div>{status&&<span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${status==='SUCCEEDED'?'bg-emerald-400':status==='FAILED'?'bg-rose-400':status==='RUNNING'?'animate-pulse bg-cyan-300':'bg-zinc-600'}`}/>}</div>
  </>}
  {children}
  {!visual&&<div className="flex items-center justify-between px-2 py-1.5"><span className="text-[6px] text-zinc-700">{node.kind==='TOOL'?'Saída: '+outputTypes.join(', '):node.media_type}</span>{actionButtons}</div>}
 </div>;
};

export default SpaceNodeShell;