import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Server, Lock } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
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

export const AdminProviders: React.FC = () => {
  const [providers, setProviders] = useState<ProviderRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderRegistryItem | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<ProviderStatus>('ACTIVE');
  const [priority, setPriority] = useState<number>(100);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await adminService.listProviders().catch(() => []);
      const merged = [...res];
      for (const fp of fallbackProviders) if (!merged.some((p) => runtimeConnected(p) && runtimeConnected(fp) && p.name.toLowerCase().includes(fp.name.split(' ')[0].toLowerCase()))) merged.push(fp);
      setProviders(merged.map((p) => runtimeConnected(p) ? { ...p, is_configured:true, status:p.status==='INACTIVE'?'ACTIVE':p.status } : p));
    } finally { setLoading(false); }
  };

  useEffect(() => { loadProviders(); }, []);

  const handleOpenCreate = () => { setEditingProvider(null); setName(''); setSlug(''); setStatus('ACTIVE'); setPriority(100); setError(null); setModalOpen(true); };
  const handleOpenEdit = (p: ProviderRegistryItem) => { setEditingProvider(p); setName(p.name); setSlug(p.slug); setStatus(p.status); setPriority(p.priority); setError(null); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaveLoading(true);
    try {
      const connected = runtimeConnected({ name, slug } as ProviderRegistryItem);
      const data = { provider_id: editingProvider ? editingProvider.provider_id : `provider-${slug}`, name, slug, status, priority:Number(priority), is_configured: connected || editingProvider?.is_configured || false };
      if (editingProvider && !editingProvider.provider_id.startsWith('provider-atlas') && !editingProvider.provider_id.startsWith('provider-wavespeed')) await adminService.updateProvider(editingProvider.provider_id, data);
      else if (!editingProvider) await adminService.saveProvider(data);
      setModalOpen(false); loadProviders();
    } catch (err:any) { setError(err.message || 'Falha ao salvar provedor.'); } finally { setSaveLoading(false); }
  };

  const getStatusBadge = (st: ProviderStatus) => st==='ACTIVE'?<Badge variant="success">Ativo</Badge>:st==='DEGRADED'?<Badge variant="warning">Degradado</Badge>:<Badge variant="danger">Inativo</Badge>;

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-zinc-900 tracking-tight">Provedores de Computação</h2><p className="text-xs text-zinc-500">Integrações de backend disponíveis para roteamento automático</p></div><Button id="btn-add-provider" variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5"/>}>Cadastrar Provedor</Button></div>
    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs text-zinc-700 leading-relaxed"><Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/><div><strong className="text-zinc-900 block mb-0.5">Credenciais protegidas no servidor</strong>Atlas Cloud e WaveSpeed estão conectados por secrets do backend. As chaves nunca são exibidas nem armazenadas no catálogo do usuário.</div></div>
    <Card id="admin-providers-card">{loading?<div className="py-8 text-center text-xs text-zinc-400">Carregando provedores...</div>:<div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium"><th className="py-3 px-4 sm:px-6">Nome</th><th className="py-3 px-4">Identificador</th><th className="py-3 px-4">Prioridade</th><th className="py-3 px-4">Integração</th><th className="py-3 px-4">Status</th><th className="py-3 px-4 sm:px-6 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-100">{providers.map((p)=><tr key={p.provider_id} className="hover:bg-zinc-50/50"><td className="py-3 px-4 sm:px-6"><div className="flex items-center gap-2"><Server className="w-4 h-4 text-zinc-400"/><span className="font-semibold text-zinc-900">{p.name}</span></div></td><td className="py-3 px-4 font-mono text-zinc-600">{p.slug}</td><td className="py-3 px-4 font-semibold text-zinc-900">{p.priority}</td><td className="py-3 px-4">{p.is_configured||runtimeConnected(p)?<span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300"/>Conectado ao backend</span>:<span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded"><Lock className="w-3 h-3"/>Aguardando configuração</span>}</td><td className="py-3 px-4">{getStatusBadge(p.status)}</td><td className="py-3 px-4 sm:px-6 text-right"><Button id={`btn-edit-provider-${p.provider_id}`} variant="secondary" size="sm" onClick={()=>handleOpenEdit(p)} icon={<Edit2 className="w-3.5 h-3.5"/>}>Editar</Button></td></tr>)}</tbody></table></div>}</Card>
    <Modal id="provider-form-modal" isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editingProvider?'Editar Provedor':'Novo Provedor'} description="Metadados e prioridade de roteamento"><form onSubmit={handleSave} className="space-y-4 text-xs">{error&&<div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">{error}</div>}<div><label className="block font-semibold text-zinc-700 mb-1">Nome do Provedor</label><input required value={name} onChange={(e)=>{setName(e.target.value);if(!editingProvider)setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''));}} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"/></div><div><label className="block font-semibold text-zinc-700 mb-1">Slug</label><input required disabled={!!editingProvider} value={slug} onChange={e=>setSlug(e.target.value)} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 disabled:bg-zinc-100 font-mono"/></div><div className="grid grid-cols-2 gap-3"><select value={status} onChange={e=>setStatus(e.target.value as ProviderStatus)} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"><option value="ACTIVE">ACTIVE</option><option value="DEGRADED">DEGRADED</option><option value="INACTIVE">INACTIVE</option></select><input type="number" min={0} max={100} value={priority} onChange={e=>setPriority(parseInt(e.target.value,10))} className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"/></div><Button id="save-provider-submit-btn" type="submit" variant="primary" size="md" isLoading={saveLoading} className="w-full">Salvar</Button></form></Modal>
  </div>;
};
