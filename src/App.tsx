import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginView } from './components/views/LoginView.js';
import { RegisterView } from './components/views/RegisterView.js';
import { DashboardView } from './components/views/DashboardView.js';
import { WalletView } from './components/views/WalletView.js';
import { CreateView } from './components/views/CreateView.js';
import { HistoryView } from './components/views/HistoryView.js';
import { AssetsView } from './components/views/AssetsView.js';
import { AdminView } from './components/views/AdminView.js';
import { SettingsView } from './components/views/SettingsView.js';

const MainApp: React.FC = () => {
  const { firebaseUser, loading, isAdmin, isSuspended, logout } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeView, setActiveView] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Iniciando plataforma...
          </span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    if (authMode === 'register') {
      return (
        <RegisterView
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginView
        onSwitchToRegister={() => setAuthMode('register')}
      />
    );
  }

  // Suspended account screen
  if (isSuspended) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-white border border-rose-200 rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Conta Suspensa</h2>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
              Sua conta está suspensa por determinação administrativa. O acesso às operações e recursos da plataforma foi temporariamente bloqueado.
            </p>
          </div>
          <button
            id="btn-logout-suspended"
            onClick={() => logout()}
            className="w-full py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  // Fallback if non-admin tries to open admin
  const currentSafeView = activeView === 'admin' && !isAdmin ? 'dashboard' : activeView;

  return (
    <AppLayout activeView={currentSafeView} onNavigate={setActiveView}>
      {currentSafeView === 'dashboard' && <DashboardView onNavigate={setActiveView} />}
      {currentSafeView === 'wallet' && <WalletView />}
      {currentSafeView === 'create' && <CreateView />}
      {currentSafeView === 'history' && <HistoryView />}
      {currentSafeView === 'assets' && <AssetsView />}
      {currentSafeView === 'admin' && isAdmin && <AdminView />}
      {currentSafeView === 'settings' && <SettingsView />}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
