import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, CreditCard, LogOut, Menu, Settings, Shield, UserRound, Wallet as WalletIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { BrandMark } from '../common/BrandMark.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { profile, wallet, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initial = profile?.display_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-[70px] px-4 sm:px-6 bg-[#0b0e13]/95 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.05] lg:hidden" aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
        <button onClick={() => onNavigate('dashboard')} className="lg:hidden"><BrandMark /></button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors" title="Notificações"><Bell className="w-4 h-4" /></button>
        <button onClick={() => onNavigate('wallet')} className="h-9 flex items-center gap-2 px-3 rounded-xl border border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.06] text-zinc-300 transition-colors">
          <WalletIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold tabular-nums">{formatCentsToBRL(wallet?.available_balance_cents || 0)}</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setOpen((v) => !v)} className={`h-9 pl-1 pr-2 flex items-center gap-2 rounded-xl border transition-all ${open ? 'border-violet-400/30 bg-violet-400/10' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]'}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px]">
              <div className="w-full h-full rounded-full bg-[#11151c] flex items-center justify-center text-[10px] font-bold text-white">{initial}</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151c] shadow-2xl shadow-black/50">
              <div className="p-3.5 border-b border-white/[0.06]">
                <p className="text-[12px] font-semibold text-white truncate">{profile?.display_name || 'Minha conta'}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500 truncate">{profile?.email}</p>
              </div>
              <div className="p-1.5">
                <button onClick={() => { setOpen(false); onNavigate('settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] text-zinc-300 hover:bg-white/[0.05]"><UserRound className="w-4 h-4 text-zinc-500"/> Conta e perfil</button>
                <button onClick={() => { setOpen(false); onNavigate('wallet'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] text-zinc-300 hover:bg-white/[0.05]"><CreditCard className="w-4 h-4 text-zinc-500"/> Carteira e créditos</button>
                <button onClick={() => { setOpen(false); onNavigate('settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] text-zinc-300 hover:bg-white/[0.05]"><Settings className="w-4 h-4 text-zinc-500"/> Configurações</button>
                {isAdmin && <button onClick={() => { setOpen(false); onNavigate('admin'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] text-zinc-300 hover:bg-white/[0.05]"><Shield className="w-4 h-4 text-emerald-400"/> Administração</button>}
              </div>
              <div className="p-1.5 border-t border-white/[0.06]">
                <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] text-red-300 hover:bg-red-500/[0.08]"><LogOut className="w-4 h-4"/> Sair</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
