import React from 'react';
import {
  Box,
  FolderKanban,
  Home,
  Images,
  Layers3,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { BrandMark } from '../common/BrandMark.js';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose }) => {
  const { isAdmin } = useAuth();
  const handleItemClick = (view: string) => { onNavigate(view); onClose(); };

  const main = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'create', label: 'Criar', icon: Sparkles },
    { id: 'assets', label: 'Assets', icon: Images },
  ];
  const libraries = [
    { id: 'characters', label: 'Personagens', icon: UserRound },
    { id: 'products', label: 'Produtos', icon: Box },
    { id: 'styles', label: 'Estilos', icon: Layers3 },
    { id: 'projects', label: 'Projetos', icon: FolderKanban },
  ];

  const render = ({ id, label, icon: Icon }: { id:string; label:string; icon:any }) => {
    const active = currentView === id;
    return <button key={id} onClick={() => handleItemClick(id)} className={`group relative flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold transition-all ${active ? 'bg-white/[0.075] text-white border border-white/[0.07]' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}>
      {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-violet-400 to-cyan-300" />}
      <Icon className={`w-4 h-4 ${active ? 'text-violet-300' : 'text-zinc-650 group-hover:text-zinc-400'}`} />
      <span>{label}</span>
    </button>;
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[204px] border-r border-white/[0.06] bg-[#080a0e] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-[64px] px-4 flex items-center justify-between border-b border-white/[0.05]"><BrandMark/><button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="w-4 h-4"/></button></div>
        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <nav className="space-y-1">{main.map(render)}</nav>
          <div className="my-4 h-px bg-white/[0.055]" />
          <p className="px-3 mb-2 text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700">Biblioteca</p>
          <nav className="space-y-1">{libraries.map(render)}</nav>
          {isAdmin && <><div className="my-4 h-px bg-white/[0.055]"/><button onClick={() => handleItemClick('admin')} className={`flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[11px] font-semibold ${currentView === 'admin' ? 'bg-emerald-400/10 text-white' : 'text-zinc-500 hover:bg-white/[0.035] hover:text-white'}`}><ShieldCheck className="w-4 h-4 text-emerald-400"/> Painel Admin</button></>}
        </div>
        <div className="p-3 border-t border-white/[0.055]"><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className="text-[9px] font-semibold text-zinc-300">Studio inteligente</p><p className="mt-1 text-[8px] leading-relaxed text-zinc-650">Imagem, vídeo e bibliotecas consistentes em um único workflow.</p></div></div>
      </aside>
    </>
  );
};
