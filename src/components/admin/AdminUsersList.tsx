import React, { useEffect, useState } from 'react';
import { Search, Wallet, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { adminService } from '../../services/adminService.js';
import { useAuth } from '../../context/AuthContext.js';
import { db } from '../../config/firebase.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { UserProfile, WalletAccount, WalletTransaction } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { AdminUserDetailModal } from './AdminUserDetailModal.js';

const ADMIN_SELF_BALANCE_MAX_CENTS = 50_000;

export const AdminUsersList: React.FC = () => {
  const { profile, wallet, refreshWallet } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selfTarget, setSelfTarget] = useState('50');
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfMessage, setSelfMessage] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletAccount | null>(null);
  const [selectedRecentTx, setSelectedRecentTx] = useState<WalletTransaction[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUsers = async () => {
    try { setLoading(true); const res = await adminService.listUsers(search); setUsers(res.users); setTotal(res.total); }
    catch (err) { console.error('Falha ao listar usuários:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchUsers(); }, [search]);

  const handleSetOwnBalance = async () => {
    if (!profile?.user_id || profile.role !== 'ADMIN') return;
    const reais = Number(String(selfTarget).replace(',', '.'));
    if (!Number.isFinite(reais) || reais < 0) { setSelfMessage('Digite um saldo válido.'); return; }
    const targetCents = Math.min(ADMIN_SELF_BALANCE_MAX_CENTS, Math.round(reais * 100));
    setSelfSaving(true); setSelfMessage(null);
    try {
      const uid = profile.user_id; const now = new Date().toISOString(); const txId = `tx_admin_test_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      await runTransaction(db, async (tx) => {
        const walletRef = doc(db, 'wallet_accounts', uid);
        const snap = await tx.get(walletRef);
        const current = snap.exists() ? snap.data() as WalletAccount : {account_id:uid,user_id:uid,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:now} as WalletAccount;
        const diff = targetCents - Number(current.available_balance_cents || 0);
        if (diff === 0) return;
        const next: WalletAccount = {...current,account_id:uid,user_id:uid,currency:'BRL',available_balance_cents:targetCents,total_balance_cents:Number(current.total_balance_cents || 0)+diff,updated_at:now};
        if (next.total_balance_cents < 0) throw new Error('Saldo total não pode ficar negativo.');
        tx.set(walletRef, next, { merge:true });
        tx.set(doc(db,'wallet_transactions',txId),{transaction_id:txId,user_id:uid,type:diff>0?'ADMIN_CREDIT':'ADMIN_DEBIT',amount_cents:Math.abs(diff),status:'COMPLETED',description:'Ajuste do saldo pessoal de testes do administrador',reference_type:'SYSTEM',reference_id:uid,idempotency_key:txId,created_at:now,created_by:uid});
      });
      await refreshWallet();
      setSelfMessage(`Saldo operacional definido em ${formatCentsToBRL(targetCents)}.`);
    } catch (err:any) { setSelfMessage(err?.message || 'Não foi possível ajustar seu saldo.'); }
    finally { setSelfSaving(false); }
  };

  const handleOpenUser = async (u: UserProfile) => { try { const details = await adminService.getUserDetails(u.user_id); setSelectedUser(details.user); setSelectedWallet(details.wallet); setSelectedRecentTx(details.recent_transactions); setModalOpen(true); } catch (err) { console.error('Erro ao abrir detalhes:', err); } };
  const handleModalUpdated = async () => { if (selectedUser) { const details = await adminService.getUserDetails(selectedUser.user_id); setSelectedUser(details.user); setSelectedWallet(details.wallet); setSelectedRecentTx(details.recent_transactions); } await refreshWallet(); void fetchUsers(); };

  return <div className="space-y-4">
    {profile?.role === 'ADMIN' && <div className="rounded-2xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(16,185,129,.08),rgba(34,211,238,.035),rgba(255,255,255,.02))] p-4 sm:p-5"><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div className="max-w-xl"><div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Conta administrativa</span></div><h3 className="mt-2 text-base font-bold text-white">Saldo pessoal para testes</h3><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Defina seu limite interno de geração. O saldo é consumido normalmente e o teto permanece em R$ 500.</p></div><div className="min-w-[290px] rounded-xl border border-white/[0.07] bg-black/20 p-3.5"><div className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">Saldo disponível</span><Sparkles className="w-4 h-4 text-emerald-300"/></div><div className="mt-1 text-xl font-black text-white tabular-nums">{formatCentsToBRL(wallet?.available_balance_cents || 0)}</div><div className="mt-3 flex gap-2"><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">R$</span><input value={selfTarget} onChange={(e)=>setSelfTarget(e.target.value)} inputMode="decimal" className="w-full h-9 rounded-lg border border-white/[0.08] bg-[#0b0e13] pl-8 pr-3 text-xs text-white outline-none focus:border-emerald-400/40"/></div><Button id="admin-self-balance-set" variant="primary" size="sm" onClick={handleSetOwnBalance} isLoading={selfSaving}>Definir saldo</Button></div><div className="mt-2 flex gap-1.5">{[20,50,100,200].map(v=><button key={v} onClick={()=>setSelfTarget(String(v))} className="px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.025] text-[9px] text-zinc-500 hover:text-white hover:bg-white/[0.05]">R$ {v}</button>)}</div>{selfMessage&&<p className="mt-2 text-[10px] text-zinc-400">{selfMessage}</p>}</div></div></div>}

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div className="relative flex-1 max-w-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400"><Search className="w-4 h-4"/></div><input id="admin-user-search-input" type="text" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por e-mail ou nome..." className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:ring-2 focus:ring-zinc-900"/></div><Button id="admin-refresh-users-btn" variant="outline" size="sm" onClick={fetchUsers} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Recarregar ({total})</Button></div>

    <Card id="admin-users-table-card">{loading?<div className="py-12 text-center text-xs text-zinc-400">Carregando usuários...</div>:users.length===0?<div className="py-12 text-center text-xs text-zinc-400">Nenhum usuário encontrado.</div>:<div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium"><th className="py-3 px-4 sm:px-6">Usuário</th><th className="py-3 px-4">Papel</th><th className="py-3 px-4">Status</th><th className="py-3 px-4 sm:px-6 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-100">{users.map(u=><tr key={u.user_id} className="hover:bg-zinc-50/50 transition-colors"><td className="py-3 px-4 sm:px-6"><div><span className="font-semibold text-zinc-900 block">{u.display_name}</span><span className="text-[11px] text-zinc-400 block">{u.email}</span></div></td><td className="py-3 px-4"><Badge variant={u.role==='ADMIN'?'warning':'neutral'}>{u.role}</Badge></td><td className="py-3 px-4"><Badge variant={u.status==='ACTIVE'?'success':'danger'}>{u.status==='ACTIVE'?'Ativo':'Suspenso'}</Badge></td><td className="py-3 px-4 sm:px-6 text-right"><Button id={`btn-manage-user-${u.user_id}`} variant="secondary" size="sm" onClick={()=>handleOpenUser(u)} icon={<Wallet className="w-3.5 h-3.5 text-emerald-600"/>}>Gerenciar</Button></td></tr>)}</tbody></table></div>}</Card>
    <AdminUserDetailModal isOpen={modalOpen} onClose={()=>setModalOpen(false)} user={selectedUser} wallet={selectedWallet} recentTransactions={selectedRecentTx} onUpdated={handleModalUpdated}/>
  </div>;
};
