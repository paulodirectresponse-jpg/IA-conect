import React,{useEffect,useState}from'react';
import{Users,Coins,Layers,Server,Activity,Tag,ChartNoAxesCombined,Route,ScanSearch}from'lucide-react';
import{adminService,SystemHealthSnapshot}from'../../services/adminService.js';
import{Card}from'../common/Card.js';
import{Badge}from'../common/Badge.js';
import{AdminUsersList}from'../admin/AdminUsersList.js';
import{AdminModels}from'../admin/AdminModels.js';
import{AdminProviders}from'../admin/AdminProviders.js';
import{AdminProviderScan}from'../admin/AdminProviderScan.js';
import{AdminPricing}from'../admin/AdminPricing.js';
import{AdminCoupons}from'../admin/AdminCoupons.js';
import{AdminEconomics}from'../admin/AdminEconomics.js';
import{AdminBetaCatalog}from'../admin/AdminBetaCatalog.js';

type AdminTab='overview'|'users'|'models'|'providers'|'provider-scan'|'pricing'|'coupons'|'economics'|'beta-catalog';
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
  {id:'provider-scan'as const,label:'APIs & Scan',icon:<ScanSearch className="w-4 h-4"/>},
  {id:'pricing'as const,label:'Preços & margem',icon:<Coins className="w-4 h-4"/>},
  {id:'coupons'as const,label:'Cupons',icon:<Tag className="w-4 h-4"/>},
  {id:'economics'as const,label:'Economia',icon:<ChartNoAxesCombined className="w-4 h-4"/>},
  {id:'beta-catalog'as const,label:'Beta · Catálogo',icon:<Route className="w-4 h-4"/>},
 ];
 return <div className="ia-admin space-y-7">
  <header className="ia-view-header"><div className="flex items-center gap-2.5"><h1 className="ia-view-title">Administração</h1><Badge variant="neutral">Operacional</Badge></div><p className="ia-view-description">Créditos, preços de varejo, cupons, provedores e economia do IA Connect.</p></header>
  <nav className="ia-admin-tabs flex items-center gap-1 overflow-x-auto pb-2">{tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={`ia-admin-tab flex h-10 items-center gap-2 px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap ${activeTab===t.id?'is-active':''}`}>{t.icon}{t.label}</button>)}</nav>
  {activeTab==='overview'&&<div className="space-y-5">
   <div className="ia-admin-stats grid grid-cols-2 lg:grid-cols-4">
    <Card id="admin-stat-users"><span>Usuários</span><div>{stats?.total_users??'—'}</div><small>{stats?.active_users??0} ativos</small></Card>
    <Card id="admin-stat-credits"><span>Créditos em contas</span><div>{Number(stats?.total_platform_credits||0).toLocaleString('pt-BR')}</div><small>disponíveis + reservados</small></Card>
    <Card id="admin-stat-models"><span>Modelos</span><div>{stats?.models_count??'—'}</div><small>catálogo ativo</small></Card>
    <Card id="admin-stat-providers"><span>Provedores</span><div>{stats?.providers_count??'—'}</div><small>catálogo de provedores</small></Card>
   </div>
   <section className="ia-admin-panel">
    <div className="flex items-center justify-between gap-3"><div><h2>Saúde operacional</h2><p>Diagnóstico da arquitetura ativa.</p></div>{health&&<span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${healthClass(health.status)}`}>{health.status}</span>}</div>
    {health?<div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{health.checks.map(check=><div key={check.key} className={`ia-admin-health rounded-[11px] border p-3 ${healthClass(check.status)}`}><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-white">{check.label}</p><span className="text-[9px] font-bold">{check.status}</span></div><p className="mt-1.5 text-[10px] leading-relaxed opacity-80">{check.detail}</p></div>)}</div>:<p className="mt-3 text-[11px] text-zinc-600">Carregando diagnóstico...</p>}
   </section>
   <section className="ia-admin-panel"><h2>Fonte de verdade financeira</h2><p className="mt-2">Os créditos operacionais são registrados exclusivamente no Credit Ledger. O BRL é usado apenas para pagamentos, caixa, COGS e análise econômica.</p></section>
  </div>}
  {activeTab==='users'&&<AdminUsersList/>}
  {activeTab==='models'&&<AdminModels/>}
  {activeTab==='providers'&&<AdminProviders/>}
  {activeTab==='provider-scan'&&<AdminProviderScan/>}
  {activeTab==='pricing'&&<AdminPricing/>}
  {activeTab==='coupons'&&<AdminCoupons/>}
  {activeTab==='economics'&&<AdminEconomics/>}
  {activeTab==='beta-catalog'&&<AdminBetaCatalog/>}
 </div>;
};
