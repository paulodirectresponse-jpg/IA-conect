import React,{useEffect,useMemo,useState}from'react';
import{Activity,Flag,History,ShieldCheck}from'lucide-react';
import{adminService,SystemHealthSnapshot}from'../../services/adminService.js';
import{FeatureFlag}from'../../types/index.js';
import{AdminDonutChart,AdminRankedBars}from'./AdminVisualCharts.js';

export const AdminSystemDashboard:React.FC=()=>{
 const[health,setHealth]=useState<SystemHealthSnapshot|null>(null),[flags,setFlags]=useState<FeatureFlag[]>([]),[auditCount,setAuditCount]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([adminService.getSystemHealth(),adminService.listFeatureFlags(),adminService.listAuditLogs('',5,0)]).then(([h,f,a])=>{setHealth(h);setFlags(f);setAuditCount(a.total)}).catch(console.error).finally(()=>setLoading(false))},[]);
 const checks=health?.checks||[];
 const ok=checks.filter(c=>c.status==='OK').length,degraded=checks.filter(c=>c.status==='DEGRADED').length,error=checks.filter(c=>c.status==='ERROR').length;
 const enabled=flags.filter(f=>f.is_enabled).length,disabled=Math.max(0,flags.length-enabled);
 const recent=useMemo(()=>checks.filter(c=>c.status!=='OK'),[checks]);
 const riskRows=useMemo(()=>checks.map(check=>({label:check.label,value:check.status==='ERROR'?100:check.status==='DEGRADED'?55:8,detail:check.status,color:check.status==='ERROR'?'#fb7185':check.status==='DEGRADED'?'#f59e0b':'#34d399'})).sort((a,b)=>b.value-a.value).slice(0,8),[checks]);
 return <div className="space-y-4">
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><ShieldCheck className="w-4 h-4"/>Saúde</div><div className="mt-2 text-xl font-black text-white">{loading?'—':health?.status||'—'}</div><p className="text-[10px] text-zinc-500 mt-1">{ok}/{checks.length} checks OK</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Flag className="w-4 h-4"/>Feature flags</div><div className="mt-2 text-xl font-black text-white">{loading?'—':enabled}</div><p className="text-[10px] text-zinc-500 mt-1">de {flags.length} habilitadas</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Activity className="w-4 h-4"/>Degradados / erros</div><div className="mt-2 text-xl font-black text-white">{loading?'—':`${degraded} / ${error}`}</div><p className="text-[10px] text-zinc-500 mt-1">checks que pedem atenção</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><History className="w-4 h-4"/>Auditoria</div><div className="mt-2 text-xl font-black text-white">{loading?'—':auditCount.toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">eventos registrados</p></div></div>
  <div className="grid xl:grid-cols-2 gap-4">
   <AdminDonutChart title="Saúde técnica" subtitle="Distribuição dos checks operacionais" center={`${ok}/${checks.length||0}`} segments={[{label:'OK',value:ok,color:'#34d399'},{label:'Degradado',value:degraded,color:'#f59e0b'},{label:'Erro',value:error,color:'#fb7185'}]}/>
   <AdminDonutChart title="Feature flags" subtitle="Recursos ligados e pausados" center={`${enabled}/${flags.length}`} segments={[{label:'Ligadas',value:enabled,color:'#38bdf8'},{label:'Desligadas',value:disabled,color:'#52525b'}]}/>
  </div>
  <AdminRankedBars title="Mapa de risco técnico" subtitle="Erros e degradações sobem para o topo; checks OK ficam em baixa prioridade visual." rows={riskRows}/>
  {recent.length>0&&<section className="ia-admin-panel"><h3 className="text-xs font-black text-white">Atenção técnica</h3><div className="mt-3 grid md:grid-cols-2 gap-2">{recent.map(c=><div key={c.key} className="rounded-xl border border-white/[0.06] p-3"><div className="flex items-center justify-between gap-3 text-[9px]"><span className="font-bold text-zinc-300">{c.label}</span><span className={c.status==='ERROR'?'text-rose-300':'text-amber-300'}>{c.status}</span></div><p className="mt-1 text-[9px] text-zinc-600">{c.detail}</p></div>)}</div></section>}
 </div>;
};
