import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, Clock3 } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { apiRequest } from '../../services/apiClient.js';
import { ModelRegistryItem, ProviderRegistryItem } from '../../types/index.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';

type LiveRow = {
  key:string; provider_id:string; model_id:string; mode:string; duration_seconds:number; resolution:string;
  provider_cost_brl_cents:number|null; customer_price_cents:number|null; margin_percent:number|null;
  status:'OK'|'FAILED'; checked_at:string; error?:string;
};
type SyncResult = { checked_at:string|null; checked:number; healthy:number; failed:number; rows:LiveRow[] };

const modeLabel=(mode:string)=>({
  TEXT_TO_VIDEO:'Texto → vídeo',IMAGE_TO_VIDEO:'Imagem → vídeo',REFERENCE_TO_VIDEO:'Referência → vídeo',
  TEXT_TO_IMAGE:'Texto → imagem',IMAGE_TO_IMAGE:'Imagem → imagem',
}[mode]||mode);

export const AdminPricing: React.FC = () => {
  const [liveRows,setLiveRows]=useState<LiveRow[]>([]);
  const [models,setModels]=useState<ModelRegistryItem[]>([]);
  const [providers,setProviders]=useState<ProviderRegistryItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [message,setMessage]=useState('');
  const [lastCheckedAt,setLastCheckedAt]=useState<string|null>(null);

  const loadSnapshot=async()=>{
    setLoading(true);
    try{
      const [snapshot,m,p]=await Promise.all([
        apiRequest<SyncResult>('/api/admin/pricing/live'),
        adminService.listModels(),
        adminService.listProviders(),
      ]);
      setLiveRows(snapshot.rows||[]);
      setLastCheckedAt(snapshot.checked_at||null);
      setModels(m);
      setProviders(p);
    }finally{setLoading(false);}
  };

  useEffect(()=>{loadSnapshot().catch((e)=>setMessage(e?.message||'Falha ao carregar preços vivos.'));},[]);

  const syncNow=async()=>{
    setSyncing(true);setMessage('');
    try{
      const r=await apiRequest<SyncResult>('/api/admin/pricing/sync',{method:'POST'});
      setLiveRows(r.rows||[]);setLastCheckedAt(r.checked_at||null);
      setMessage(`${r.healthy} cotações atualizadas${r.failed?` · ${r.failed} combinação(ões) indisponível(is)`:''}.`);
    }catch(e:any){setMessage(e?.message||'Falha ao atualizar preços.');}
    finally{setSyncing(false);}
  };

  const nameModel=(id:string)=>models.find(m=>m.model_id===id)?.name||id;
  const nameProvider=(id:string)=>providers.find(p=>p.provider_id===id)?.name||id;
  const rows=useMemo(()=>[...liveRows].sort((a,b)=>nameModel(a.model_id).localeCompare(nameModel(b.model_id))||a.mode.localeCompare(b.mode)||a.resolution.localeCompare(b.resolution)||nameProvider(a.provider_id).localeCompare(nameProvider(b.provider_id))),[liveRows,models,providers]);
  const healthy=rows.filter(r=>r.status==='OK').length;
  const failed=rows.length-healthy;

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Matriz de Precificação ao Vivo</h2>
        <p className="text-xs text-zinc-500">Fonte única de preço: consulta direta aos provedores com margem bruta protegida de 40%.</p>
      </div>
      <Button id="btn-sync-pricing" variant="secondary" size="sm" onClick={syncNow} isLoading={syncing} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Atualizar preços agora</Button>
    </div>

    <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-500">
      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/>{healthy} disponíveis</span>
      {failed>0&&<span className="inline-flex items-center gap-1.5 text-amber-600"><AlertTriangle className="w-3.5 h-3.5"/>{failed} indisponíveis</span>}
      {lastCheckedAt&&<span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5"/>Última sincronização: {new Date(lastCheckedAt).toLocaleString('pt-BR')}</span>}
    </div>

    {message&&<div className="text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">{message}</div>}

    <Card id="admin-pricing-card">
      {loading?<div className="py-10 text-center text-xs text-zinc-400">Carregando último snapshot de preços...</div>:
      <div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse">
        <thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500">
          <th className="py-3 px-4 sm:px-6">Modelo / Configuração</th><th className="py-3 px-4">Modo</th><th className="py-3 px-4">Provedor</th><th className="py-3 px-4 text-right">Custo Provedor</th><th className="py-3 px-4 text-right">Preço Cliente</th><th className="py-3 px-4 text-right">Margem</th><th className="py-3 px-4 sm:px-6 text-right">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map(r=><tr key={r.key} className={r.status==='FAILED'?'bg-amber-50/30':''}>
            <td className="py-3 px-4 sm:px-6"><span className="font-semibold text-zinc-900 block">{nameModel(r.model_id)}</span><span className="text-[11px] text-zinc-500">{r.resolution} • {r.duration_seconds}s • AO VIVO</span></td>
            <td className="py-3 px-4 text-zinc-600">{modeLabel(r.mode)}</td>
            <td className="py-3 px-4">{nameProvider(r.provider_id)}</td>
            <td className="py-3 px-4 text-right">{r.provider_cost_brl_cents==null?'—':formatCentsToBRL(r.provider_cost_brl_cents)}</td>
            <td className="py-3 px-4 text-right font-semibold">{r.customer_price_cents==null?'—':formatCentsToBRL(r.customer_price_cents)}</td>
            <td className="py-3 px-4 text-right">{r.status==='OK'?<span className="text-emerald-700 font-semibold">{r.margin_percent?.toFixed(0)}%</span>:<span className="text-amber-700">—</span>}</td>
            <td className="py-3 px-4 sm:px-6 text-right">{r.status==='OK'?<span className="inline-flex items-center gap-1 text-[10px] text-emerald-700"><CheckCircle2 className="w-3 h-3"/>consultado</span>:<span title={r.error} className="inline-flex items-center gap-1 text-[10px] text-amber-700"><AlertTriangle className="w-3 h-3"/>indisponível</span>}</td>
          </tr>)}
          {!rows.length&&<tr><td colSpan={7} className="py-12 text-center text-zinc-500">Ainda não existe snapshot vivo. Clique em “Atualizar preços agora”.</td></tr>}
        </tbody>
      </table></div>}
    </Card>
    <p className="text-[10px] leading-relaxed text-zinc-500">Esta matriz é de referência operacional. No momento exato da geração, o Smart Router solicita novamente a cotação da configuração escolhida e bloqueia a geração se nenhum provedor retornar preço seguro. Tarifas manuais antigas não são usadas como substituição silenciosa.</p>
  </div>;
};
