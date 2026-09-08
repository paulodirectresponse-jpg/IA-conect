import React from 'react';
import {
  Home,
  PlusCircle,
  Clock,
  FolderOpen,
  Wallet,
  Settings,
  ShieldCheck,
  X,
  Shield,
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

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'create', label: 'Create', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
    { id: 'assets', label: 'Assets', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-60 bg-white border-r border-zinc-200/90 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-zinc-200 lg:hidden bg-white">
          <span className="font-semibold text-zinc-900 text-sm">Menu</span>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Brand / Logo Area for Desktop */}
        <div className="hidden lg:flex items-center gap-2.5 h-14 px-5 border-b border-zinc-200/80 bg-white">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-xs">
            AI
          </div>
          <span className="font-bold text-zinc-900 text-sm tracking-tight">
            Video Studio
          </span>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleItemClick(item.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                    }`}
                  >
                    <span className={isActive ? 'text-emerald-600' : 'text-zinc-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div className="pt-3 border-t border-zinc-200/80">
              <span className="px-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Admin
              </span>
              <nav className="mt-1 space-y-1">
                <button
                  id="sidebar-nav-admin"
                  onClick={() => handleItemClick('admin')}
                  className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    currentView === 'admin'
                      ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${currentView === 'admin' ? 'text-emerald-600' : 'text-zinc-400'}`} />
                  <span>Painel Admin</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3.5 border-t border-zinc-200/80 bg-zinc-50/60 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 text-zinc-700 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fundação Segura</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Ledger em centavos • Firestore
          </p>
        </div>
      </aside>
    </>
  );
};
