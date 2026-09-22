import React from'react';
import{Command,X}from'lucide-react';

interface Props{open:boolean;onClose:()=>void;}
const rows=[
 ['/','Abrir menu de ações'],
 ['F','Enquadrar todos os nodes'],
 ['Ctrl/⌘ + D','Duplicar node selecionado'],
 ['Delete / Backspace','Excluir node selecionado'],
 ['Esc','Fechar menus e Inspector'],
];

export const SpaceShortcuts:React.FC<Props>=({open,onClose})=>{
 if(!open)return null;
 return <div className="absolute inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="space-shortcuts-title" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div className="w-full max-w-[390px] rounded-2xl border border-white/[0.09] bg-[#0a141e]/98 p-4 shadow-2xl">
   <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/[0.08] text-cyan-200"><Command className="h-4 w-4"/></span><div className="min-w-0 flex-1"><h2 id="space-shortcuts-title" className="text-[11px] font-bold text-white">Atalhos do Space</h2><p className="mt-0.5 text-[8px] text-zinc-600">Comandos rápidos para trabalhar sem sair do canvas.</p></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl text-zinc-600 hover:bg-white/[0.05] hover:text-white" aria-label="Fechar atalhos"><X className="h-4 w-4"/></button></div>
   <div className="mt-4 divide-y divide-white/[0.05]">{rows.map(([key,label])=><div key={key} className="flex items-center justify-between gap-4 py-2.5"><span className="text-[9px] text-zinc-400">{label}</span><kbd className="shrink-0 rounded-lg border border-white/[0.08] bg-black/25 px-2 py-1 text-[8px] font-semibold text-zinc-300 shadow-inner">{key}</kbd></div>)}</div>
   <p className="mt-3 border-t border-white/[0.05] pt-3 text-center text-[7px] text-zinc-700">Pressione ? novamente ou Esc para fechar.</p>
  </div>
 </div>;
};

export default SpaceShortcuts;
