import React from 'react';
import { BookOpen, Globe2, Home, Image as ImageIcon, ShieldCheck, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { BrandMark } from '../common/BrandMark.js';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose }) => {
  const { isAdmin } = useAuth();
  const go = (view: string) => {
    onNavigate(view);
    onClose();
  };

  const primary: NavItem[] = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'community', label: 'Comunidade', icon: Globe2 },
    { id: 'library', label: 'Biblioteca', icon: BookOpen },
  ];

  const create: NavItem[] = [
    { id: 'create-image', label: 'Imagem', icon: ImageIcon },
    { id: 'create-video', label: 'Vídeo', icon: Video },
  ];

  const item = ({ id, label, icon: Icon }: NavItem) => {
    const active = currentView === id || (id === 'library' && currentView === 'assets');
    return (
      <button
        key={id}
        onClick={() => go(id)}
        aria-current={active ? 'page' : undefined}
        className={`ia-shell-nav-item group relative flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[12px] font-semibold ${active ? 'is-active' : ''}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`ia-shell-sidebar fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col border-r lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[64px] items-center justify-between px-4">
          <BrandMark />
          <button onClick={onClose} className="ia-shell-icon-button lg:hidden" aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <nav className="space-y-1">{primary.map(item)}</nav>

          <div className="mb-2 mt-6 px-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--ia-text-4)]">Criar</p>
          </div>
          <nav className="space-y-1">{create.map(item)}</nav>

          {isAdmin && (
            <>
              <div className="my-5 h-px bg-[var(--ia-line)]" />
              <button
                onClick={() => go('admin')}
                aria-current={currentView === 'admin' ? 'page' : undefined}
                className={`ia-shell-nav-item group relative flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[12px] font-semibold ${currentView === 'admin' ? 'is-active' : ''}`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Administração</span>
              </button>
            </>
          )}
        </div>

        <div className="mx-3 mb-3 border-t border-[var(--ia-line)] pt-3">
          <p className="px-3 text-[9px] leading-relaxed text-[var(--ia-text-4)]">
            Creative AI Studio
          </p>
        </div>
      </aside>
    </>
  );
};
