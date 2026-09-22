import React,{useMemo,useState}from'react';
import{
 Activity,BrainCircuit,ChevronRight,Coins,Command,LayoutDashboard,Settings2,ShieldCheck,Sparkles,Users
}from'lucide-react';
import{AdminOverviewDashboard}from'../admin/AdminOverviewDashboard.js';
import{AdminFinanceDashboard}from'../admin/AdminFinanceDashboard.js';
import{AdminUsersDashboard}from'../admin/AdminUsersDashboard.js';
import{AdminSystemDashboard}from'../admin/AdminSystemDashboard.js';
import{AdminUsersList}from'../admin/AdminUsersList.js';
import{AdminCoupons}from'../admin/AdminCoupons.js';
import{AdminEconomics}from'../admin/AdminEconomics.js';
import{AdminFeatureFlags}from'../admin/AdminFeatureFlags.js';
import{AdminAuditLogs}from'../admin/AdminAuditLogs.js';
import{AdminPromotions}from'../admin/AdminPromotions.js';
import{AdminRoutingV2}from'../admin/AdminRoutingV2.js';

type AdminTab='overview'|'ai-routing'|'finance'|'users'|'system';

const Section:React.FC<{title:string;description:string;open?:boolean;children:React.ReactNode}>=({title,description,open=false,children})=>
 <details open={open} className="group ia-admin-disclosure">
  <summary className="ia-admin-disclosure-summary">
   <div className="min-w-0">
    <h2>{title}</h2>
    <p>{description}</p>
   </div>
   <span className="ia-admin-disclosure-icon"><ChevronRight className="h-4 w-4"/></span>
  </summary>
  <div className="ia-admin-disclosure-body">{children}</div>
 </details>;

const pane=(active:boolean)=>active?'block':'hidden';

export const AdminView:React.FC=()=>{
 const[activeTab,setActiveTab]=useState<AdminTab>('overview');

 const tabs=useMemo(()=>[
  {id:'overview' as const,label:'Visão geral',short:'Saúde operacional e resumo executivo',icon:LayoutDashboard},
  {id:'ai-routing' as const,label:'IA & Roteamento',short:'Modelos, providers e rotas',icon:BrainCircuit},
  {id:'finance' as const,label:'Financeiro',short:'Receita, custos e margem',icon:Coins},
  {id:'users' as const,label:'Usuários',short:'Contas, créditos e benefícios',icon:Users},
  {id:'system' as const,label:'Sistema',short:'Flags, saúde e auditoria',icon:Settings2},
 ],[]);

 const active=tabs.find(tab=>tab.id===activeTab)??tabs[0];
 const ActiveIcon=active.icon;

 return <div className="ia-admin">
  <section className="ia-admin-hero">
   <div className="min-w-0">
    <div className="ia-admin-eyebrow"><ShieldCheck className="h-3.5 w-3.5"/>Central administrativa</div>
    <div className="mt-2 flex flex-wrap items-center gap-3">
     <h1>Administração</h1>
     <span className="ia-admin-status"><span/>Operacional</span>
    </div>
    <p>Controle operacional, econômico e técnico do IA Connect em uma visão organizada por responsabilidade.</p>
   </div>
   <div className="ia-admin-hero-meta">
    <div><span>Ambiente</span><strong>Produção</strong></div>
    <div><span>Escopo</span><strong>Admin</strong></div>
   </div>
  </section>

  <div className="ia-admin-layout">
   <aside className="ia-admin-nav" aria-label="Navegação administrativa">
    <div className="ia-admin-nav-heading"><Command className="h-3.5 w-3.5"/>Áreas</div>
    <div className="ia-admin-nav-list">
     {tabs.map(tab=>{
      const Icon=tab.icon,selected=activeTab===tab.id;
      return <button key={tab.id} type="button" onClick={()=>setActiveTab(tab.id)} className={`ia-admin-nav-item ${selected?'is-active':''}`} aria-current={selected?'page':undefined}>
       <span className="ia-admin-nav-icon"><Icon className="h-4 w-4"/></span>
       <span className="min-w-0 flex-1 text-left"><strong>{tab.label}</strong><small>{tab.short}</small></span>
       <ChevronRight className="h-3.5 w-3.5 ia-admin-nav-chevron"/>
      </button>;
     })}
    </div>
    <div className="ia-admin-nav-note">
     <Sparkles className="h-4 w-4"/>
     <div><strong>Painel unificado</strong><span>Dados administrativos e operacionais no mesmo fluxo.</span></div>
    </div>
   </aside>

   <main className="ia-admin-content">
    <header className="ia-admin-section-header">
     <div className="ia-admin-section-icon"><ActiveIcon className="h-5 w-5"/></div>
     <div><span>Administração</span><h2>{active.label}</h2><p>{active.short}</p></div>
    </header>

    <div className={pane(activeTab==='overview')} aria-hidden={activeTab!=='overview'}>
     <AdminOverviewDashboard/>
    </div>

    <div className={pane(activeTab==='ai-routing')} aria-hidden={activeTab!=='ai-routing'}>
     <AdminRoutingV2/>
    </div>

    <div className={pane(activeTab==='finance')} aria-hidden={activeTab!=='finance'}>
     <div className="space-y-4">
      <AdminFinanceDashboard/>
      <Section title="Economia detalhada" description="Ledger econômico, campanhas, subsídios, consumo por origem/modelo e gerações recentes.">
       <AdminEconomics/>
      </Section>
     </div>
    </div>

    <div className={pane(activeTab==='users')} aria-hidden={activeTab!=='users'}>
     <div className="space-y-4">
      <AdminUsersDashboard/>
      <Section title="Usuários & créditos" description="Contas, saldos, status e ajustes administrativos." open><AdminUsersList/></Section>
      <Section title="Cupons" description="Benefícios, regras de resgate, budgets e utilização."><AdminCoupons/></Section>
      <Section title="Promoções" description="Promoções persistentes do catálogo e suas regras."><AdminPromotions/></Section>
     </div>
    </div>

    <div className={pane(activeTab==='system')} aria-hidden={activeTab!=='system'}>
     <div className="space-y-4">
      <AdminSystemDashboard/>
      <Section title="Feature flags" description="Ative ou interrompa recursos com registro de motivo." open><AdminFeatureFlags/></Section>
      <Section title="Auditoria" description="Histórico das alterações administrativas e rastreabilidade."><AdminAuditLogs/></Section>
     </div>
    </div>
   </main>
  </div>
 </div>;
};
