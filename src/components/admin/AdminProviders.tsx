import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Server, Lock, RefreshCw, WalletCards, TriangleAlert } from 'lucide-react';
import { adminService, ProviderFinanceSnapshot } from '../../services/adminService.js';
import { ProviderRegistryItem, ProviderStatus } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

const now = () => new Date().toISOString();
const fallbackProviders: ProviderRegistryItem[] = [
  { provider_id:'provider-atlas', name:'Atlas Cloud', slug:'atlas', status:'ACTIVE', priority:100, is_configured:true, created_at:now(), updated_at:now() },
  { provider_id:'provider-wavespeed', name:'WaveSpeed', slug:'wavespeed', status:'ACTIVE', priority:95, is_configured:true, created_at:now(), updated_at:now() },
];
const runtimeConnected = (p: ProviderRegistryItem) => ['atlas','atlas-cloud','wavespeed','wave-speed'].includes(String(p.slug||'').toLowerCase()) || /atlas|wavespeed/i.test(p.name||'');
const money = (cents?: number | null) => cents == null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const usd = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);

export const AdminProviders: React.FC = () => {
  const [providers, setProviders] = useState<ProviderRegistryItem[]>([]);
  const [finance, setFinance] = useState<ProviderFinanceSnapshot[]>([]);
  const [fxRate, setFxRate] = useState(5.10);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderRegistryItem | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<ProviderStatus>('ACTIVE');
  const [priority, setPriority] = useState<number>(100);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = async (refresh = false) => {
    setFinanceLoading(true);
    try {
      const data = await adminService.getProviderFinance(refresh);
      setFinance(data.providers || []);
      if (data.fx_rate_usd_brl) setFxRate(data.fx_rate_usd_brl);
    } catch (err:any) {
      setError(err?.message || 'Não foi possível atualizar os saldos dos provedores.');
    } finally { setFinanceLoading(false); }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await adminService.listProviders().catch(() => []);
      const merged = [...res];
      for (const fp of fallbackProviders) {
        if (!merged.some((p) => p.provider_id === fp.provider_id || p.slug === fp.slug)) merged.push(fp);
      }
      setProviders(merged.map((p) => runtimeConnected(p) ? { ...p, is_configured:true, status:p.status==='INACTIVE'?'ACTIVE':p.status } : p));
    } finally { setLoading(false); }
  };

  useEffect(() => { void Promise.all([loadProviders(), loadFinance(false)]); }, []);

  const totalBrl = useMemo(() => finance.reduce((sum,p)=>sum+(p.balance_brl_cents||0),0),[finance]);
  const financeById = useMemo(() => new Map(finance.map((row)=>[row.provider_id,row])),[finance]);

  const handleOpenCreate = () => { setEditingProvider(null); setName(''); setSlug(''); setStatus('ACTIVE'); setPriority(100); setError(null); setModalOpen(true); };
  const handleOpenEdit = (p: ProviderRegistryItem) => { setEditingProvider(p); setName(p.name); setSlug(p.slug); setStatus(p.status); setPriority(p.priority); setError(null); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaveLoading(true);
    try {
      const connected = runtimeConnected({ name, slug } as ProviderRegistryItem);
      const data = { provider_id: editingProvider ? editingProvider.provider_id : `provider-${slug}`, name, slug, status, priority:Number(priority), is_configured: connected || editingProvider?.is_configured || false };
      if (editingProvider && !editingProvider.provider_id.startsWith('provider-atlas') && !editingProvider.provider_id.startsWith('provider-wavespeed')) await adminService.updateProvider(editingProvider.provider_id, data);
      else if (!editingProvider) await adminService.saveProvider(data);
      setModalOpen(false); await loadProviders();
    } catch (err:any) { setError(err.message || 'Falha ao salvar provedor.'); } finally { setSaveLoading(false); }
  };

  const getStatusBadge = (st: ProviderStatus) => st==='ACTIVE'?<Badge variant="success">Ativo</Badge>:st==='DEGRADED'?<Badge variant="warning">Degradado</Badge>:<Badge variant="danger">Inativo</Badge>;
  const financeBadge = (row?: ProviderFinanceSnapshot) => {
    if (!row) return <span className="text-[10px] text-zinc-500">Verificando...</span>;
    if (row.status === 'OPERATIONAL') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300"/>Operacional</span>;
    if (row.status === 'LOW_BALANCE') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-400/20 text-amber-300 text-[10px] font-bold"><TriangleAlert className="w-3 h-3"/>Saldo baixo</span>;
    return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/10 border border-rose-400/20 text-rose-300 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-rose-300"/>{row.status==='NOT_CONFIGURED'?'Sem chave':'Indisponível'}</span>;
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-900 tracking-tight">Provedores de Computação</h2><p className="text-xs text-zinc-500">Saúde operacional, saldo e prioridade do roteamento automático</p></div><div className="flex gap-2"><Button id="btn-refresh-provider-finance" variant="secondary" size="sm" onClick={()=>void loadFinance(true)} icon={<RefreshCw className={`w-3.5 h-3.5 ${financeLoading?'animate-spin':''}`}/>}>Atualizar saldos</Button><Button id="btn-add-provider" variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5"/>}>Cadastrar Provedor</Button></div></div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-wider"><WalletCards className="w-4 h-4"/>Saldo total providers</div><div className="mt-2 text-xl font-black text-white">{money(totalBrl)}</div><div className="mt-1 text-[10px] text-zinc-600">Conversão operacional em BRL</div></div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="text-zinc-500 text-[10px] uppercase tracking-wider">Câmbio utilizado</div><div className="mt-2 text-xl font-black text-white">US$ 1 = R$ {fxRate.toFixed(2).replace('.',',')}</div><div className="mt-1 text-[10px] text-zinc-600">Configurável por PROVIDER_USD_BRL</div></div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="text-zinc-500 text-[10px] uppercase tracking-wider">Proteção operacional</div><div className="mt-2 text-sm font-bold text-emerald-300">Failover + bloqueio de custo ativos</div><div className="mt-1 text-[10px] text-zinc-600">Rotas sem preço ou sem saldo suficiente não são priorizadas.</div></div>
    </div>

    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs text-zinc-700 leading-relaxed"><Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/><div><strong className="text-zinc-900 block mb-0.5">Credenciais protegidas no servidor</strong>Os saldos são consultados diretamente nas APIs dos provedores. As chaves nunca são enviadas ao navegador nem exibidas no painel.</div></div>

    <Card id="admin-providers-card">{loading?<div className="py-8 text-center text-xs text-zinc-400">Carregando provedores...</div>:<div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium"><th className="py-3 px-4 sm:px-6">Provedor</th><th className="py-3 px-4">Saldo</th><th className="py-3 px-4">Status operacional</th><th className="py-3 px-4">Prioridade</th><th className="py-3 px-4">Catálogo</th><th className="py-3 px-4 sm:px-6 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-100">{providers.map((p)=>{const f=financeById.get(p.provider_id as any);return <tr key={p.provider_id} className="hover:bg-zinc-50/50"><td className="py-3 px-4 sm:px-6"><div className="flex items-center gap-2"><Server className="w-4 h-4 text-zinc-400"/><div><span className="font-semibold text-zinc-900">{p.name}</span><div className="font-mono text-[9px] text-zinc-500 mt-0.5">{p.slug}</div></div></div></td><td className="py-3 px-4"><div className="font-bold text-zinc-900">{money(f?.balance_brl_cents)}</div><div className="text-[9px] text-zinc-500 mt-0.5">{usd(f?.balance_usd)} · atualizado {f?.fetched_at?new Date(f.fetched_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—'}</div></td><td className="py-3 px-4">{financeBadge(f)}</td><td className="py-3 px-4 font-semibold text-zinc-900">{p.priority}</td><td className="py-3 px-4">{getStatusBadge(p.status)}</td><td className="py-3 px-4 sm:px-6 text-right"><Button id={`btn-edit-provider-${p.provider_id}`} variant="secondary" size="sm" onClick={()=>handleOpenEdit(p)} icon={<Edit2 className="w-3.5 h-3.5"/>}>Editar</Button></td></tr>})}</tbody></table></div>}</Card>

    {error&&<div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/20 text-rose-300 text-xs">{error}</div>}
    <Modal id="provider-form-modal" isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editingProvider?'Editar Provedor':'Novo Provedor'} description="Metadados e prioridade de roteamento"><form onSubmit={handleSave} className="space-y-4 text-xs"><div><label className="block font-semibold text-zinc-700 mb-1">Nome do Provedor</label><input required value={name} onChange={(e)=>{setName(e.target.value);if(!editingProvider)setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''));}} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"/></div><div><label className="block font-semibold text-zinc-700 mb-1">Slug</label><input required disabled={!!editingProvider} value={slug} onChange={e=>setSlug(e.target.value)} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 disabled:bg-zinc-100 font-mono"/></div><div className="grid grid-cols-2 gap-3"><select value={status} onChange={e=>setStatus(e.target.value as ProviderStatus)} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"><option value="ACTIVE">ACTIVE</option><option value="DEGRADED">DEGRADED</option><option value="INACTIVE">INACTIVE</option></select><input type="number" min={0} max={100} value={priority} onChange={e=>setPriority(parseInt(e.target.value,10))} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"/></div><Button id="save-provider-submit-btn" type="submit" variant="primary" size="md" isLoading={saveLoading} className="w-full">Salvar</Button></form></Modal>
  </div>;
};
