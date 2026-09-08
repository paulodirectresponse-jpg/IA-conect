import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Clock,
  FolderOpen,
  Wallet,
  Settings,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpen,
  onClose,
}) => {
  const { isAdmin } = useAuth();

  const handleItemClick = (view: string) => {
    onNavigate(view);
    onClose();
  };

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'create',
      label: 'Criar Vídeo',
      icon: <Sparkles className="w-4 h-4" />,
      tag: 'Etapa 2',
    },
    { id: 'history', label: 'Histórico de Gerações', icon: <Clock className="w-4 h-4" /> },
    { id: 'assets', label: 'Biblioteca de Assets', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'wallet', label: 'Carteira & Ledger', icon: <Wallet className="w-4 h-4" /> },
    { id: 'settings', label: 'Configurações', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-zinc-50 border-r border-zinc-200/80 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-zinc-200/80 lg:hidden">
          <span className="font-semibold text-zinc-900 text-sm">Navegação</span>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div>
            <span className="px-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Plataforma
            </span>
            <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleItemClick(item.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 text-zinc-50'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.tag && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          isActive
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-zinc-200/70 text-zinc-600'
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div className="pt-4 border-t border-zinc-200/80">
              <span className="px-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Administração
              </span>
              <nav className="mt-2 space-y-1">
                <button
                  id="sidebar-nav-admin"
                  onClick={() => handleItemClick('admin')}
                  className={`flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    currentView === 'admin'
                      ? 'bg-zinc-900 text-zinc-50'
                      : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Painel Admin</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                    Core
                  </span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-zinc-200/80 bg-white/50 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fundação Segura</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Ledger em centavos • Regras Zero-Trust
          </p>
        </div>
      </aside>
    </>
  );
};
