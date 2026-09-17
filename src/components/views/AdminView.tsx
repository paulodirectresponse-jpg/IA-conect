import React,{useState}from'react';
import{Activity,BrainCircuit,Coins,Settings2,Users}from'lucide-react';
import{Badge}from'../common/Badge.js';
import{AdminOverviewDashboard}from'../admin/AdminOverviewDashboard.js';
import{AdminAIProvidersHub}from'../admin/AdminAIProvidersHub.js';
import{AdminFinanceDashboard}from'../admin/AdminFinanceDashboard.js';
import{AdminUsersDashboard}from'../admin/AdminUsersDashboard.js';
import{AdminSystemDashboard}from'../admin/AdminSystemDashboard.js';
import{AdminUsersList}from'../admin/AdminUsersList.js';
import{AdminPricing}from'../admin/AdminPricing.js';
import{AdminCoupons}from'../admin/AdminCoupons.js';
import{AdminEconomics}from'../admin/AdminEconomics.js';
import{AdminBetaCatalog}from'../admin/AdminBetaCatalog.js';
import{AdminFeatureFlags}from'../admin/AdminFeatureFlags.js';
import{AdminAuditLogs}from'../admin/AdminAuditLogs.js';
import{AdminPromotions}from'../admin/AdminPromotions.js';

type AdminTab='overview'|'ai'|'finance'|'users'|'system';

const Section:React.FC<{title:string;description:string;open?:boolean;children:React.ReactNode}>=({title,description,open=false,children})=><details open={open} className="group ia-admin-panel p-0 overflow-hidden"><summary className="list-none cursor-pointer px-4 sm:px-5 py-4 flex items-center justify-between gap-4 select-none"><div><h2 className="text-xs font-black text-white">{title}</h2><p className="mt-1 text-[10px] text-zinc-500 leading-relaxed">{description}</p></div><span className="text-[10px] font-bold text-zinc-500 group-open:text-sky-300">{open?'':'+'}</span></summary><div className="border-t border-white/[0.06] p-4 sm:p-5">{children}</div></details>;

export const AdminView:React.FC=()=>{
 const[activeTab,setActiveTab]=useState<AdminTab>('overview');
 const tabs=[
  {id:'overview'as const,label:'Visão Geral',icon:<Activity className="w-4 h-4"/>},
  {id:'ai'as const,label:'IA & Providers',icon:<BrainCircuit className="w-4 h-4"/>},
  {id:'finance'as const,label:'Financeiro',icon:<Coins className="w-4 h-4"/>},
  {id:'users'as const,label:'Usuários',icon:<Users className="w-4 h-4"/>},
  {id:'system'as const,label:'Sistema',icon:<Settings2 className="w-4 h-4"/>},
 ];
 return <div className="ia-admin space-y-7">
  <header className="ia-view-header"><div className="flex items-center gap-2.5"><h1 className="ia-view-title">Administração</h1><Badge variant="neutral">Operacional</Badge></div><p className="ia-view-description">Saúde operacional, IA, providers, finanças, usuários e sistema em uma única visão sincronizada.</p></header>
  <nav className="ia-admin-tabs flex items-center gap-1 overflow-x-auto pb-2">{tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={`ia-admin-tab flex h-10 items-center gap-2 px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap ${activeTab===t.id?'is-active':''}`}>{t.icon}{t.label}</button>)}</nav>

  {activeTab==='overview'&&<AdminOverviewDashboard/>}
  {activeTab==='ai'&&<AdminAIProvidersHub/>}

  {activeTab==='finance'&&<div className="space-y-4">
   <AdminFinanceDashboard/>
   <Section title="Economia detalhada" description="Ledger econômico, campanhas, subsídios, consumo por origem/modelo e gerações recentes."><AdminEconomics/></Section>
   <Section title="Preços & margem" description="Políticas de preço e pisos de margem usados pelo runtime."><AdminPricing/></Section>
  </div>}

  {activeTab==='users'&&<div className="space-y-4">
   <AdminUsersDashboard/>
   <Section title="Usuários & créditos" description="Contas, saldos, status e ajustes administrativos." open><AdminUsersList/></Section>
   <Section title="Cupons" description="Benefícios, regras de resgate, budgets e utilização."><AdminCoupons/></Section>
   <Section title="Promoções" description="Promoções persistentes do catálogo e suas regras."><AdminPromotions/></Section>
  </div>}

  {activeTab==='system'&&<div className="space-y-4">
   <AdminSystemDashboard/>
   <Section title="Feature flags" description="Ative ou interrompa recursos com registro de motivo." open><AdminFeatureFlags/></Section>
   <Section title="Beta · catálogo e políticas" description="Elegibilidade, AUTO routing, policies e ledger econômico do ambiente Beta."><AdminBetaCatalog/></Section>
   <Section title="Auditoria" description="Histórico das alterações administrativas e rastreabilidade."><AdminAuditLogs/></Section>
  </div>}
 </div>;
};
