import React,{useEffect,useState}from'react';
import{Users,Coins,Layers,Server,Activity,Tag,ChartNoAxesCombined}from'lucide-react';
import{adminService,SystemHealthSnapshot}from'../../services/adminService.js';
import{Card}from'../common/Card.js';
import{Badge}from'../common/Badge.js';
import{AdminUsersList}from'../admin/AdminUsersList.js';
import{AdminModels}from'../admin/AdminModels.js';
import{AdminProviders}from'../admin/AdminProviders.js';
import{AdminPricing}from'../admin/AdminPricing.js';
import{AdminCoupons}from'../admin/AdminCoupons.js';
import{AdminEconomics}from'../admin/AdminEconomics.js';

type AdminTab='overview'|'users'|'models'|'providers'|'pricing'|'coupons'|'economics';
const healthClass=(status:'OK'|'DEGRADED'|'ERROR')=>status==='OK'?'text-emerald-300 bg-emerald-300/[0.06] border-emerald-300/15':status==='DEGRADED'?'text-amber-300 bg-amber-300/[0.06] border-amber-300/15':'text-rose-300 bg-rose-300/[0.06] border-rose-300/15';

export const AdminView:React.FC=()=>{
 const[activeTab,setActiveTab]=useState<AdminTab>('overview'),[stats,setStats]=useState<any>(null),[health,setHealth]=useState<SystemHealthSnapshot|null>(null);
 useEffect(()=>{
  Promise.all([adminService.getDashboardStats(),adminService.getSystemHealth()])
   .then(([s,h])=>{setStats(s);setHealth(h)})
   .catch(err=>console.error('Falha ao carregar resumo operacional:',err));
 },[]);
 const tabs=[
  {id:'overview'as const,label:'Resumo',icon:<Activity className="w-4 h-4"/>},
  {id:'users'as const,label:'Usuários & créditos',icon:<Users className="w-4 h-4"/>},
  {id:'models'as const,label:'Modelos',icon:<Layers className="w-4 h-4"/>},
  {id:'providers'as const,label:'Provedores',icon:<Server className="w-4 h-4"/>},
  {id:'pricing'as const,label:'Pricing & margem',icon:<Coins className="w-4 h-4"/>},
  {id:'coupons'as const,label:'Cupons',icon:<Tag className="w-4 h-4"/>},
  {id:'economics'as const,label:'Economia',icon:<ChartNoAxesCombined className="w-4 h-4"/>},
 ];
 return <div className="ia-admin space-y-6">
  <div><div className="flex items-center gap-2"><h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Admin</h1><Badge variant="neutral">Operacional</Badge></div><p className="mt-1 text-xs text-zinc-500">Créditos, retail pricing, cupons, provedores e economia do IA Connect.</p></div>
  <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/[0.06]">{tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={`ia-admin-tab flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap ${activeTab===t.id?'bg-white/[0.08] text-white':'text-zinc-500 hover:text-white hover:bg-white/[0.035]'}`}>{t.icon}{t.label}</button>)}</div>
  {activeTab==='overview'&&<div className="space-y-4">
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <Card id="admin-stat-users"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Usuários</span><div className="mt-1 text-xl font-black text-white">{stats?.total_users??'—'}</div><span className="text-[9px] text-zinc-600">{stats?.active_users??0} ativos</span></Card>
    <Card id="admin-stat-credits"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Créditos em contas</span><div className="mt-1 text-xl font-black text-white">{Number(stats?.total_platform_credits||0).toLocaleString('pt-BR')}</div><span className="text-[9px] text-zinc-600">disponíveis + reservados</span></Card>
    <Card id="admin-stat-models"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Modelos</span><div className="mt-1 text-xl font-black text-white">{stats?.models_count??'—'}</div><span className="text-[9px] text-zinc-600">catálogo ativo</span></Card>
    <Card id="admin-stat-providers"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Provedores</span><div className="mt-1 text-xl font-black text-white">{stats?.providers_count??'—'}</div><span className="text-[9px] text-zinc-600">catálogo de provedores</span></Card>
   </div>
   <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xs font-bold text-white">Saúde operacional</h2><p className="mt-1 text-[9px] text-zinc-600">Diagnóstico da arquitetura ativa.</p></div>{health&&<span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${healthClass(health.status)}`}>{health.status}</span>}</div>
    {health?<div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{health.checks.map(check=><div key={check.key} className={`rounded-xl border p-3 ${healthClass(check.status)}`}><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold text-white">{check.label}</p><span className="text-[8px] font-black">{check.status}</span></div><p className="mt-1 text-[9px] leading-relaxed opacity-80">{check.detail}</p></div>)}</div>:<p className="mt-3 text-[10px] text-zinc-600">Carregando diagnóstico...</p>}
   </div>
   <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"><h2 className="text-xs font-bold text-white">Fonte de verdade financeira</h2><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Créditos operacionais vivem exclusivamente no Credit Ledger. BRL é usado apenas para pagamentos, caixa, COGS e análise econômica.</p></div>
  </div>}
  {activeTab==='users'&&<AdminUsersList/>}
  {activeTab==='models'&&<AdminModels/>}
  {activeTab==='providers'&&<AdminProviders/>}
  {activeTab==='pricing'&&<AdminPricing/>}
  {activeTab==='coupons'&&<AdminCoupons/>}
  {activeTab==='economics'&&<AdminEconomics/>}
 </div>;
};
