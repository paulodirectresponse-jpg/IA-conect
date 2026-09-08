import React, { useEffect, useState } from 'react';
import { Search, Shield, User, Wallet, Edit, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { UserProfile, WalletAccount, WalletTransaction } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { AdminUserDetailModal } from './AdminUserDetailModal.js';

export const AdminUsersList: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected user for modal
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

  useEffect(() => {
    fetchUsers();
  }, [search]);

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
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="admin-user-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-mail ou nome..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <Button
          id="admin-refresh-users-btn"
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Recarregar ({total})
        </Button>
      </div>

      <Card id="admin-users-table-card">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400">Carregando usuários...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Usuário</th>
                  <th className="py-3 px-4">Papel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Criado em</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold text-xs">
                          {u.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-900 block">{u.display_name}</span>
                          <span className="text-[11px] text-zinc-400 block">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.role === 'ADMIN' ? 'warning' : 'neutral'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={u.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {u.status === 'ACTIVE' ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <Button
                        id={`btn-manage-user-${u.user_id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenUser(u)}
                        icon={<Wallet className="w-3.5 h-3.5 text-emerald-600" />}
                      >
                        Gerenciar / Saldo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdminUserDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        wallet={selectedWallet}
        recentTransactions={selectedRecentTx}
        onUpdated={handleModalUpdated}
      />
    </div>
  );
};
