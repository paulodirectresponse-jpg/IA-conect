import React, { useEffect, useState } from 'react';
import { Search, Wallet, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { UserProfile, WalletAccount, WalletTransaction } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { AdminUserDetailModal } from './AdminUserDetailModal.js';

const ADMIN_SELF_BALANCE_MAX_CENTS = 50_000; // R$ 500 safety ceiling for the admin test account.

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
    try {
      setLoading(true);
      const res = await adminService.listUsers(search);
      setUsers(res.users);
      setTotal(res.total);
    } catch (err) {
      console.error('Falha ao listar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [search]);

  const handleSetOwnBalance = async () => {
    if (!profile?.user_id || profile.role !== 'ADMIN') return;
    const reais = Number(String(selfTarget).replace(',', '.'));
    if (!Number.isFinite(reais) || reais < 0) {
      setSelfMessage('Digite um saldo válido.');
      return;
    }
    const targetCents = Math.min(ADMIN_SELF_BALANCE_MAX_CENTS, Math.round(reais * 100));
    const currentCents = wallet?.available_balance_cents || 0;
    const diff = targetCents - currentCents;
    if (diff === 0) {
      setSelfMessage('Seu saldo já está nesse valor.');
      return;
    }
    try {
      setSelfSaving(true);
      setSelfMessage(null);
      await adminService.adjustBalance(
        profile.user_id,
        diff > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        Math.abs(diff),
        'Ajuste do saldo operacional pessoal do administrador',
        `admin-self-balance:${profile.user_id}:${Date.now()}`
      );
      await refreshWallet();
      setSelfMessage(`Saldo operacional ajustado para ${formatCentsToBRL(targetCents)}.`);
    } catch (err:any) {
      setSelfMessage(err?.message || 'Não foi possível ajustar seu saldo.');
    } finally {
      setSelfSaving(false);
    }
  };

  const handleOpenUser = async (u: UserProfile) => {
    try {
      const details = await adminService.getUserDetails(u.user_id);
      setSelectedUser(details.user);
      setSelectedWallet(details.wallet);
      setSelectedRecentTx(details.recent_transactions);
      setModalOpen(true);
    } catch (err) {
      console.error('Erro ao abrir detalhes:', err);
    }
  };

  const handleModalUpdated = async () => {
    if (selectedUser) {
      const details = await adminService.getUserDetails(selectedUser.user_id);
      setSelectedUser(details.user);
      setSelectedWallet(details.wallet);
      setSelectedRecentTx(details.recent_transactions);
    }
    await refreshWallet();
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      {profile?.role === 'ADMIN' && (
        <div className="rounded-2xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(16,185,129,.08),rgba(34,211,238,.035),rgba(255,255,255,.02))] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-[0.14em]">Conta administrativa</span></div>
              <h3 className="mt-2 text-base font-bold text-white">Saldo pessoal para testes e gerações</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Você pode abastecer sua própria carteira sem pagamento para testar o produto. O saldo é consumido normalmente a cada geração, então ele funciona como um limite real de gasto interno. Por segurança, o teto desta conta está em R$ 500 por vez.</p>
            </div>
            <div className="min-w-[290px] rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
              <div className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">Saldo disponível agora</span><Sparkles className="w-4 h-4 text-emerald-300"/></div>
              <div className="mt-1 text-xl font-black text-white tabular-nums">{formatCentsToBRL(wallet?.available_balance_cents || 0)}</div>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">R$</span><input value={selfTarget} onChange={(e)=>setSelfTarget(e.target.value)} inputMode="decimal" className="w-full h-9 rounded-lg border border-white/[0.08] bg-[#0b0e13] pl-8 pr-3 text-xs text-white outline-none focus:border-emerald-400/40"/></div>
                <Button id="admin-self-balance-set" variant="primary" size="sm" onClick={handleSetOwnBalance} isLoading={selfSaving}>Definir saldo</Button>
              </div>
              <div className="mt-2 flex gap-1.5">{[20,50,100,200].map(v=><button key={v} onClick={()=>setSelfTarget(String(v))} className="px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.025] text-[9px] text-zinc-500 hover:text-white hover:bg-white/[0.05]">R$ {v}</button>)}</div>
              {selfMessage && <p className="mt-2 text-[10px] text-zinc-400">{selfMessage}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400"><Search className="w-4 h-4" /></div>
          <input id="admin-user-search-input" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por e-mail ou nome..." className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:ring-2 focus:ring-zinc-900" />
        </div>
        <Button id="admin-refresh-users-btn" variant="outline" size="sm" onClick={fetchUsers} icon={<RefreshCw className="w-3.5 h-3.5" />}>Recarregar ({total})</Button>
      </div>

      <Card id="admin-users-table-card">
        {loading ? <div className="py-12 text-center text-xs text-zinc-400">Carregando usuários...</div> : users.length === 0 ? <div className="py-12 text-center text-xs text-zinc-400">Nenhum usuário encontrado.</div> : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium"><th className="py-3 px-4 sm:px-6">Usuário</th><th className="py-3 px-4">Papel</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Criado em</th><th className="py-3 px-4 sm:px-6 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-100">{users.map((u)=><tr key={u.user_id} className="hover:bg-zinc-50/50 transition-colors"><td className="py-3 px-4 sm:px-6"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold text-xs">{u.display_name.charAt(0).toUpperCase()}</div><div><span className="font-semibold text-zinc-900 block">{u.display_name}</span><span className="text-[11px] text-zinc-400 block">{u.email}</span></div></div></td><td className="py-3 px-4"><Badge variant={u.role==='ADMIN'?'warning':'neutral'}>{u.role}</Badge></td><td className="py-3 px-4"><Badge variant={u.status==='ACTIVE'?'success':'danger'}>{u.status==='ACTIVE'?'Ativo':'Suspenso'}</Badge></td><td className="py-3 px-4 text-zinc-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td><td className="py-3 px-4 sm:px-6 text-right"><Button id={`btn-manage-user-${u.user_id}`} variant="secondary" size="sm" onClick={()=>handleOpenUser(u)} icon={<Wallet className="w-3.5 h-3.5 text-emerald-600"/>}>Gerenciar / Saldo</Button></td></tr>)}</tbody></table></div>
        )}
      </Card>

      <AdminUserDetailModal isOpen={modalOpen} onClose={()=>setModalOpen(false)} user={selectedUser} wallet={selectedWallet} recentTransactions={selectedRecentTx} onUpdated={handleModalUpdated}/>
    </div>
  );
};
