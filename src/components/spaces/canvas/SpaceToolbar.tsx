import React from'react';
import{ArrowLeft,Check,LoaderCircle,Maximize2,Plus,Save,ZoomIn,ZoomOut}from'lucide-react';

interface Props{name:string;onNameChange:(value:string)=>void;onBack:()=>void;saving:boolean;saved:boolean;zoom:number;onZoomOut:()=>void;onZoomIn:()=>void;onFit:()=>void;onAdd:()=>void;}

export const SpaceToolbar:React.FC<Props>=({name,onNameChange,onBack,saving,saved,zoom,onZoomOut,onZoomIn,onFit,onAdd})=><header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#071019]/95 px-3 sm:px-4 backdrop-blur-xl">
 <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-xl border border-white/[0.07] text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4"/></button>
 <input value={name} onChange={e=>onNameChange(e.target.value)} className="min-w-0 max-w-[320px] flex-1 bg-transparent px-1 text-[12px] font-bold text-white outline-none" aria-label="Nome do Space"/>
 <span className="hidden items-center gap-1 text-[8px] text-zinc-600 sm:flex">{saving?<><LoaderCircle className="h-3 w-3 animate-spin"/>Salvando…</>:saved?<><Check className="h-3 w-3 text-emerald-400"/>Salvo</>:<><Save className="h-3 w-3"/>Alterações</>}</span>
 <div className="ml-auto flex items-center gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1"><button onClick={onZoomOut} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:text-white"><ZoomOut className="h-3.5 w-3.5"/></button><span className="w-10 text-center text-[8px] text-zinc-600">{Math.round(zoom*100)}%</span><button onClick={onZoomIn} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:text-white"><ZoomIn className="h-3.5 w-3.5"/></button><button onClick={onFit} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:text-white"><Maximize2 className="h-3.5 w-3.5"/></button></div>
 <button onClick={onAdd} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[9px] font-semibold text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><Plus className="h-3.5 w-3.5"/>Adicionar</button>
</header>;

export default SpaceToolbar;
