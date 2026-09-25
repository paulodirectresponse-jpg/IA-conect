import React,{useEffect,useMemo,useState}from'react';
import{Activity,Coins,TrendingUp,WalletCards}from'lucide-react';
import{adminService,ProviderFinanceSnapshot}from'../../services/adminService.js';
import{formatCentsToBRL}from'../../config/constants.js';
import{AdminAreaChart,AdminDonutChart,AdminRankedBars}from'./AdminVisualCharts.js';
import{CreditAmount}from'../common/CreditAmount.js';

const pct=(v:any)=>Number(v||0);
const dayKey=(value:string)=>new Date(value).toISOString().slice(0,10);
const dayLabel=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
const moneyNumber=(cents:any)=>Number(cents||0)/100;

export const AdminFinanceDashboard:React.FC=()=>{
 const[data,setData]=useState<any>(null),[providers,setProviders]=useState<ProviderFinanceSnapshot[]>([]),[generations,setGenerations]=useState<any[]>([]),[loading,setLoading]=useState(true),[range,setRange]=useState('30d');
 const load=async()=>{setLoading(true);try{const[e,f,g]=await Promise.all([adminService.getEconomicsOverview(range),adminService.getProviderFinance(false),adminService.getEconomicsGenerations(range,500)]);setData(e);setProviders(f.providers||[]);setGenerations(g||[])}finally{setLoading(false)}};
 useEffect(()=>{load().catch(console.error)},[range]);
 const providerRows=useMemo(()=>providers.filter(p=>p.balance_brl_cents!=null).sort((a,b)=>Number(b.balance_brl_cents||0)-Number(a.balance_brl_cents||0)),[providers]);
 const modelRows=useMemo(()=>((data?.by_model||[]) as any[]).slice().sort((a,b)=>Number(b.cogs_cents||0)-Number(a.cogs_cents||0)).slice(0,8),[data]);
 const timeline=useMemo(()=>{const map=new Map<string,{backing:number;cogs:number;contribution:number}>();for(const row of generations){const key=dayKey(row.created_at);const current=map.get(key)||{backing:0,cogs:0,contribution:0};current.backing+=moneyNumber(row.backing_cents);current.cogs+=moneyNumber(row.cogs_cents);current.contribution+=moneyNumber(row.backing_cents)-moneyNumber(row.cogs_cents);map.set(key,current)}const keys=[...map.keys()].sort();return{labels:keys.map(dayLabel),backing:keys.map(k=>map.get(k)?.backing||0),cogs:keys.map(k=>map.get(k)?.cogs||0),contribution:keys.map(k=>map.get(k)?.contribution||0)}},[generations]);
 const providerSegments=useMemo(()=>[
  {label:'Operacional',value:providers.filter(p=>p.status==='OPERATIONAL').length,color:'#34d399'},
  {label:'Saldo baixo',value:providers.filter(p=>p.status==='LOW_BALANCE').length,color:'#f59e0b'},
  {label:'Indisponível',value:providers.filter(p=>p.status==='UNAVAILABLE').length,color:'#fb7185'},
  {label:'Sem configuração',value:providers.filter(p=>p.status==='NOT_CONFIGURED').length,color:'#71717a'},
 ],[providers]);
 return <div className="space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-sm font-black text-white">Inteligência financeira</h2><p className="text-[10px] text-zinc-500 mt-1">Fluxo de caixa, COGS, contribuição, providers e concentração de custo em uma leitura única.</p></div><div className="flex gap-2">{['7d','30d','90d'].map(r=><button key={r} onClick={()=>setRange(r)} className={`h-8 px-3 rounded-lg border text-[9px] font-bold ${range===r?'border-sky-300/25 bg-sky-300/[0.08] text-sky-200':'border-white/[0.07] text-zinc-500'}`}>{r}</button>)}</div></div>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><WalletCards className="w-4 h-4"/>Caixa líquido</div><div className="mt-2 text-xl font-black text-white">{loading?'—':formatCentsToBRL(data?.cash?.net_cents||0)}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Activity className="w-4 h-4"/>COGS</div><div className="mt-2 text-xl font-black text-white">{loading?'—':formatCentsToBRL(data?.consumption?.cogs_cents||0)}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><TrendingUp className="w-4 h-4"/>Margem</div><div className="mt-2 text-xl font-black text-white">{loading?'—':`${pct(data?.consumption?.margin_percent).toFixed(1)}%`}</div></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Coins className="w-4 h-4"/>Créditos em circulação</div><div className="mt-2 text-xl font-black text-white">{loading?'—':<CreditAmount value={Number(data?.credits?.in_circulation||0)} size="md" className="font-black text-white"/>}</div></div></div>

  <AdminAreaChart title="Backing, COGS e contribuição" subtitle="Evolução diária do período selecionado." labels={timeline.labels} series={[{name:'Backing',values:timeline.backing,color:'#38bdf8',format:v=>`R$ ${v.toFixed(2)}`},{name:'COGS',values:timeline.cogs,color:'#fb7185',format:v=>`R$ ${v.toFixed(2)}`},{name:'Contribuição',values:timeline.contribution,color:'#34d399',format:v=>`R$ ${v.toFixed(2)}`} ]}/>

  <div className="grid xl:grid-cols-[.72fr_1.28fr] gap-4">
   <AdminDonutChart title="Estado dos providers" subtitle="Disponibilidade financeira e operacional" center={`${providers.filter(p=>p.status==='OPERATIONAL').length}/${providers.length}`} segments={providerSegments}/>
   <AdminRankedBars title="Saldo disponível por provider" subtitle="Exposição de caixa por provider com saldo retornado via API." rows={providerRows.map((p,index)=>({label:p.provider_name,value:Number(p.balance_brl_cents||0),detail:p.low_balance?'saldo baixo':'operacional',color:p.low_balance?'#f59e0b':['#38bdf8','#a78bfa','#34d399','#22d3ee'][index%4]}))} format={value=>formatCentsToBRL(value)}/>
  </div>

  <AdminRankedBars title="Modelos que mais consomem COGS" subtitle="Ranking de custo real do período; a margem aparece ao lado para leitura imediata." rows={modelRows.map((r:any,index:number)=>({label:r.key,value:Number(r.cogs_cents||0),detail:`margem ${pct(r.margin_percent).toFixed(1)}%`,color:pct(r.margin_percent)<25?'#fb7185':pct(r.margin_percent)<35?'#f59e0b':['#a78bfa','#38bdf8','#34d399'][index%3]}))} format={value=>formatCentsToBRL(value)}/>
 </div>;
};
