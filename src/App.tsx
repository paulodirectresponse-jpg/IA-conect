import React, { Suspense, lazy, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { BrandMark } from './components/common/BrandMark.js';
import { markViewNavigationStart } from './utils/performanceMetrics.js';

const LoginView=lazy(()=>import('./components/views/LoginView.js').then(m=>({default:m.LoginView})));
const RegisterView=lazy(()=>import('./components/views/RegisterView.js').then(m=>({default:m.RegisterView})));
const LandingPageView=lazy(()=>import('./components/views/LandingPageView.js').then(m=>({default:m.LandingPageView})));
const DashboardView=lazy(()=>import('./components/views/DashboardView.js').then(m=>({default:m.DashboardView})));
const WalletView=lazy(()=>import('./components/views/WalletView.js').then(m=>({default:m.WalletView})));
const CreateHubView=lazy(()=>import('./components/views/CreateHubView.js').then(m=>({default:m.CreateHubView})));
const HistoryView=lazy(()=>import('./components/views/HistoryView.js').then(m=>({default:m.HistoryView})));
const AdminView=lazy(()=>import('./components/views/AdminView.js').then(m=>({default:m.AdminView})));
const SettingsView=lazy(()=>import('./components/views/SettingsView.js').then(m=>({default:m.SettingsView})));
const LibraryHubView=lazy(()=>import('./components/views/LibraryHubView.js').then(m=>({default:m.LibraryHubView})));
const CommunityView=lazy(()=>import('./components/views/CommunityView.js').then(m=>({default:m.CommunityView})));

const ViewFallback=()=> <div className="w-full min-h-[320px] px-1 py-3 animate-pulse" aria-busy="true" aria-label="Carregando conteúdo"><div className="h-5 w-40 rounded-lg bg-white/[0.055]"/><div className="mt-2 h-3 w-64 max-w-[70%] rounded bg-white/[0.035]"/><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025]"/><div className="h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025]"/><div className="hidden h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025] lg:block"/></div><span className="sr-only">Carregando</span></div>;
const withSuspense=(node:React.ReactNode)=><Suspense fallback={<ViewFallback/>}>{node}</Suspense>;

const MainApp: React.FC = () => {
  const { firebaseUser, loading, isAdmin, isSuspended, logout } = useAuth();
  const [publicView, setPublicView] = useState<'landing' | 'login' | 'register'>('landing');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const navigate = (view:string) => {
    markViewNavigationStart(view === 'assets' ? 'library' : view);
    setActiveView(view);
  };

  if (loading) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center"><div className="flex flex-col items-center gap-4"><BrandMark/><div className="w-7 h-7 rounded-full border-2 border-sky-400/80 border-t-transparent animate-spin"/><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">Iniciando estúdio</span></div></div>;
  if (!firebaseUser) {
    if(publicView==='register') return withSuspense(<RegisterView onSwitchToLogin={()=>setPublicView('login')}/>);
    if(publicView==='login') return withSuspense(<LoginView onSwitchToRegister={()=>setPublicView('register')}/>);
    return withSuspense(<LandingPageView onLogin={()=>setPublicView('login')} onStart={()=>setPublicView('register')}/>);
  }
  if (isSuspended) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4 text-zinc-100"><div className="max-w-md w-full p-6 bg-[#08131e] border border-sky-300/[0.10] rounded-2xl shadow-2xl text-center space-y-4"><div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-400/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-6 h-6"/></div><div><h2 className="text-base font-bold text-white">Conta suspensa</h2><p className="text-xs text-zinc-500 mt-1 leading-relaxed">O acesso às operações e recursos da plataforma foi temporariamente bloqueado.</p></div><button onClick={()=>logout()} className="w-full py-2.5 px-4 ia-primary text-xs font-semibold rounded-xl transition-colors">Sair da conta</button></div></div>;

  const normalizedView = activeView === 'assets' ? 'library' : activeView;
  const currentSafeView = normalizedView==='admin'&&!isAdmin?'dashboard':normalizedView;
  return <AppLayout currentView={currentSafeView} onNavigate={navigate}>
    <Suspense fallback={<ViewFallback/>}>
      {currentSafeView==='dashboard'&&<DashboardView onNavigate={navigate}/>}
      {currentSafeView==='wallet'&&<WalletView/>}
      {currentSafeView==='create-video'&&<CreateHubView initialMode="VIDEO"/>}
      {currentSafeView==='create-image'&&<CreateHubView initialMode="IMAGE"/>}
      {currentSafeView==='community'&&<CommunityView onNavigate={navigate}/>}
      {currentSafeView==='history'&&<HistoryView/>}
      {currentSafeView==='library'&&<LibraryHubView/>}
      {currentSafeView==='admin'&&isAdmin&&<AdminView/>}
      {currentSafeView==='settings'&&<SettingsView/>}
    </Suspense>
  </AppLayout>;
};

export default function App(){ return <AuthProvider><MainApp/></AuthProvider>; }
