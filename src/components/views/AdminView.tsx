import React, { useEffect, useState } from 'react';
import { Users, DollarSign, Layers, Server, Activity } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Badge } from '../common/Badge.js';
import { AdminUsersList } from '../admin/AdminUsersList.js';
import { AdminModels } from '../admin/AdminModels.js';
import { AdminProviders } from '../admin/AdminProviders.js';
import { AdminPricing } from '../admin/AdminPricing.js';

type AdminTab = 'overview' | 'users' | 'models' | 'providers' | 'pricing';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { adminService.getDashboardStats().then(setStats).catch((err)=>console.error('Falha ao carregar métricas:',err)); }, []);

  const tabs = [
    { id:'overview' as const, label:'Resumo', icon:<Activity className="w-4 h-4"/> },
    { id:'users' as const, label:'Usuários & saldo', icon:<Users className="w-4 h-4"/> },
    { id:'models' as const, label:'Modelos', icon:<Layers className="w-4 h-4"/> },
    { id:'providers' as const, label:'Provedores', icon:<Server className="w-4 h-4"/> },
    { id:'pricing' as const, label:'Preços', icon:<DollarSign className="w-4 h-4"/> },
  ];

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Admin</h1><Badge variant="neutral">Operacional</Badge></div><p className="mt-1 text-xs text-zinc-500">Só o que você precisa para operar usuários, modelos, provedores e margem.</p></div></div>

    <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/[0.06]">{tabs.map(t=>{const active=activeTab===t.id;return <button key={t.id} id={`admin-tab-btn-${t.id}`} onClick={()=>setActiveTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${active?'bg-white/[0.08] text-white':'text-zinc-500 hover:text-white hover:bg-white/[0.035]'}`}>{t.icon}<span>{t.label}</span></button>})}</div>

    {activeTab==='overview'&&<div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Card id="admin-stat-users"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Usuários</span><div className="mt-1 text-xl font-black text-white">{stats?.total_users ?? '—'}</div><span className="text-[9px] text-zinc-600">{stats?.active_users ?? 0} ativos</span></Card><Card id="admin-stat-balance"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Saldo clientes</span><div className="mt-1 text-xl font-black text-white">{formatCentsToBRL(stats?.total_platform_balance_cents ?? 0)}</div><span className="text-[9px] text-zinc-600">custódia interna</span></Card><Card id="admin-stat-models"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Modelos</span><div className="mt-1 text-xl font-black text-white">{stats?.models_count ?? '—'}</div><span className="text-[9px] text-zinc-600">catálogo ativo</span></Card><Card id="admin-stat-providers"><span className="text-[9px] uppercase tracking-wider text-zinc-600">Provedores</span><div className="mt-1 text-xl font-black text-white">{stats?.providers_count ?? '—'}</div><span className="text-[9px] text-zinc-600">Atlas + WaveSpeed</span></Card></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"><h2 className="text-xs font-bold text-white">Checklist operacional</h2><div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]"><div className="rounded-xl border border-white/[0.06] bg-black/15 p-3"><span className="text-emerald-300 font-semibold">1. Provedores</span><p className="mt-1 text-zinc-600">Confira saldo e disponibilidade antes de testar.</p></div><div className="rounded-xl border border-white/[0.06] bg-black/15 p-3"><span className="text-emerald-300 font-semibold">2. Preços</span><p className="mt-1 text-zinc-600">Garanta custo e margem para cada rota ativa.</p></div><div className="rounded-xl border border-white/[0.06] bg-black/15 p-3"><span className="text-emerald-300 font-semibold">3. Usuários</span><p className="mt-1 text-zinc-600">Ajuste saldo ou status somente quando necessário.</p></div></div></div></div>}
    {activeTab==='users'&&<AdminUsersList/>}
    {activeTab==='models'&&<AdminModels/>}
    {activeTab==='providers'&&<AdminProviders/>}
    {activeTab==='pricing'&&<AdminPricing/>}
  </div>;
};
