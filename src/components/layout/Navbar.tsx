import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  FlaskConical,
  Image as ImageIcon,
  LogOut,
  Menu,
  Mic2,
  Plus,
  Settings,
  Shield,
  Sun,
  UserRound,
  Video,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCredits } from '../../utils/creditFormat.js';
import { BrandMark } from '../common/BrandMark.js';

interface NavbarProps {
  currentView: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNavigate: (view: string) => void;
  betaEnabled?: boolean;
}

const viewMeta: Record<string, { title: string; eyebrow: string }> = {
  dashboard: { title: 'Início', eyebrow: 'Estúdio' },
  'create-image': { title: 'Gerar imagem', eyebrow: 'Criação' },
  'create-video': { title: 'Gerar vídeo', eyebrow: 'Criação' },
  'create-voice': { title: 'Gerar voz', eyebrow: 'Criação' },
  community: { title: 'Comunidade', eyebrow: 'Explorar' },
  library: { title: 'Biblioteca', eyebrow: 'Arquivos' },
  assets: { title: 'Biblioteca', eyebrow: 'Arquivos' },
  history: { title: 'Histórico', eyebrow: 'Criações' },
  wallet: { title: 'Carteira', eyebrow: 'Créditos' },
  settings: { title: 'Configurações', eyebrow: 'Conta' },
  admin: { title: 'Administração', eyebrow: 'Operacional' },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  sidebarOpen,
  onToggleSidebar,
  onNavigate,
  betaEnabled = false,
}) => {
  const { profile, wallet, isAdmin, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [themeNotice, setThemeNotice] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
      if (createRef.current && !createRef.current.contains(target)) setCreateOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initial =
    profile?.display_name?.charAt(0).toUpperCase() ||
    profile?.email?.charAt(0).toUpperCase() ||
    'U';
  const balance = wallet?.available_credits ?? 0;
  const meta = viewMeta[currentView] || { title: 'IA Connect', eyebrow: 'Estúdio' };

  const navigate = (view: string) => {
    setAccountOpen(false);
    setCreateOpen(false);
    onNavigate(view);
  };

  return (
    <header className="ia-shell-navbar sticky top-0 z-30 flex h-[68px] items-center border-b px-3 sm:px-5 lg:px-6">
      <div className="ia-shell-navbar-primary flex min-w-0 items-center gap-3">
        <button onClick={onToggleSidebar} className="ia-shell-icon-button lg:hidden" aria-label={sidebarOpen?'Fechar menu':'Abrir menu'} aria-controls="ia-mobile-sidebar" aria-expanded={sidebarOpen}>
          <Menu className="h-5 w-5" />
        </button>

        <button onClick={() => onNavigate('dashboard')} className="ia-shell-mobile-brand min-w-0 lg:hidden" aria-label="Ir para o início">
          <BrandMark compact />
        </button>

        <div className="ia-shell-page-heading hidden min-w-0 lg:flex">
          <p className="ia-shell-page-title">{meta.title}</p>
          <span className="ia-shell-page-context">{meta.eyebrow}</span>
        </div>
      </div>

      <div className="ia-shell-navbar-actions ml-auto flex items-center gap-1.5 sm:gap-2">
        {betaEnabled && (
          <button
            type="button"
            onClick={() => navigate('beta')}
            className="ia-shell-beta-button inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-300/15 bg-sky-400/[0.06] px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-sky-300 transition-colors hover:border-sky-300/25 hover:bg-sky-400/[0.10]"
            aria-label="Experimentar IA Conect Beta"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Beta</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => {
              setThemeNotice(true);
              window.setTimeout(() => setThemeNotice(false), 2400);
            }}
            className="ia-shell-icon-button ia-shell-theme-button"
            title="Modo claro — em breve"
            aria-label="Modo claro ainda não disponível"
          >
            <Sun className="h-4 w-4" />
          </button>
          {themeNotice && (
            <div role="status" className="ia-shell-theme-notice absolute right-0 top-12 z-50 w-max max-w-[240px] rounded-xl border border-sky-300/10 bg-[#09131d]/98 px-3 py-2 text-[10px] font-medium text-zinc-300 shadow-2xl backdrop-blur-xl">
              Modo claro ainda não está disponível.
            </div>
          )}
        </div>

        <button onClick={() => navigate('wallet')} className="ia-shell-wallet">
          <WalletIcon className="h-3.5 w-3.5" />
          <span className="hidden text-[9px] font-medium text-[var(--ia-text-4)] sm:inline">Saldo</span>
          <span className="ia-shell-wallet-value text-[11px] font-semibold tabular-nums text-[var(--ia-text-1)]">{formatCredits(balance)}</span>
        </button>

        <div className="relative hidden sm:block" ref={createRef}>
          <button
            onClick={() => setCreateOpen((value) => !value)}
            className="ia-button-primary ia-shell-create-button flex h-10 items-center gap-1.5 px-4 text-[12px] font-bold"
            aria-expanded={createOpen}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar
            <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${createOpen ? 'rotate-180' : ''}`} />
          </button>

          {createOpen && (
            <div className="ia-shell-popover absolute right-0 mt-2 w-52 p-1.5">
              <button onClick={() => navigate('create-image')} className="ia-shell-menu-item">
                <ImageIcon className="h-4 w-4" />
                <span>
                  <strong>Imagem</strong>
                  <small>Gerar imagem com IA</small>
                </span>
              </button>
              <button onClick={() => navigate('create-video')} className="ia-shell-menu-item">
                <Video className="h-4 w-4" />
                <span>
                  <strong>Vídeo</strong>
                  <small>Gerar vídeo com IA</small>
                </span>
              </button>
              <button onClick={() => navigate('create-voice')} className="ia-shell-menu-item">
                <Mic2 className="h-4 w-4" />
                <span>
                  <strong>Voz</strong>
                  <small>Transformar texto em voz</small>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="ia-shell-account relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((value) => !value)}
            className={`ia-shell-account-trigger ${accountOpen ? 'is-open' : ''}`}
            aria-expanded={accountOpen}
          >
            <div className="grid h-7 w-7 place-items-center rounded-full border border-[var(--ia-line-strong)] bg-[var(--ia-surface-2)] text-[10px] font-bold text-[var(--ia-text-1)]">
              {initial}
            </div>
            <ChevronDown className={`ia-shell-account-chevron h-3.5 w-3.5 text-[var(--ia-text-4)] transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
          </button>

          {accountOpen && (
            <div className="ia-shell-popover absolute right-0 mt-2 w-64 overflow-hidden">
              <div className="border-b border-[var(--ia-line)] px-3.5 py-3">
                <p className="truncate text-[12px] font-semibold text-[var(--ia-text-1)]">{profile?.display_name || 'Minha conta'}</p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--ia-text-4)]">{profile?.email}</p>
              </div>

              <div className="p-1.5">
                <button onClick={() => navigate('settings')} className="ia-shell-account-item">
                  <UserRound className="h-4 w-4" /> Conta e perfil
                </button>
                <button onClick={() => navigate('wallet')} className="ia-shell-account-item">
                  <CreditCard className="h-4 w-4" /> Carteira e créditos
                </button>
                <button onClick={() => navigate('settings')} className="ia-shell-account-item">
                  <Settings className="h-4 w-4" /> Configurações
                </button>
                {isAdmin && (
                  <button onClick={() => navigate('admin')} className="ia-shell-account-item">
                    <Shield className="h-4 w-4" /> Administração
                  </button>
                )}
              </div>

              <div className="border-t border-[var(--ia-line)] p-1.5">
                <button onClick={logout} className="ia-shell-account-item text-rose-300 hover:bg-rose-500/[0.07]">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};