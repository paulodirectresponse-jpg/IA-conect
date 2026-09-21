import React from'react';
import{Image as ImageIcon,Search,Video}from'lucide-react';

export interface SpaceQuickAction{id:string;label:string;capability:string;icon:React.ComponentType<{className?:string}>;description:string;group?:'POPULAR'|'TRANSFORMAR'|'VÍDEO';}

interface Props{
 x:number;y:number;canvasWidth:number;canvasHeight:number;fromSource:boolean;query:string;actions:SpaceQuickAction[];
 onQueryChange:(value:string)=>void;isReady:(capability:string)=>boolean;onAction:(action:SpaceQuickAction)=>void;
 onAddImageAsset:()=>void;onAddVideoAsset:()=>void;sourceTypeLabel?:string|null;
}

export const SpaceQuickMenu:React.FC<Props>=({x,y,canvasWidth,canvasHeight,fromSource,query,actions,onQueryChange,isReady,onAction,onAddImageAsset,onAddVideoAsset,sourceTypeLabel})=><div data-space-popover="quick-menu" className="absolute z-40 w-[min(300px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a141e]/98 shadow-2xl backdrop-blur-xl" role="dialog" aria-labelledby="space-quick-menu-title" style={{left:Math.max(12,Math.min(canvasWidth-Math.min(312,canvasWidth-24),x)),top:Math.max(12,Math.min(canvasHeight-360,y))}}>
 <div className="border-b border-white/[0.06] p-3"><strong id="space-quick-menu-title" className="text-[10px] text-white">{fromSource?'O que deseja fazer com esta saída?':'Adicionar ao Space'}</strong><label className="mt-2 flex h-8 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5"><Search className="h-3 w-3 text-zinc-700"/><input autoFocus value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Buscar ação…" className="min-w-0 flex-1 bg-transparent text-[9px] text-zinc-300 outline-none"/></label></div>
 <div className="max-h-[300px] overflow-y-auto p-1.5">
  {fromSource&&sourceTypeLabel&&<div className="px-2.5 pb-1.5 pt-1 text-[7px] font-semibold uppercase tracking-[.14em] text-cyan-300/60">Saída {sourceTypeLabel}</div>}
  {(['POPULAR','TRANSFORMAR','VÍDEO'] as const).map(group=>{const grouped=actions.filter(action=>(action.group||'POPULAR')===group);if(!grouped.length)return null;return <div key={group} className="py-1"><div className="px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[.14em] text-zinc-700">{group}</div>{grouped.map(action=>{const Icon=action.icon;const ready=isReady(action.capability);return <button key={action.id} onClick={()=>onAction(action)} className="group flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-white/[0.045]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/[0.06] text-cyan-300 transition group-hover:bg-cyan-300/10"><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="block text-[9px] text-zinc-200">{action.label}</strong>{fromSource&&<span className="text-[7px] text-zinc-700">conectar →</span>}</span><small className="mt-0.5 block text-[8px] leading-relaxed text-zinc-600">{action.description}{ready?'':' · será salvo em Auto até a rota ficar disponível.'}</small></span></button>})}</div>})}
  {!actions.length&&fromSource&&<div className="px-3 py-6 text-center text-[8px] leading-relaxed text-zinc-600">Nenhuma ação compatível com esta saída.</div>}
  {!fromSource&&<><div className="my-1 h-px bg-white/[0.05]"/><button onClick={onAddImageAsset} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-white/[0.04]"><ImageIcon className="h-4 w-4 text-zinc-500"/><span className="text-[9px] text-zinc-300">Imagem da Biblioteca</span></button><button onClick={onAddVideoAsset} className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-white/[0.04]"><Video className="h-4 w-4 text-zinc-500"/><span className="text-[9px] text-zinc-300">Vídeo da Biblioteca</span></button></>}
 </div>
</div>;

export default SpaceQuickMenu;
