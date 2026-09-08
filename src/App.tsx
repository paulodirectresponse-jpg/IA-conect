import React, { useState } from 'react';
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
  const { currentUser, loading, isAdmin } = useAuth();
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

  if (!currentUser) {
    if (authMode === 'register') {
      return (
        <RegisterView
          onSwitchToLogin={() => setAuthMode('login')}
          onSuccess={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginView
        onSwitchToRegister={() => setAuthMode('register')}
        onSuccess={() => {}}
      />
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
