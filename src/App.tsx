import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { BrandMark } from './components/common/BrandMark.js';
import { markViewNavigationStart } from './utils/performanceMetrics.js';
import { getBetaEnabled } from './beta/services/betaAccessService.js';
import'./styles/fullAppStyles.js';

const DashboardView=lazy(()=>import('./components/views/DashboardView.js').then(m=>({default:m.DashboardView})));
const WalletView=lazy(()=>import('./components/views/WalletView.js').then(m=>({default:m.WalletView})));
const CreateHubView=lazy(()=>import('./components/views/CreateHubView.js').then(m=>({default:m.CreateHubView})));
const HistoryView=lazy(()=>import('./components/views/HistoryView.js').then(m=>({default:m.HistoryView})));
const AdminView=lazy(()=>import('./components/views/AdminView.js').then(m=>({default:m.AdminView})));
const SettingsView=lazy(()=>import('./components/views/SettingsView.js').then(m=>({default:m.SettingsView})));
const LibraryHubView=lazy(()=>import('./components/views/LibraryHubView.js').then(m=>({default:m.LibraryHubView})));
const CommunityView=lazy(()=>import('./components/views/CommunityView.js').then(m=>({default:m.CommunityView})));
const BetaApp=lazy(()=>import('./beta/BetaApp.js').then(m=>({default:m.BetaApp})));
const BetaSharedView=lazy(()=>import('./beta/views/BetaSharedView.js').then(m=>({default:m.BetaSharedView})));

const ViewFallback=()=> <div className="w-full min-h-[320px] px-1 py-3 animate-pulse" aria-busy="true" aria-label="Carregando conteúdo"><div className="h-5 w-40 rounded-lg bg-white/[0.055]"/><div className="mt-2 h-3 w-64 max-w-[70%] rounded bg-white/[0.035]"/><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025]"/><div className="h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025]"/><div className="hidden h-36 rounded-2xl border border-white/[0.05] bg-white/[0.025] lg:block"/></div><span className="sr-only">Carregando</span></div>;
const BetaFallback=()=> <div className="min-h-screen bg-[#050a10] flex items-center justify-center" aria-busy="true"><div className="w-7 h-7 rounded-full border-2 border-sky-400/80 border-t-transparent animate-spin"/><span className="sr-only">Carregando Beta</span></div>;

const MainApp: React.FC<{onSignedOut?:()=>void}> = ({onSignedOut}) => {
  const { firebaseUser, loading, isAdmin, isSuspended, logout } = useAuth();
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [lastStableView, setLastStableView] = useState('dashboard');
  const navigate = (view:string) => {if(view==='beta'&&!betaEnabled)return;markViewNavigationStart(view === 'assets' ? 'library' : view);if(view!=='beta')setLastStableView(view);setActiveView(view);};
  useEffect(()=>{if(!loading&&!firebaseUser)onSignedOut?.()},[loading,firebaseUser,onSignedOut]);
  useEffect(()=>{if(loading||!firebaseUser)return;let active=true;getBetaEnabled().then(enabled=>{if(active)setBetaEnabled(enabled)}).catch(()=>{if(active)setBetaEnabled(false)});return()=>{active=false};},[loading,firebaseUser]);
  useEffect(()=>{if(activeView==='beta'&&!betaEnabled)setActiveView(lastStableView);},[activeView,betaEnabled,lastStableView]);
  if (loading||!firebaseUser) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center"><div className="flex flex-col items-center gap-4"><BrandMark/><div className="w-7 h-7 rounded-full border-2 border-sky-400/80 border-t-transparent animate-spin"/><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">Iniciando estúdio</span></div></div>;
  if (isSuspended) return <div className="min-h-screen bg-[#050a10] flex items-center justify-center p-4 text-zinc-100"><div className="max-w-md w-full p-6 bg-[#08131e] border border-sky-300/[0.10] rounded-2xl shadow-2xl text-center space-y-4"><div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-400/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-6 h-6"/></div><div><h2 className="text-base font-bold text-white">Conta suspensa</h2><p className="text-xs text-zinc-500 mt-1 leading-relaxed">O acesso às operações e recursos da plataforma foi temporariamente bloqueado.</p></div><button onClick={()=>logout()} className="w-full py-2.5 px-4 ia-primary text-xs font-semibold rounded-xl transition-colors">Sair da conta</button></div></div>;
  if(activeView==='beta'&&betaEnabled)return <Suspense fallback={<BetaFallback/>}><BetaApp onExit={()=>navigate(lastStableView)}/></Suspense>;
  const normalizedView = activeView === 'assets' ? 'library' : activeView;
  const currentSafeView = normalizedView==='admin'&&!isAdmin?'dashboard':normalizedView;
  return <AppLayout currentView={currentSafeView} onNavigate={navigate} betaEnabled={betaEnabled}><Suspense fallback={<ViewFallback/>}>{currentSafeView==='dashboard'&&<DashboardView onNavigate={navigate}/>} {currentSafeView==='wallet'&&<WalletView/>}{currentSafeView==='create-video'&&<CreateHubView initialMode="VIDEO"/>}{currentSafeView==='create-image'&&<CreateHubView initialMode="IMAGE"/>}{currentSafeView==='community'&&<CommunityView onNavigate={navigate}/>} {currentSafeView==='history'&&<HistoryView/>}{currentSafeView==='library'&&<LibraryHubView/>}{currentSafeView==='admin'&&isAdmin&&<AdminView/>}{currentSafeView==='settings'&&<SettingsView/>}</Suspense></AppLayout>;
};

export default function App({onSignedOut}:{onSignedOut?:()=>void}={}){const token=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('betaShare'):null;if(token)return <Suspense fallback={<BetaFallback/>}><BetaSharedView token={token}/></Suspense>;return <AuthProvider><MainApp onSignedOut={onSignedOut}/></AuthProvider>;}
