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
    {isOpen&&<div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose}/>} 
    <aside className={`fixed inset-y-0 left-0 z-50 w-[204px] border-r border-white/[0.055] bg-[#080a0e] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="h-[64px] px-4 flex items-center justify-between border-b border-white/[0.05]"><BrandMark/><button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="w-4 h-4"/></button></div>
      <div className="flex-1 overflow-y-auto px-2.5 py-4"><nav className="space-y-1">{nav.map(({id,label,icon:Icon})=>{const active=currentView===id || (id==='library'&&currentView==='assets');return <button key={id} onClick={()=>go(id)} className={`group relative flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold transition-all ${active?'bg-white/[0.075] text-white border border-white/[0.07]':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}>{active&&<span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-emerald-300 to-cyan-300"/>}<Icon className={`w-4 h-4 ${active?'text-emerald-300':'text-zinc-600 group-hover:text-zinc-400'}`}/><span>{label}</span></button>;})}</nav>{isAdmin&&<><div className="my-4 h-px bg-white/[0.055]"/><button onClick={()=>go('admin')} className={`flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold ${currentView==='admin'?'bg-emerald-400/10 text-white':'text-zinc-500 hover:bg-white/[0.035] hover:text-white'}`}><ShieldCheck className="w-4 h-4 text-emerald-400"/> Painel Admin</button></>}</div>
    </aside>
  </>;
};
