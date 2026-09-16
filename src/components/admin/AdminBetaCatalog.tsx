import React,{useEffect,useMemo,useState}from'react';
import{Activity,RefreshCw,Route,Save,Shield,ToggleLeft,ToggleRight}from'lucide-react';
import{adminService,BetaCatalogAdminModel,BetaEconomicLedgerAdmin,BetaPricingPolicyAdmin}from'../../services/adminService.js';
import{FeatureFlag}from'../../types/index.js';

const fmt=(v:any)=>Number(v||0).toLocaleString('pt-BR');
const short=(v:string)=>v.length>18?`${v.slice(0,8)}…${v.slice(-6)}`:v;

export const AdminBetaCatalog:React.FC=()=>{
 const[catalog,setCatalog]=useState<BetaCatalogAdminModel[]>([]);
 const[policies,setPolicies]=useState<BetaPricingPolicyAdmin[]>([]);
 const[flags,setFlags]=useState<FeatureFlag[]>([]);
 const[ledger,setLedger]=useState<BetaEconomicLedgerAdmin[]>([]);
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState<string|null>(null);
 const[error,setError]=useState('');
 const[newPolicy,setNewPolicy]=useState({pricing_policy_id:'',name:'',quote_ttl_seconds:600,active:true});

 const load=async()=>{
  setLoading(true);setError('');
  try{
   const[c,p,f,l]=await Promise.all([adminService.listBetaCatalog(),adminService.listBetaPricingPolicies(),adminService.listFeatureFlags(),adminService.listBetaEconomicLedger(100)]);
   setCatalog(c);setPolicies(p);setFlags(f);setLedger(l);
  }catch(err:any){setError(err?.message||'Falha ao carregar governança Beta.')}
  finally{setLoading(false)}
 };
 useEffect(()=>{void load()},[]);

 const betaFlags=useMemo(()=>flags.filter(flag=>['beta.execution.enabled','beta.auto_router.enabled'].includes(flag.flag_key)),[flags]);

 const saveModel=async(model:BetaCatalogAdminModel,patch:Partial<BetaCatalogAdminModel>)=>{
  setSaving(model.model_id);setError('');
  try{
   const updated=await adminService.updateBetaModelPolicy(model.model_id,{
    pricing_policy_id:patch.pricing_policy_id??model.pricing_policy_id,
    capability_ids:patch.capability_ids??model.capability_ids,
    enabled:patch.enabled??model.enabled,
    auto_routing_enabled:patch.auto_routing_enabled??model.auto_routing_enabled,
    reason:'Admin PR-07',
   });
   setCatalog(rows=>rows.map(row=>row.model_id===updated.model_id?updated:row));
  }catch(err:any){setError(err?.message||'Falha ao salvar modelo.')}
  finally{setSaving(null)}
 };

 const savePolicy=async(policy:BetaPricingPolicyAdmin)=>{
  setSaving(`policy:${policy.pricing_policy_id}`);setError('');
  try{
   const saved=await adminService.saveBetaPricingPolicy({...policy,reason:'Admin PR-07'});
   setPolicies(rows=>rows.map(row=>row.pricing_policy_id===saved.pricing_policy_id?saved:row));
   setCatalog(await adminService.listBetaCatalog());
  }catch(err:any){setError(err?.message||'Falha ao salvar política.')}
  finally{setSaving(null)}
 };

 const createPolicy=async()=>{
  if(!newPolicy.pricing_policy_id.trim()||!newPolicy.name.trim())return;
  setSaving('policy:new');setError('');
  try{
   const saved=await adminService.saveBetaPricingPolicy({...newPolicy,reason:'Criação administrativa PR-07'});
   setPolicies(rows=>[...rows.filter(row=>row.pricing_policy_id!==saved.pricing_policy_id),saved]);
   setNewPolicy({pricing_policy_id:'',name:'',quote_ttl_seconds:600,active:true});
  }catch(err:any){setError(err?.message||'Falha ao criar política.')}
  finally{setSaving(null)}
 };

 const toggleFlag=async(flag:FeatureFlag)=>{
  setSaving(`flag:${flag.flag_key}`);setError('');
  try{
   const saved=await adminService.toggleFeatureFlag(flag.flag_key,!flag.is_enabled,'Kill switch PR-07');
   setFlags(rows=>rows.map(row=>row.flag_key===saved.flag_key?saved:row));
  }catch(err:any){setError(err?.message||'Falha ao alterar kill switch.')}
  finally{setSaving(null)}
 };

 return <div className="space-y-5 text-zinc-100">
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
   <div><h2 className="text-base font-black text-white">Beta · Catálogo & economia</h2><p className="text-[10px] text-zinc-500 mt-1">Elegibilidade, capabilities, políticas de quote, AUTO router e ledger econômico.</p></div>
   <button onClick={()=>void load()} className="h-8 px-3 rounded-lg border border-white/[0.07] text-[9px] font-bold text-zinc-400 flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>Atualizar</button>
  </div>

  {error&&<div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-3 text-[10px] text-rose-300">{error}</div>}

  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
   <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-sky-300"/><div><h3 className="text-xs font-bold">Kill switches</h3><p className="text-[9px] text-zinc-600">Pausa execução Beta ou somente o AUTO sem mexer na Stable.</p></div></div>
   <div className="mt-3 grid sm:grid-cols-2 gap-2">
    {betaFlags.map(flag=><button key={flag.flag_key} disabled={Boolean(saving)} onClick={()=>void toggleFlag(flag)} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left">
      <div><p className="text-[10px] font-bold text-zinc-200">{flag.name}</p><p className="text-[8px] text-zinc-600 mt-1">{flag.flag_key}</p></div>
      {flag.is_enabled?<ToggleRight className="w-5 h-5 text-emerald-300"/>:<ToggleLeft className="w-5 h-5 text-zinc-600"/>}
    </button>)}
   </div>
  </section>

  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
   <div className="px-4 py-3 border-b border-white/[0.06]"><h3 className="text-xs font-bold">Políticas de quote</h3><p className="text-[9px] text-zinc-600 mt-1">Controlam TTL e ativação. Não definem preço em créditos.</p></div>
   <div className="divide-y divide-white/[0.05]">
    {policies.map(policy=><div key={policy.pricing_policy_id} className="grid md:grid-cols-[1fr_130px_90px_90px] gap-2 items-center p-3">
      <div><p className="text-[10px] font-bold text-zinc-200">{policy.name}</p><p className="text-[8px] text-zinc-600">{policy.pricing_policy_id}</p></div>
      <label className="text-[8px] text-zinc-600">TTL (s)<input type="number" min={30} max={3600} value={policy.quote_ttl_seconds} onChange={e=>setPolicies(rows=>rows.map(row=>row.pricing_policy_id===policy.pricing_policy_id?{...row,quote_ttl_seconds:Number(e.target.value)}:row))} className="mt-1 h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[10px] text-white"/></label>
      <button onClick={()=>setPolicies(rows=>rows.map(row=>row.pricing_policy_id===policy.pricing_policy_id?{...row,active:!row.active}:row))} className={`h-8 rounded-lg border text-[9px] font-bold ${policy.active?'border-emerald-300/15 text-emerald-300':'border-white/[0.08] text-zinc-500'}`}>{policy.active?'Ativa':'Inativa'}</button>
      <button disabled={saving===`policy:${policy.pricing_policy_id}`} onClick={()=>void savePolicy(policy)} className="h-8 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] text-[9px] font-bold text-sky-200 flex items-center justify-center gap-1.5"><Save className="w-3 h-3"/>Salvar</button>
    </div>)}
   </div>
   <div className="grid md:grid-cols-[1fr_1fr_120px_90px] gap-2 p-3 border-t border-white/[0.06]">
    <input value={newPolicy.pricing_policy_id} onChange={e=>setNewPolicy(v=>({...v,pricing_policy_id:e.target.value}))} placeholder="beta-policy-id" className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] text-white"/>
    <input value={newPolicy.name} onChange={e=>setNewPolicy(v=>({...v,name:e.target.value}))} placeholder="Nome da política" className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] text-white"/>
    <input type="number" min={30} max={3600} value={newPolicy.quote_ttl_seconds} onChange={e=>setNewPolicy(v=>({...v,quote_ttl_seconds:Number(e.target.value)}))} className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] text-white"/>
    <button disabled={saving==='policy:new'} onClick={()=>void createPolicy()} className="h-8 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] text-[9px] font-bold text-sky-200">Criar</button>
   </div>
  </section>

  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
   <div className="px-4 py-3 border-b border-white/[0.06]"><h3 className="text-xs font-bold">Elegibilidade por modelo</h3><p className="text-[9px] text-zinc-600 mt-1">Capabilities permitidas e participação no AUTO são independentes do provider.</p></div>
   <div className="divide-y divide-white/[0.05]">
    {catalog.map(model=><div key={model.model_id} className="p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
       <div><div className="flex items-center gap-2"><p className="text-[10px] font-bold text-zinc-100">{model.name}</p><span className={`text-[8px] font-bold ${model.eligible?'text-emerald-300':'text-zinc-600'}`}>{model.eligible?'ELIGÍVEL':'BLOQUEADO'}</span></div><p className="text-[8px] text-zinc-600 mt-1">{model.model_id} · {model.category}</p></div>
       <div className="flex flex-wrap items-center gap-2">
        <select value={model.pricing_policy_id} onChange={e=>void saveModel(model,{pricing_policy_id:e.target.value})} disabled={Boolean(saving)} className="h-8 rounded-lg border border-white/[0.08] bg-[#0d1722] px-2 text-[9px] text-white">{policies.map(p=><option key={p.pricing_policy_id} value={p.pricing_policy_id}>{p.name}</option>)}</select>
        <button disabled={Boolean(saving)} onClick={()=>void saveModel(model,{enabled:!model.enabled})} className={`h-8 px-2.5 rounded-lg border text-[8px] font-bold ${model.enabled?'border-emerald-300/15 text-emerald-300':'border-white/[0.08] text-zinc-600'}`}>{model.enabled?'Beta ON':'Beta OFF'}</button>
        <button disabled={Boolean(saving)} onClick={()=>void saveModel(model,{auto_routing_enabled:!model.auto_routing_enabled})} className={`h-8 px-2.5 rounded-lg border text-[8px] font-bold flex items-center gap-1.5 ${model.auto_routing_enabled?'border-sky-300/15 text-sky-300':'border-white/[0.08] text-zinc-600'}`}><Route className="w-3 h-3"/>AUTO {model.auto_routing_enabled?'ON':'OFF'}</button>
       </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
       {model.supported_capability_ids.map(cap=>{
        const active=model.capability_ids.includes(cap);
        return <button key={cap} disabled={Boolean(saving)} onClick={()=>void saveModel(model,{capability_ids:active?model.capability_ids.filter(id=>id!==cap):[...model.capability_ids,cap]})} className={`rounded-full border px-2 py-1 text-[7px] font-bold ${active?'border-sky-300/15 bg-sky-300/[0.06] text-sky-200':'border-white/[0.06] text-zinc-600'}`}>{cap}</button>
       })}
      </div>
     </div>)}
   </div>
  </section>

  <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
   <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2"><Activity className="w-4 h-4 text-sky-300"/><div><h3 className="text-xs font-bold">Economic ledger Beta</h3><p className="text-[9px] text-zinc-600 mt-1">Eventos de quote e execução; o Credit Ledger continua sendo a autoridade de saldo.</p></div></div>
   <div className="overflow-x-auto"><table className="w-full text-[9px]"><thead className="border-b border-white/[0.05] text-zinc-600"><tr><th className="px-4 py-3 text-left">Evento</th><th className="px-3 py-3 text-left">Job</th><th className="px-3 py-3 text-left">Modelo</th><th className="px-3 py-3 text-left">Rota</th><th className="px-3 py-3 text-right">Créditos</th><th className="px-4 py-3 text-right">Data</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{ledger.map(row=><tr key={row.event_id}><td className="px-4 py-3 text-zinc-300">{row.event_type}</td><td className="px-3 py-3 font-mono text-zinc-600">{short(row.job_id)}</td><td className="px-3 py-3 text-zinc-400">{row.selected_model_id}</td><td className="px-3 py-3 text-zinc-500">{row.routing_mode}</td><td className="px-3 py-3 text-right text-zinc-300">{fmt(row.credit_price)}</td><td className="px-4 py-3 text-right text-zinc-600 whitespace-nowrap">{new Date(row.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>
  </section>
 </div>
};
