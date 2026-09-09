import React from 'react';
import {
  Home,
  Sparkles,
  Clock3,
  Images,
  ShieldCheck,
  X,
  WandSparkles,
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

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'create', label: 'Criar', icon: Sparkles },
    { id: 'assets', label: 'Assets', icon: Images },
    { id: 'history', label: 'Histórico', icon: Clock3 },
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[208px] border-r border-white/[0.07] bg-[#090b10] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-[70px] px-5 flex items-center justify-between border-b border-white/[0.06]">
          <BrandMark />
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <nav className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = currentView === id;
              return (
                <button key={id} onClick={() => handleItemClick(id)} className={`group relative flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[12px] font-semibold transition-all ${active ? 'bg-gradient-to-r from-violet-500/20 to-cyan-400/5 text-white border border-violet-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'}`}>
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />}
                  <Icon className={`w-4 h-4 ${active ? 'text-violet-300' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="my-5 h-px bg-white/[0.06]" />
          <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-700">Studio</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-300"><WandSparkles className="w-3.5 h-3.5 text-cyan-400"/> Auto Router</div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-600">Escolhe a melhor rota compatível por capacidade e custo.</p>
          </div>

          {isAdmin && (
            <div className="mt-4">
              <button onClick={() => handleItemClick('admin')} className={`flex items-center gap-3 w-full h-10 px-3 rounded-xl text-[12px] font-semibold transition-all ${currentView === 'admin' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Painel Admin
              </button>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.08] to-cyan-400/[0.03] p-3">
            <p className="text-[10px] font-semibold text-zinc-200">IA Connect Studio</p>
            <p className="mt-1 text-[9px] text-zinc-600">Imagem e vídeo em um único workflow.</p>
          </div>
        </div>
      </aside>
    </>
  );
};
