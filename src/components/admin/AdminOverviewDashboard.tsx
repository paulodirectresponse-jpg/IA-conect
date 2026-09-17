import React,{useEffect,useMemo,useState}from'react';
import{Activity,AlertTriangle,Coins,Server,Users,WalletCards}from'lucide-react';
import{adminService,ProviderFinanceSnapshot,SystemHealthSnapshot}from'../../services/adminService.js';
import{formatCentsToBRL}from'../../config/constants.js';
import{AdminAreaChart,AdminDonutChart}from'./AdminVisualCharts.js';

const fmt=(n:any)=>Number(n||0).toLocaleString('pt-BR');
const dayKey=(value:string)=>new Date(value).toISOString().slice(0,10);
const dayLabel=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

export const AdminOverviewDashboard:React.FC=()=>{
 const[stats,setStats]=useState<any>(null),[health,setHealth]=useState<SystemHealthSnapshot|null>(null),[economics,setEconomics]=useState<any>(null),[finance,setFinance]=useState<ProviderFinanceSnapshot[]>([]),[generations,setGenerations]=useState<any[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;(async()=>{try{const[s,h,e,f,g]=await Promise.all([adminService.getDashboardStats(),adminService.getSystemHealth(),adminService.getEconomicsOverview('30d'),adminService.getProviderFinance(false),adminService.getEconomicsGenerations('30d',300)]);if(!alive)return;setStats(s);setHealth(h);setEconomics(e);setFinance(f.providers||[]);setGenerations(g||[])}catch(err){console.error('Falha ao carregar visão geral administrativa:',err)}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
 const healthSummary=useMemo(()=>{const checks=health?.checks||[];return{ok:checks.filter(c=>c.status==='OK').length,degraded:checks.filter(c=>c.status==='DEGRADED').length,error:checks.filter(c=>c.status==='ERROR').length,total:checks.length}},[health]);
 const providerSummary=useMemo(()=>({operational:finance.filter(p=>p.status==='OPERATIONAL').length,low:finance.filter(p=>p.status==='LOW_BALANCE').length,unavailable:finance.filter(p=>p.status==='UNAVAILABLE'||p.status==='NOT_CONFIGURED').length,total:finance.length}),[finance]);
 const timeline=useMemo(()=>{const map=new Map<string,{backing:number;cogs:number}>();for(const row of generations){const key=dayKey(row.created_at);const current=map.get(key)||{backing:0,cogs:0};current.backing+=Number(row.backing_cents||0);current.cogs+=Number(row.cogs_cents||0);map.set(key,current)}const keys=[...map.keys()].sort().slice(-14);return{labels:keys.map(dayLabel),backing:keys.map(k=>(map.get(k)?.backing||0)/100),cogs:keys.map(k=>(map.get(k)?.cogs||0)/100)}},[generations]);
 const alertCount=providerSummary.low+providerSummary.unavailable+healthSummary.degraded+healthSummary.error;
 return <div className="space-y-5">
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><Users className="w-4 h-4"/>Usuários</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':fmt(stats?.total_users)}</div><p className="mt-1 text-[10px] text-zinc-500">{fmt(stats?.active_users)} ativos</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><WalletCards className="w-4 h-4"/>Caixa líquido · 30d</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':formatCentsToBRL(economics?.cash?.net_cents||0)}</div><p className="mt-1 text-[10px] text-zinc-500">COGS {formatCentsToBRL(economics?.consumption?.cogs_cents||0)}</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><Coins className="w-4 h-4"/>Margem técnica · 30d</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':`${Number(economics?.consumption?.margin_percent||0).toFixed(1)}%`}</div><p className="mt-1 text-[10px] text-zinc-500">Contribuição {formatCentsToBRL(economics?.consumption?.contribution_cents||0)}</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><AlertTriangle className="w-4 h-4"/>Alertas ativos</div><div className={`mt-2 text-2xl font-black ${alertCount?'text-amber-300':'text-emerald-300'}`}>{loading?'—':alertCount}</div><p className="mt-1 text-[10px] text-zinc-500">providers + sistema</p></div>
  </div>

  <AdminAreaChart title="Pulso econômico · últimos dias" subtitle="Backing autorizado versus COGS realizado. Quanto maior a distância entre as curvas, melhor a contribuição." labels={timeline.labels} series={[{name:'Backing',values:timeline.backing,color:'#38bdf8',format:v=>`R$ ${v.toFixed(2)}`},{name:'COGS',values:timeline.cogs,color:'#fb7185',format:v=>`R$ ${v.toFixed(2)}`} ]}/>

  <div className="grid xl:grid-cols-2 gap-4">
   <AdminDonutChart title="Saúde operacional" subtitle="Checks da arquitetura ativa" center={`${healthSummary.ok}/${healthSummary.total||0}`} segments={[{label:'OK',value:healthSummary.ok,color:'#34d399'},{label:'Degradado',value:healthSummary.degraded,color:'#f59e0b'},{label:'Erro',value:healthSummary.error,color:'#fb7185'}]}/>
   <AdminDonutChart title="Disponibilidade de providers" subtitle="Situação financeira e operacional" center={`${providerSummary.operational}/${providerSummary.total||0}`} segments={[{label:'Operacional',value:providerSummary.operational,color:'#38bdf8'},{label:'Saldo baixo',value:providerSummary.low,color:'#f59e0b'},{label:'Indisponível / sem chave',value:providerSummary.unavailable,color:'#fb7185'}]}/>
  </div>

  <section className="ia-admin-panel"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-sky-300"/><div><h2>Leitura executiva</h2><p>O que exige ação sem precisar abrir as outras abas.</p></div></div><div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[10px]">{providerSummary.low>0&&<div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-amber-200">{providerSummary.low} provider(s) com saldo baixo.</div>}{providerSummary.unavailable>0&&<div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-rose-200">{providerSummary.unavailable} provider(s) indisponível(is) ou sem configuração.</div>}{healthSummary.degraded>0&&<div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-amber-200">{healthSummary.degraded} check(s) degradados.</div>}{healthSummary.error>0&&<div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-rose-200">{healthSummary.error} check(s) em erro.</div>}{!loading&&alertCount===0&&<div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-emerald-200">Nenhum alerta operacional relevante no momento.</div>}</div></section>
 </div>;
};
