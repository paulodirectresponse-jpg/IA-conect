import React from'react';
import{Image as ImageIcon,Video}from'lucide-react';
import type{SpaceQuickAction}from'./canvas/SpaceQuickMenu.js';

interface Props{
 actions:SpaceQuickAction[];
 isReady:(capability:string)=>boolean;
 onAction:(action:SpaceQuickAction)=>void;
 onAddImageAsset:()=>void;
 onAddVideoAsset:()=>void;
}

export const SpaceEmptyState:React.FC<Props>=({actions,isReady,onAction,onAddImageAsset,onAddVideoAsset})=>{
 const toolActions=actions.slice(0,5);
 return <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-4 py-6 sm:px-6">
  <div className="pointer-events-auto relative w-full max-w-[860px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#09121b]/88 p-4 shadow-[0_24px_90px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:p-6">
   <div className="pointer-events-none absolute -left-24 -top-28 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl"/>
   <div className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-violet-400/[0.07] blur-3xl"/>
   <div className="relative">
    <div className="text-center">
     <span className="inline-flex rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.16em] text-zinc-500">Novo Space</span>
     <h2 className="mt-3 text-[20px] font-black tracking-[-.02em] text-white sm:text-[24px]">O que você quer criar?</h2>
     <p className="mx-auto mt-1.5 max-w-xl text-[9px] leading-relaxed text-zinc-500 sm:text-[10px]">Escolha por onde começar. Depois você pode conectar, transformar e expandir o fluxo livremente.</p>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
     {toolActions.map(action=>{const Icon=action.icon,ready=isReady(action.capability);return <button key={action.id} type="button" onClick={()=>onAction(action)} className="group min-h-[112px] rounded-2xl border border-white/[0.065] bg-white/[0.018] p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-cyan-300/[0.04] hover:shadow-[0_12px_34px_rgba(34,211,238,.06)]">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-black/20 text-cyan-300 transition group-hover:border-cyan-300/15 group-hover:bg-cyan-300/[0.08]"><Icon className="h-4 w-4"/></span>
      <strong className="mt-3 block text-[9px] font-bold text-zinc-200">{action.label}</strong>
      <span className="mt-1 block text-[7px] leading-relaxed text-zinc-600">{ready?'Pronto para usar':'Configuração automática'}</span>
     </button>})}
    </div>

    <div className="mt-2 grid grid-cols-2 gap-2">
     <button type="button" onClick={onAddImageAsset} className="group flex min-h-[54px] items-center gap-3 rounded-2xl border border-white/[0.055] bg-black/15 px-3.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.025]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.035] text-zinc-500 transition group-hover:text-cyan-300"><ImageIcon className="h-4 w-4"/></span>
      <span><strong className="block text-[9px] text-zinc-300">Imagem da Biblioteca</strong><small className="mt-0.5 block text-[7px] text-zinc-650">Adicione uma criação existente.</small></span>
     </button>
     <button type="button" onClick={onAddVideoAsset} className="group flex min-h-[54px] items-center gap-3 rounded-2xl border border-white/[0.055] bg-black/15 px-3.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.025]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.035] text-zinc-500 transition group-hover:text-cyan-300"><Video className="h-4 w-4"/></span>
      <span><strong className="block text-[9px] text-zinc-300">Vídeo da Biblioteca</strong><small className="mt-0.5 block text-[7px] text-zinc-650">Continue a partir de um vídeo salvo.</small></span>
     </button>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3 text-[7px] text-zinc-650">
     <span>Arraste imagem ou vídeo para o canvas</span>
     <span className="hidden h-1 w-1 rounded-full bg-zinc-800 sm:block"/>
     <span>Cole mídia com Ctrl+V</span>
     <span className="hidden h-1 w-1 rounded-full bg-zinc-800 sm:block"/>
     <span>Use “/” para abrir ações</span>
    </div>
   </div>
  </div>
 </div>;
};

export default SpaceEmptyState;
