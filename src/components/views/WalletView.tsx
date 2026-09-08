import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Info,
  Clock,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { walletService } from '../../services/walletService.js';
import { WalletTransaction } from '../../types/index.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { EmptyState } from '../common/EmptyState.js';

export const WalletView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLedger = async () => {
    try {
      setLoading(true);
      const res = await walletService.listTransactions(50, 0);
      setTransactions(res.transactions);
    } catch (err) {
      console.error('Falha ao carregar transações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshWallet(), loadLedger()]);
    setRefreshing(false);
  };

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'ADMIN_CREDIT':
      case 'DEPOSIT':
      case 'PROMOTIONAL_CREDIT':
      case 'REFUND':
        return <Badge variant="success">+{type.replace('_', ' ')}</Badge>;
      case 'ADMIN_DEBIT':
      case 'GENERATION_CAPTURE':
        return <Badge variant="neutral">-{type.replace('_', ' ')}</Badge>;
      case 'GENERATION_RESERVE':
        return <Badge variant="warning">RESERVA</Badge>;
      case 'GENERATION_RELEASE':
        return <Badge variant="info">LIBERAÇÃO</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Carteira & Razão Contábil
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Controle financeiro de alta precisão baseado em ledger imutável
          </p>
        </div>

        <Button
          id="wallet-refresh-btn"
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          isLoading={refreshing}
          icon={<RotateCcw className="w-4 h-4 text-zinc-600" />}
        >
          Atualizar Saldo
        </Button>
      </div>

      {/* Financial Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card id="wallet-card-available" className="bg-white">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Saldo Disponível
          </span>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.available_balance_cents || 0)}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
            Pronto para consumo imediato
          </span>
        </Card>

        <Card id="wallet-card-reserved" className="bg-white">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Saldo Reservado
          </span>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.reserved_balance_cents || 0)}
          </div>
          <span className="text-[10px] text-amber-600 font-medium mt-1 block">
            Vinculado a jobs em andamento
          </span>
        </Card>

        <Card id="wallet-card-total" className="bg-white">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Saldo Total
          </span>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.total_balance_cents || 0)}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 block">
            Disponível + Reservado
          </span>
        </Card>

        <Card id="wallet-card-deposited" className="bg-white">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Total Depositado
          </span>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.total_deposited_cents || 0)}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 block">
            Histórico acumulado de depósitos
          </span>
        </Card>
      </div>

      {/* Clarification Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-100/80 border border-zinc-200/80 text-xs text-zinc-700">
        <Info className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-zinc-900 block mb-0.5">
            Integridade Financeira e Ledger Imutável
          </strong>
          Toda a infraestrutura financeira, validações anti-duplicação por chave de idempotência e contabilidade em centavos inteiros estão ativas e auditáveis.
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <Card
        id="wallet-ledger-card"
        title="Extrato de Transações (Ledger)"
        subtitle="Registro estritamente imutável e auditável"
      >
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Carregando transações do ledger...
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            id="empty-transactions-state"
            icon={<FileText className="w-6 h-6" />}
            title="Nenhuma transação registrada"
            description="Sua carteira está limpa. Quando houver créditos administrativos, recargas ou consumo de IA, cada movimentação aparecerá aqui como um lançamento contábil imutável."
          />
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Data / Hora</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map((tx) => {
                  const isCredit = [
                    'DEPOSIT',
                    'ADMIN_CREDIT',
                    'PROMOTIONAL_CREDIT',
                    'REFUND',
                  ].includes(tx.type);

                  return (
                    <tr key={tx.transaction_id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 text-zinc-600 whitespace-nowrap tabular-nums">
                        {new Date(tx.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getTxTypeBadge(tx.type)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-zinc-800 truncate" title={tx.description}>
                        {tx.description || '—'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                          isCredit ? 'text-emerald-700' : 'text-zinc-900'
                        }`}
                      >
                        {isCredit ? '+' : '-'} {formatCentsToBRL(tx.amount_cents)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <Badge variant={tx.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
