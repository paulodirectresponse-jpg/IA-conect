import React from 'react';
import { Menu, LogOut, Shield, Wallet as WalletIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Badge } from '../common/Badge.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { profile, wallet, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-zinc-200/80">
      {/* Left: Mobile menu toggle + Brand */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 lg:hidden cursor-pointer"
          aria-label="Alternar Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-50 font-bold text-sm tracking-wider">
            AI
          </div>
          <span className="font-semibold text-zinc-900 text-sm sm:text-base tracking-tight">
            Plataforma IA
          </span>
        </div>
      </div>

      {/* Right: Wallet summary + Admin Tag + Profile + Sign Out */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Wallet Balance Widget */}
        <button
          id="navbar-wallet-widget-btn"
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors cursor-pointer text-left"
          title="Ver Extrato da Carteira"
        >
          <WalletIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-medium text-zinc-500 tracking-wider">Saldo</span>
            <span className="text-xs sm:text-sm font-semibold text-zinc-900 tabular-nums">
              {formatCentsToBRL(wallet?.available_balance_cents || 0)}
            </span>
          </div>
        </button>

        {/* Admin Tag */}
        {isAdmin && (
          <Badge id="navbar-admin-badge" variant="neutral" className="hidden sm:inline-flex bg-zinc-900 text-zinc-50 border-zinc-800">
            <Shield className="w-3 h-3 text-amber-400" />
            ADMIN
          </Badge>
        )}

        {/* User Info / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
          <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center font-medium text-xs">
            {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <button
            id="navbar-logout-btn"
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
