import React from 'react';
import { BookOpen, Home, Image as ImageIcon, ShieldCheck, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { BrandMark } from '../common/BrandMark.js';

interface SidebarProps { currentView:string; onNavigate:(view:string)=>void; isOpen:boolean; onClose:()=>void; }

export const Sidebar: React.FC<SidebarProps> = ({ currentView,onNavigate,isOpen,onClose }) => {
  const { isAdmin }=useAuth(); const go=(view:string)=>{onNavigate(view);onClose();};
  const nav=[
    {id:'dashboard',label:'Início',icon:Home},
    {id:'create-video',label:'Gerar vídeo',icon:Video},
    {id:'create-image',label:'Gerar imagem',icon:ImageIcon},
    {id:'library',label:'Biblioteca',icon:BookOpen},
  ];
  return <>
    {isOpen&&<div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden" onClick={onClose}/>} 
    <aside className={`fixed inset-y-0 left-0 z-50 w-[204px] border-r border-sky-300/[0.08] bg-[#050b12] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="h-[64px] px-4 flex items-center justify-between border-b border-sky-300/[0.07]"><BrandMark/><button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-sky-300/[0.06] hover:text-white"><X className="w-4 h-4"/></button></div>
      <div className="flex-1 overflow-y-auto px-2.5 py-4"><nav className="space-y-1">{nav.map(({id,label,icon:Icon})=>{const active=currentView===id || (id==='library'&&currentView==='assets');return <button key={id} onClick={()=>go(id)} className={`group relative flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold transition-all ${active?'bg-sky-400/[0.11] text-white border border-sky-300/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,.03),0_10px_28px_rgba(20,159,255,.08)]':'text-zinc-500 hover:text-zinc-200 hover:bg-sky-300/[0.045]'}`}>{active&&<span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-sky-300 to-blue-400"/>}<Icon className={`w-4 h-4 ${active?'text-sky-300':'text-zinc-600 group-hover:text-zinc-400'}`}/><span>{label}</span></button>;})}</nav>{isAdmin&&<><div className="my-4 h-px bg-sky-300/[0.07]"/><button onClick={()=>go('admin')} className={`flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold ${currentView==='admin'?'bg-sky-400/10 text-white':'text-zinc-500 hover:bg-sky-300/[0.045] hover:text-white'}`}><ShieldCheck className="w-4 h-4 text-sky-300"/> Painel Admin</button></>}</div>
      <div className="m-2.5 rounded-2xl border border-sky-300/[0.1] bg-[radial-gradient(circle_at_80%_15%,rgba(25,184,255,.18),transparent_34%),#08131e] p-3"><p className="text-[9px] font-black text-white">Mais criação. Menos fricção.</p><p className="mt-1 text-[8px] leading-relaxed text-zinc-500">Um único fluxo para imagem, vídeo e referências.</p></div>
    </aside>
  </>;
};
