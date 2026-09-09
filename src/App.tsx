import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginView } from './components/views/LoginView.js';
import { RegisterView } from './components/views/RegisterView.js';
import { LandingPageView } from './components/views/LandingPageView.js';
import { DashboardView } from './components/views/DashboardView.js';
import { WalletView } from './components/views/WalletView.js';
import { CreateHubView } from './components/views/CreateHubView.js';
import { HistoryView } from './components/views/HistoryView.js';
import { AdminView } from './components/views/AdminView.js';
import { SettingsView } from './components/views/SettingsView.js';
import { LibraryHubView } from './components/views/LibraryHubView.js';
import { BrandMark } from './components/common/BrandMark.js';

const MainApp: React.FC = () => {
  const { firebaseUser, loading, isAdmin, isSuspended, logout } = useAuth();
  const [publicView, setPublicView] = useState<'landing' | 'login' | 'register'>('landing');
  const [activeView, setActiveView] = useState<string>('dashboard');

  if (loading) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center"><div className="flex flex-col items-center gap-4"><BrandMark/><div className="w-7 h-7 rounded-full border-2 border-sky-400/80 border-t-transparent animate-spin"/><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">Iniciando studio</span></div></div>;
  if (!firebaseUser) {
    if(publicView==='register') return <RegisterView onSwitchToLogin={()=>setPublicView('login')}/>;
    if(publicView==='login') return <LoginView onSwitchToRegister={()=>setPublicView('register')}/>;
    return <LandingPageView onLogin={()=>setPublicView('login')} onStart={()=>setPublicView('register')}/>;
  }
  if (isSuspended) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4 text-zinc-100"><div className="max-w-md w-full p-6 bg-[#08131e] border border-sky-300/[0.10] rounded-2xl shadow-2xl text-center space-y-4"><div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-400/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-6 h-6"/></div><div><h2 className="text-base font-bold text-white">Conta suspensa</h2><p className="text-xs text-zinc-500 mt-1 leading-relaxed">O acesso às operações e recursos da plataforma foi temporariamente bloqueado.</p></div><button onClick={()=>logout()} className="w-full py-2.5 px-4 ia-primary text-xs font-semibold rounded-xl transition-colors">Sair da conta</button></div></div>;

  const normalizedView = activeView === 'assets' ? 'library' : activeView;
  const currentSafeView = normalizedView==='admin'&&!isAdmin?'dashboard':normalizedView;
  return <AppLayout currentView={currentSafeView} onNavigate={setActiveView}>
    {currentSafeView==='dashboard'&&<DashboardView onNavigate={setActiveView}/>} 
    {currentSafeView==='wallet'&&<WalletView/>}
    {currentSafeView==='create-video'&&<CreateHubView initialMode="VIDEO"/>}
    {currentSafeView==='create-image'&&<CreateHubView initialMode="IMAGE"/>}
    {currentSafeView==='history'&&<HistoryView/>}
    {currentSafeView==='library'&&<LibraryHubView/>}
    {currentSafeView==='admin'&&isAdmin&&<AdminView/>}
    {currentSafeView==='settings'&&<SettingsView/>}
  </AppLayout>;
};

export default function App(){ return <AuthProvider><MainApp/></AuthProvider>; }
