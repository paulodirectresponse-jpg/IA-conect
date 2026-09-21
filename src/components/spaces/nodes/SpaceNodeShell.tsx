import React from'react';
import{Copy,Image as ImageIcon,Trash2,Video}from'lucide-react';
import type{FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import{SPACE_BASE_NODE_H,SPACE_NODE_W}from'../canvas/spaceLayout.js';

interface Props{
 node:FlowNode;selected:boolean;nodeRun?:FlowNodeRunView;outputTypes:string[];subtitle:string;children:React.ReactNode;
 onPointerDown:(event:React.PointerEvent<HTMLDivElement>)=>void;
 onInputPointerUp?:(event:React.PointerEvent<HTMLButtonElement>)=>void;
 onOutputPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>void;
 onLabelChange:(value:string)=>void;onDuplicate:()=>void;onDelete:()=>void;
}

export const SpaceNodeShell:React.FC<Props>=({node,selected,nodeRun,outputTypes,subtitle,children,onPointerDown,onInputPointerUp,onOutputPointerDown,onLabelChange,onDuplicate,onDelete})=><div data-space-node={node.node_id} className={`absolute rounded-2xl border bg-[#0a141e]/97 shadow-[0_20px_70px_rgba(0,0,0,.35)] ${selected?'border-cyan-300/55 ring-1 ring-cyan-300/15':'border-white/[0.08]'}`} style={{left:node.x,top:node.y,width:SPACE_NODE_W,minHeight:SPACE_BASE_NODE_H}} onPointerDown={onPointerDown}>
 {node.kind==='TOOL'&&<button onPointerUp={onInputPointerUp} className="absolute -left-2 top-1/2 z-20 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#061019] bg-zinc-500" title="Entrada"/>}
 <button onPointerDown={onOutputPointerDown} className="absolute -right-2 top-1/2 z-20 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#061019] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.35)]" title="Arraste para conectar"/>
 <div className="flex items-start gap-2 border-b border-white/[0.06] p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.05] text-cyan-300">{outputTypes.includes('VIDEO')?<Video className="h-4 w-4"/>:<ImageIcon className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><input value={node.label} onChange={e=>onLabelChange(e.target.value)} className="w-full truncate bg-transparent text-[10px] font-bold text-white outline-none"/><span className="mt-0.5 block truncate text-[7px] uppercase tracking-[.12em] text-zinc-600">{subtitle}</span></div>{nodeRun&&<span className={`mt-1.5 h-2 w-2 rounded-full ${nodeRun.status==='SUCCEEDED'?'bg-emerald-400':nodeRun.status==='FAILED'?'bg-rose-400':nodeRun.status==='RUNNING'?'animate-pulse bg-cyan-300':'bg-zinc-600'}`}/>}</div>
 {children}
 <div className="flex items-center justify-between border-t border-white/[0.05] px-2.5 py-1.5"><span className="text-[7px] text-zinc-700">{node.kind==='TOOL'?'Saída: '+outputTypes.join(', '):node.media_type}</span><div className="flex"><button onClick={onDuplicate} className="grid h-6 w-6 place-items-center rounded text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"><Copy className="h-3 w-3"/></button><button onClick={onDelete} className="grid h-6 w-6 place-items-center rounded text-zinc-600 hover:bg-rose-400/[0.08] hover:text-rose-300"><Trash2 className="h-3 w-3"/></button></div></div>
</div>;

export default SpaceNodeShell;
