import React,{useEffect,useMemo,useState}from'react';
import{Activity,AlertTriangle,Coins,Server,Users,WalletCards}from'lucide-react';
import{adminService,ProviderFinanceSnapshot,SystemHealthSnapshot}from'../../services/adminService.js';
import{formatCentsToBRL}from'../../config/constants.js';

const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const fmt=(n:any)=>Number(n||0).toLocaleString('pt-BR');

export const AdminOverviewDashboard:React.FC=()=>{
 const[stats,setStats]=useState<any>(null),[health,setHealth]=useState<SystemHealthSnapshot|null>(null),[economics,setEconomics]=useState<any>(null),[finance,setFinance]=useState<ProviderFinanceSnapshot[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;(async()=>{try{const[s,h,e,f]=await Promise.all([adminService.getDashboardStats(),adminService.getSystemHealth(),adminService.getEconomicsOverview('30d'),adminService.getProviderFinance(false)]);if(!alive)return;setStats(s);setHealth(h);setEconomics(e);setFinance(f.providers||[])}catch(err){console.error('Falha ao carregar visão geral administrativa:',err)}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
 const healthSummary=useMemo(()=>{const checks=health?.checks||[];return{ok:checks.filter(c=>c.status==='OK').length,degraded:checks.filter(c=>c.status==='DEGRADED').length,error:checks.filter(c=>c.status==='ERROR').length,total:checks.length}},[health]);
 const providerSummary=useMemo(()=>({operational:finance.filter(p=>p.status==='OPERATIONAL').length,low:finance.filter(p=>p.status==='LOW_BALANCE').length,unavailable:finance.filter(p=>p.status==='UNAVAILABLE'||p.status==='NOT_CONFIGURED').length,total:finance.length}),[finance]);
 const activePct=stats?.total_users?clamp((Number(stats.active_users||0)/Number(stats.total_users))*100):0;
 const marginPct=clamp(Number(economics?.consumption?.margin_percent||0));
 const providerOkPct=providerSummary.total?clamp((providerSummary.operational/providerSummary.total)*100):0;
 const systemOkPct=healthSummary.total?clamp((healthSummary.ok/healthSummary.total)*100):0;
 const bars=[
  {label:'Usuários ativos',value:activePct,detail:`${fmt(stats?.active_users)} de ${fmt(stats?.total_users)}`},
  {label:'Margem técnica',value:marginPct,detail:`${Number(economics?.consumption?.margin_percent||0).toFixed(1)}%`},
  {label:'Providers operacionais',value:providerOkPct,detail:`${providerSummary.operational} de ${providerSummary.total||0}`},
  {label:'Saúde do sistema',value:systemOkPct,detail:`${healthSummary.ok} de ${healthSummary.total||0} checks OK`},
 ];
 return <div className="space-y-5">
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><Users className="w-4 h-4"/>Usuários</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':fmt(stats?.total_users)}</div><p className="mt-1 text-[10px] text-zinc-500">{fmt(stats?.active_users)} ativos</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><WalletCards className="w-4 h-4"/>Caixa líquido · 30d</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':formatCentsToBRL(economics?.cash?.net_cents||0)}</div><p className="mt-1 text-[10px] text-zinc-500">COGS {formatCentsToBRL(economics?.consumption?.cogs_cents||0)}</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><Coins className="w-4 h-4"/>Margem técnica · 30d</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':`${Number(economics?.consumption?.margin_percent||0).toFixed(1)}%`}</div><p className="mt-1 text-[10px] text-zinc-500">Contribuição {formatCentsToBRL(economics?.consumption?.contribution_cents||0)}</p></div>
   <div className="ia-admin-panel"><div className="flex items-center gap-2 text-[10px] text-zinc-500"><Server className="w-4 h-4"/>Providers</div><div className="mt-2 text-2xl font-black text-white">{loading?'—':`${providerSummary.operational}/${providerSummary.total}`}</div><p className="mt-1 text-[10px] text-zinc-500">{providerSummary.low} saldo baixo · {providerSummary.unavailable} indisponíveis</p></div>
  </div>
  <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-4">
   <section className="ia-admin-panel"><div className="flex items-center justify-between gap-3"><div><h2>Leitura rápida do negócio</h2><p>Indicadores sincronizados das fontes operacionais, financeiras e de providers.</p></div><Activity className="w-4 h-4 text-sky-300"/></div><div className="mt-5 space-y-4">{bars.map(b=><div key={b.label}><div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-semibold text-zinc-300">{b.label}</span><span className="text-zinc-500">{b.detail}</span></div><div className="mt-2 h-2 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full bg-sky-400/70 transition-all" style={{width:`${b.value}%`}}/></div></div>)}</div></section>
   <section className="ia-admin-panel"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-300"/><div><h2>Alertas</h2><p>O que merece atenção agora.</p></div></div><div className="mt-4 space-y-2 text-[10px]">{providerSummary.low>0&&<div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-amber-200">{providerSummary.low} provider(s) com saldo baixo.</div>}{providerSummary.unavailable>0&&<div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-rose-200">{providerSummary.unavailable} provider(s) indisponível(is) ou sem configuração.</div>}{healthSummary.degraded>0&&<div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-amber-200">{healthSummary.degraded} check(s) do sistema degradados.</div>}{healthSummary.error>0&&<div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-rose-200">{healthSummary.error} check(s) do sistema em erro.</div>}{!loading&&providerSummary.low===0&&providerSummary.unavailable===0&&healthSummary.degraded===0&&healthSummary.error===0&&<div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-emerald-200">Nenhum alerta operacional relevante no momento.</div>}</div></section>
  </div>
 </div>;
};
