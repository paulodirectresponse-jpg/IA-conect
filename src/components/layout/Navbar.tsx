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
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-zinc-200/80">
      {/* Left: Mobile menu toggle */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          className="p-1.5 -ml-1 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 lg:hidden cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => onNavigate('dashboard')}
          className="lg:hidden flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs tracking-wider">
            AI
          </div>
          <span className="font-bold text-zinc-900 text-sm">
            Video Studio
          </span>
        </div>
      </div>

      {/* Right: Wallet summary + Admin Tag + Profile + Sign Out */}
      <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
        {/* Wallet Balance Widget */}
        <button
          id="navbar-wallet-widget-btn"
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer text-left"
          title="Ver carteira"
        >
          <WalletIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-zinc-800 tabular-nums">
            {formatCentsToBRL(wallet?.available_balance_cents || 0)}
          </span>
        </button>

        {/* Admin Tag */}
        {isAdmin && (
          <Badge id="navbar-admin-badge" variant="neutral" className="hidden sm:inline-flex bg-zinc-100 text-zinc-800 border-zinc-200 text-[10px] py-0.5">
            <Shield className="w-3 h-3 text-emerald-600" />
            ADMIN
          </Badge>
        )}

        {/* User Info / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
          <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center font-semibold text-xs">
            {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <button
            id="navbar-logout-btn"
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            title="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
