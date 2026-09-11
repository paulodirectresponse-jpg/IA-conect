import React,{useEffect,useState}from'react';
import{AlertCircle,CheckCircle2,Clock,Loader2,PlayCircle}from'lucide-react';
import{Generation}from'../../types/index.js';
import{generationClient}from'../../services/generationClient.js';

const credits=(v?:number)=>`${Math.max(0,Number(v||0)).toLocaleString('pt-BR')} créditos`;
const isImage=(g:Generation)=>g.mode==='TEXT_TO_IMAGE'||g.mode==='IMAGE_TO_IMAGE';

export const HistoryView:React.FC=()=>{
 const[items,setItems]=useState<Generation[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{generationClient.list().then(setItems).catch(e=>setError(e?.message||'Falha ao carregar histórico.')).finally(()=>setLoading(false))},[]);
 return <div className="ia-history space-y-6 pb-10">
  <header><p className="ia-label">Criações</p><h1 className="ia-page-title mt-2">Histórico</h1><p className="ia-body mt-2">Resultados, status e créditos das suas gerações.</p></header>
  {loading?<div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--ia-text-3)]"/></div>
  :error?<div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-4 text-sm text-rose-300">{error}</div>
  :items.length===0?<div className="ia-dashboard-empty py-20"><Clock className="w-7 h-7 mx-auto text-[var(--ia-text-4)] mb-3"/><p className="font-medium text-[var(--ia-text-1)]">Nenhuma geração ainda</p></div>
  :<div className="grid gap-2.5">{items.map(g=><article key={g.generation_id} className="ia-history-row">
    <div className="ia-history-media">{g.result_url?(isImage(g)?<img src={g.result_url} alt="" className="w-full h-full object-cover"/>:<video src={g.result_url} muted playsInline preload="metadata" className="w-full h-full object-cover"/>):g.status==='SUCCEEDED'?<CheckCircle2 className="w-5 h-5 text-emerald-400"/>:g.status==='FAILED'?<AlertCircle className="w-5 h-5 text-rose-400"/>:<Loader2 className="w-5 h-5 animate-spin text-[var(--ia-text-3)]"/>}</div>
    <div className="min-w-0 flex-1">
     <div className="flex items-center gap-2"><p className="text-[12px] font-semibold text-[var(--ia-text-1)] truncate">{g.model_id}</p><span className="ia-badge">{g.status}</span></div>
     <p className="mt-1 text-[11px] text-[var(--ia-text-3)] truncate">{g.original_prompt||'Sem prompt'}</p>
     <p className="mt-1 text-[9px] text-[var(--ia-text-4)]">{g.duration_seconds}s · {g.resolution} · {new Date(g.created_at).toLocaleString('pt-BR')}</p>
    </div>
    <div className="shrink-0 text-right"><p className="text-[11px] font-semibold text-[var(--ia-text-2)]">{credits(g.final_credit_cost??g.retail_credit_price)}</p>{g.result_url&&<a href={g.result_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200"><PlayCircle className="w-3 h-3"/>Abrir</a>}</div>
   </article>)}</div>}
 </div>;
};
