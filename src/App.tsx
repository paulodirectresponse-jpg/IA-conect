import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginView } from './components/views/LoginView.js';
import { RegisterView } from './components/views/RegisterView.js';
import { DashboardView } from './components/views/DashboardView.js';
import { WalletView } from './components/views/WalletView.js';
import { CreateHubView } from './components/views/CreateHubView.js';
import { HistoryView } from './components/views/HistoryView.js';
import { AssetsView } from './components/views/AssetsView.js';
import { AdminView } from './components/views/AdminView.js';
import { SettingsView } from './components/views/SettingsView.js';
import { EntityLibraryView } from './components/views/EntityLibraryView.js';
import { BrandMark } from './components/common/BrandMark.js';

const MainApp: React.FC = () => {
  const { firebaseUser, loading, isAdmin, isSuspended, logout } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeView, setActiveView] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandMark />
          <div className="w-7 h-7 rounded-full border-2 border-violet-400/80 border-t-transparent animate-spin" />
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">Iniciando studio</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    if (authMode === 'register') return <RegisterView onSwitchToLogin={() => setAuthMode('login')} />;
    return <LoginView onSwitchToRegister={() => setAuthMode('register')} />;
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center p-4 text-zinc-100">
        <div className="max-w-md w-full p-6 bg-[#11151c] border border-white/[0.08] rounded-2xl shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-400/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-6 h-6" /></div>
          <div><h2 className="text-base font-bold text-white">Conta suspensa</h2><p className="text-xs text-zinc-500 mt-1 leading-relaxed">O acesso às operações e recursos da plataforma foi temporariamente bloqueado.</p></div>
          <button onClick={() => logout()} className="w-full py-2.5 px-4 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-colors">Sair da conta</button>
        </div>
      </div>
    );
  }

  const currentSafeView = activeView === 'admin' && !isAdmin ? 'dashboard' : activeView;

  return (
    <AppLayout currentView={currentSafeView} onNavigate={setActiveView}>
      {currentSafeView === 'dashboard' && <DashboardView onNavigate={setActiveView} />}
      {currentSafeView === 'wallet' && <WalletView />}
      {currentSafeView === 'create' && <CreateHubView />}
      {currentSafeView === 'history' && <HistoryView />}
      {currentSafeView === 'assets' && <AssetsView />}
      {currentSafeView === 'characters' && <EntityLibraryView kind="CHARACTER" />}
      {currentSafeView === 'products' && <EntityLibraryView kind="PRODUCT" />}
      {currentSafeView === 'styles' && <EntityLibraryView kind="STYLE" />}
      {currentSafeView === 'projects' && <EntityLibraryView kind="PROJECT" />}
      {currentSafeView === 'admin' && isAdmin && <AdminView />}
      {currentSafeView === 'settings' && <SettingsView />}
    </AppLayout>
  );
};

export default function App() {
  return <AuthProvider><MainApp /></AuthProvider>;
}
