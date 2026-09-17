import React,{useEffect,useMemo,useState}from'react';
import{Activity,Coins,TrendingUp,WalletCards}from'lucide-react';
import{adminService,ProviderFinanceSnapshot}from'../../services/adminService.js';
import{formatCentsToBRL}from'../../config/constants.js';

const pct=(v:any)=>Number(v||0);
const width=(v:number,max:number)=>max<=0?0:Math.max(2,Math.min(100,(v/max)*100));

export const AdminFinanceDashboard:React.FC=()=>{
 const[data,setData]=useState<any>(null),[providers,setProviders]=useState<ProviderFinanceSnapshot[]>([]),[loading,setLoading]=useState(true),[range,setRange]=useState('30d');
 const load=async()=>{setLoading(true);try{const[e,f]=await Promise.all([adminService.getEconomicsOverview(range),adminService.getProviderFinance(false)]);setData(e);setProviders(f.providers||[])}finally{setLoading(false)}};
 useEffect(()=>{load().catch(console.error)},[range]);
 const providerRows=useMemo(()=>providers.filter(p=>p.balance_brl_cents!=null).sort((a,b)=>Number(b.balance_brl_cents||0)-Number(a.balance_brl_cents||0)),[providers]);
 const maxBalance=Math.max(0,...providerRows.map(p=>Number(p.balance_brl_cents||0)));
 const modelRows=(data?.by_model||[]).slice().sort((a:any,b:any)=>Number(b.cogs_cents||0)-Number(a.cogs_cents||0)).slice(0,8);
 const maxCogs=Math.max(0,...modelRows.map((r:any)=>Number(r.cogs_cents||0)));
 return <div className="space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-sm font-black text-white">Inteligência financeira</h2><p className="text-[10px] text-zinc-500 mt-1">Custos, margem e exposição dos providers em uma leitura visual.</p></div><div className="flex gap-2">{['7d','30d','90d'].map(r=><button key={r} onClick={()=>setRange(r)} className={`h-8 px-3 rounded-lg border text-[9px] font-bold ${range===r?'border-sky-300/25 bg-sky-300/[0.08] text-sky-200':'border-white/[0.07] text-zinc-500'}`}>{r}</button>)}</div></div>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><WalletCards className="w-4 h-4"/>Caixa líquido</div><div className="mt-2 text-xl font-black text-white">{loading?'—':formatCentsToBRL(data?.cash?.net_cents||0)}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Activity className="w-4 h-4"/>COGS</div><div className="mt-2 text-xl font-black text-white">{loading?'—':formatCentsToBRL(data?.consumption?.cogs_cents||0)}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><TrendingUp className="w-4 h-4"/>Margem</div><div className="mt-2 text-xl font-black text-white">{loading?'—':`${pct(data?.consumption?.margin_percent).toFixed(1)}%`}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Coins className="w-4 h-4"/>Créditos em circulação</div><div className="mt-2 text-xl font-black text-white">{loading?'—':Number(data?.credits?.in_circulation||0).toLocaleString('pt-BR')}</div></div></div>
  <div className="grid xl:grid-cols-2 gap-4">
   <section className="ia-admin-panel"><h3 className="text-xs font-bold text-white">Saldo por provider</h3><p className="mt-1 text-[9px] text-zinc-600">Somente providers com saldo disponível via API.</p><div className="mt-4 space-y-3">{providerRows.length?providerRows.map(p=><div key={p.provider_id}><div className="flex items-center justify-between text-[9px]"><span className="font-semibold text-zinc-300">{p.provider_name}</span><span className={p.low_balance?'text-amber-300':'text-zinc-500'}>{formatCentsToBRL(p.balance_brl_cents||0)}</span></div><div className="mt-1.5 h-2 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full bg-sky-400/65 rounded-full" style={{width:`${width(Number(p.balance_brl_cents||0),maxBalance)}%`}}/></div></div>):<div className="text-[10px] text-zinc-600">Nenhum provider expõe saldo financeiro neste momento.</div>}</div></section>
   <section className="ia-admin-panel"><h3 className="text-xs font-bold text-white">COGS por modelo</h3><p className="mt-1 text-[9px] text-zinc-600">Modelos que mais consumiram custo no período.</p><div className="mt-4 space-y-3">{modelRows.length?modelRows.map((r:any)=><div key={r.key}><div className="flex items-center justify-between text-[9px]"><span className="font-semibold text-zinc-300 truncate max-w-[65%]">{r.key}</span><span className="text-zinc-500">{formatCentsToBRL(r.cogs_cents||0)} · {pct(r.margin_percent).toFixed(1)}%</span></div><div className="mt-1.5 h-2 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full bg-violet-400/60 rounded-full" style={{width:`${width(Number(r.cogs_cents||0),maxCogs)}%`}}/></div></div>):<div className="text-[10px] text-zinc-600">Ainda não há consumo suficiente no período.</div>}</div></section>
  </div>
 </div>;
};
