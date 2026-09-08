import React, { useState } from 'react';
import {
  Wallet,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { UserProfile, WalletAccount, WalletTransaction } from '../../types/index.js';
import { formatCentsToBRL, parseBRLToCents } from '../../config/constants.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  wallet: WalletAccount | null;
  recentTransactions: WalletTransaction[];
  onUpdated: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  onClose,
  user,
  wallet,
  recentTransactions,
  onUpdated,
}) => {
  if (!user) return null;

  const [activeSubTab, setActiveSubTab] = useState<'details' | 'adjust' | 'status'>('details');

  // Adjust balance state
  const [adjustType, setAdjustType] = useState<'ADMIN_CREDIT' | 'ADMIN_DEBIT'>('ADMIN_CREDIT');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Status state
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    setAdjustSuccess(null);

    const amountCents = parseBRLToCents(amountStr);
    if (amountCents <= 0) {
      setAdjustError('Informe um valor válido em reais maior que zero.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setAdjustError('A justificativa é obrigatória para a trilha de auditoria.');
      return;
    }

    if (adjustType === 'ADMIN_DEBIT' && (wallet?.available_balance_cents || 0) < amountCents) {
      setAdjustError(
        `Saldo insuficiente para débito: O usuário possui apenas ${formatCentsToBRL(wallet?.available_balance_cents || 0)} disponíveis.`
      );
      return;
    }

    setAdjustLoading(true);
    try {
      const idempotencyKey = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await adminService.adjustBalance(user.user_id, adjustType, amountCents, reason, idempotencyKey);
      setAdjustSuccess(`Ajuste de ${formatCentsToBRL(amountCents)} executado com sucesso!`);
      setAmountStr('');
      setReason('');
      onUpdated();
    } catch (err: any) {
      setAdjustError(err.message || 'Falha ao executar ajuste de saldo.');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setStatusError(null);
    if (!statusReason.trim() || statusReason.trim().length < 3) {
      setStatusError('A justificativa para alteração de status é obrigatória.');
      return;
    }

    setStatusLoading(true);
    try {
      const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await adminService.updateUserStatus(user.user_id, newStatus, statusReason);
      setStatusReason('');
      onUpdated();
      setActiveSubTab('details');
    } catch (err: any) {
      setStatusError(err.message || 'Falha ao atualizar status do usuário.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <Modal
      id="admin-user-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={user.display_name}
      description={`UID: ${user.user_id}`}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Sub-tabs */}
        <div className="flex border-b border-zinc-200">
          <button
            id="tab-user-details"
            onClick={() => setActiveSubTab('details')}
            className={`py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'details'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Visão Geral & Saldo
          </button>
          <button
            id="tab-user-adjust"
            onClick={() => setActiveSubTab('adjust')}
            className={`py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'adjust'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Ajustar Saldo (Crédito / Débito)
          </button>
          <button
            id="tab-user-status"
            onClick={() => setActiveSubTab('status')}
            className={`py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'status'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Status da Conta ({user.status})
          </button>
        </div>

        {/* Tab 1: Details & Balance */}
        {activeSubTab === 'details' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Disponível</span>
                <span className="text-lg font-bold text-zinc-900 tabular-nums">
                  {formatCentsToBRL(wallet?.available_balance_cents || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Reservado</span>
                <span className="text-lg font-bold text-zinc-900 tabular-nums">
                  {formatCentsToBRL(wallet?.reserved_balance_cents || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Total</span>
                <span className="text-lg font-bold text-zinc-900 tabular-nums">
                  {formatCentsToBRL(wallet?.total_balance_cents || 0)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-zinc-600">
              <div>
                <span className="font-semibold text-zinc-800">E-mail:</span> {user.email}
              </div>
              <div>
                <span className="font-semibold text-zinc-800">Papel:</span> {user.role}
              </div>
              <div>
                <span className="font-semibold text-zinc-800">Status:</span> {user.status}
              </div>
              <div>
                <span className="font-semibold text-zinc-800">Criado em:</span>{' '}
                {new Date(user.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>

            {/* Recent Transactions in Modal */}
            <div className="pt-2">
              <span className="font-semibold text-zinc-900 block mb-2">Últimos Lançamentos</span>
              {recentTransactions.length === 0 ? (
                <p className="text-zinc-400 italic py-2">Nenhum lançamento no extrato.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.transaction_id}
                      className="p-2 rounded bg-zinc-50 border border-zinc-200/80 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900">{tx.type}</span>
                        <span className="text-zinc-500 block truncate max-w-xs">{tx.description}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {formatCentsToBRL(tx.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Adjust Balance */}
        {activeSubTab === 'adjust' && (
          <form onSubmit={handleAdjustBalance} className="space-y-4 pt-2">
            {adjustError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                {adjustError}
              </div>
            )}
            {adjustSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                {adjustSuccess}
              </div>
            )}

            <div>
              <label className="block font-semibold text-zinc-700 mb-1.5">Tipo de Operação</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustType('ADMIN_CREDIT')}
                  className={`p-2.5 rounded-lg border text-center font-semibold cursor-pointer ${
                    adjustType === 'ADMIN_CREDIT'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  ADMIN_CREDIT (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('ADMIN_DEBIT')}
                  className={`p-2.5 rounded-lg border text-center font-semibold cursor-pointer ${
                    adjustType === 'ADMIN_DEBIT'
                      ? 'border-rose-600 bg-rose-50 text-rose-900'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  ADMIN_DEBIT (-)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1.5">
                Valor (R$)
              </label>
              <input
                id="adjust-amount-input"
                type="text"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Ex: 50,00 ou 100"
                className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 text-sm focus:ring-2 focus:ring-zinc-900"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                O valor é estritamente convertido em centavos inteiros no ledger.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1.5">
                Justificativa Obrigatória (Auditoria)
              </label>
              <textarea
                id="adjust-reason-textarea"
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Bonificação promocional manual autorizada pelo suporte..."
                className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <Button
              id="submit-adjust-btn"
              type="submit"
              variant="primary"
              size="md"
              isLoading={adjustLoading}
              className="w-full"
            >
              Confirmar Ajuste no Ledger
            </Button>
          </form>
        )}

        {/* Tab 3: Status Toggle */}
        {activeSubTab === 'status' && (
          <div className="space-y-4 pt-2">
            {statusError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                {statusError}
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
              <span className="font-semibold text-zinc-900 block mb-1">
                Status Atual: {user.status === 'ACTIVE' ? 'Ativo' : 'Suspenso'}
              </span>
              <p className="text-zinc-500">
                {user.status === 'ACTIVE'
                  ? 'Suspender o usuário bloqueia imediatamente o acesso a novas gerações e chamadas sensíveis na API.'
                  : 'Reativar o usuário restaura o acesso regular à plataforma.'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1.5">
                Motivo da alteração de status (Obrigatório)
              </label>
              <textarea
                id="status-reason-textarea"
                required
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Ex: Suspensão preventiva por conduta em desacordo com as diretrizes..."
                className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <Button
              id="confirm-toggle-status-btn"
              type="button"
              variant={user.status === 'ACTIVE' ? 'danger' : 'primary'}
              size="md"
              isLoading={statusLoading}
              onClick={handleToggleStatus}
              className="w-full"
            >
              {user.status === 'ACTIVE' ? 'Suspender Usuário' : 'Reativar Usuário'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
