import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, Clock3, Activity, Database, ShieldCheck } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { apiRequest } from '../../services/apiClient.js';
import { ModelRegistryItem } from '../../types/index.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';

type LiveRow={
  key:string;provider_id:string;provider_name:string;model_id:string;mode:string;duration_seconds:number;resolution:string;
  provider_cost_brl_cents:number|null;customer_price_cents:number|null;margin_percent:number|null;
  status:'OK'|'FAILED';checked_at:string;error?:string;
};
type ProviderFinance={provider_id:string;provider_name:string;status:string;balance_brl_cents:number|null;low_balance?:boolean;error?:string;};
type SyncResult={checked_at:string|null;checked:number;healthy:number;failed:number;fx_rate:number|null;fx_source:string|null;cache_ttl_minutes:number;provider_finance:ProviderFinance[];rows:LiveRow[]};

export const AdminPricing:React.FC=()=>{
  const [data,setData]=useState<SyncResult|null>(null);
  const [models,setModels]=useState<ModelRegistryItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);setMessage('');
    try{
      const [snapshot,m]=await Promise.all([apiRequest<SyncResult>('/api/admin/pricing/live'),adminService.listModels()]);
      setData(snapshot);setModels(m);
    }catch(e:any){setMessage(e?.message||'Falha ao executar diagnóstico de preços.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);

  const syncNow=async()=>{
    setSyncing(true);setMessage('');
    try{const r=await apiRequest<SyncResult>('/api/admin/pricing/sync',{method:'POST'});setData(r);setMessage(`Verificação concluída: ${r.healthy} rota(s) saudável(is)${r.failed?` · ${r.failed} com falha`:''}.`);}catch(e:any){setMessage(e?.message||'Falha ao consultar os provedores.');}finally{setSyncing(false);}
  };

  const modelName=(id:string)=>models.find(m=>m.model_id===id)?.name||id;
  const rows=useMemo(()=>[...(data?.rows||[])].sort((a,b)=>modelName(a.model_id).localeCompare(modelName(b.model_id))||a.provider_name.localeCompare(b.provider_name)),[data,models]);

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h2 className="text-base font-semibold text-zinc-900 tracking-tight">Pricing Engine</h2><p className="text-xs text-zinc-500">Monitor operacional. O preço final é cotado novamente na configuração real antes de cada geração.</p></div>
      <Button id="btn-sync-pricing" variant="secondary" size="sm" onClick={syncNow} isLoading={syncing} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Verificar provedores agora</Button>
    </div>

    {message&&<div className="text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">{message}</div>}

    {loading?<Card id="pricing-loading"><div className="py-10 text-center text-xs text-zinc-400">Consultando APIs oficiais dos provedores...</div></Card>:<>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card id="pricing-health"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500"/><div><p className="text-[10px] uppercase text-zinc-400">Rotas saudáveis</p><p className="text-lg font-bold text-zinc-900">{data?.healthy||0}/{data?.checked||0}</p></div></div></Card>
        <Card id="pricing-margin"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500"/><div><p className="text-[10px] uppercase text-zinc-400">Margem global</p><p className="text-lg font-bold text-zinc-900">40%</p></div></div></Card>
        <Card id="pricing-cache"><div className="flex items-center gap-2"><Database className="w-4 h-4 text-cyan-500"/><div><p className="text-[10px] uppercase text-zinc-400">Cache de cotação</p><p className="text-lg font-bold text-zinc-900">{data?.cache_ttl_minutes||30} min</p></div></div></Card>
        <Card id="pricing-last"><div className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-zinc-500"/><div><p className="text-[10px] uppercase text-zinc-400">Última verificação</p><p className="text-xs font-semibold text-zinc-900">{data?.checked_at?new Date(data.checked_at).toLocaleString('pt-BR'):'—'}</p></div></div></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data?.provider_finance||[]).map(p=><Card id={`provider-${p.provider_id}`} key={p.provider_id}><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-zinc-900">{p.provider_name}</p><p className="text-[10px] text-zinc-500">Saldo do provider: {p.balance_brl_cents==null?'indisponível':formatCentsToBRL(p.balance_brl_cents)}</p></div><span className={`text-[10px] font-semibold ${p.status==='OPERATIONAL'?'text-emerald-600':p.status==='LOW_BALANCE'?'text-amber-600':'text-rose-600'}`}>{p.status}</span></div>{p.error&&<p className="mt-2 text-[10px] text-rose-600">{p.error}</p>}</Card>)}
      </div>

      <Card id="admin-pricing-card"><div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500"><th className="py-3 px-4 sm:px-6">Modelo</th><th className="py-3 px-4">Provider</th><th className="py-3 px-4">Configuração de referência</th><th className="py-3 px-4 text-right">Custo provider</th><th className="py-3 px-4 text-right">Preço cliente</th><th className="py-3 px-4 text-right">Status</th></tr></thead><tbody className="divide-y divide-zinc-100">
        {rows.map(r=><tr key={r.key}><td className="py-3 px-4 sm:px-6 font-semibold text-zinc-900">{modelName(r.model_id)}</td><td className="py-3 px-4">{r.provider_name}</td><td className="py-3 px-4 text-zinc-500">{r.resolution} · {r.duration_seconds}s · {r.mode}</td><td className="py-3 px-4 text-right">{r.provider_cost_brl_cents==null?'—':formatCentsToBRL(r.provider_cost_brl_cents)}</td><td className="py-3 px-4 text-right font-semibold">{r.customer_price_cents==null?'—':formatCentsToBRL(r.customer_price_cents)}</td><td className="py-3 px-4 text-right">{r.status==='OK'?<span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3"/>OK · {r.margin_percent?.toFixed(0)}%</span>:<span title={r.error} className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle className="w-3 h-3"/>falhou</span>}</td></tr>)}
        {!rows.length&&<tr><td colSpan={6} className="py-10 text-center text-zinc-500">Nenhum provider configurado retornou uma cotação válida.</td></tr>}
      </tbody></table></div></Card>
      <p className="text-[10px] text-zinc-500 leading-relaxed">Esta tabela é apenas um health check de uma configuração de referência por modelo/provider. O valor cobrado do cliente não vem desta tabela: quando ele escolhe duração, resolução e modo, o Smart Router consulta ou reutiliza uma cotação recente daquela configuração exata; sem cotação segura, a geração é bloqueada.</p>
    </>}
  </div>;
};
