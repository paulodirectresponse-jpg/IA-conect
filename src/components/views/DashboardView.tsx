import React from 'react';
import {
  Wallet,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { EmptyState } from '../common/EmptyState.js';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { profile, wallet, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              Olá, {profile?.display_name || 'Usuário'}
            </h1>
            <Badge variant={profile?.status === 'ACTIVE' ? 'success' : 'danger'}>
              {profile?.status === 'ACTIVE' ? 'Conta Ativa' : 'Conta Suspensa'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Visão geral da sua conta e infraestrutura de créditos pré-pagos
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            id="dash-open-wallet-btn"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('wallet')}
            icon={<Wallet className="w-4 h-4 text-emerald-600" />}
          >
            Ver Extrato Completo
          </Button>

          {isAdmin && (
            <Button
              id="dash-open-admin-btn"
              variant="primary"
              size="sm"
              onClick={() => onNavigate('admin')}
              icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
            >
              Painel Admin
            </Button>
          )}
        </div>
      </div>

      {/* Financial Snapshot - 3 Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <Card id="card-available-balance" className="bg-white border-zinc-200">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Disponível</span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.available_balance_cents || 0)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Liberado para futuras gerações de vídeo e imagem
          </p>
        </Card>

        {/* Reserved Balance */}
        <Card id="card-reserved-balance" className="bg-white border-zinc-200">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Reservado</span>
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.reserved_balance_cents || 0)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Retido temporariamente durante processamento de jobs
          </p>
        </Card>

        {/* Total Balance */}
        <Card id="card-total-balance" className="bg-white border-zinc-200">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Total</span>
            <span className="p-1.5 rounded-md bg-zinc-100 text-zinc-700">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tabular-nums">
            {formatCentsToBRL(wallet?.total_balance_cents || 0)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Disponível + Reservado calculados diretamente do ledger
          </p>
        </Card>
      </div>

      {/* Main Content Split: Generations Section + Foundation Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Generation Activity */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            id="card-recent-generations"
            title="Gerações Recentes"
            subtitle="Histórico de processamento de vídeos e imagens"
            action={
              <Button
                id="dash-view-all-generations-btn"
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('history')}
              >
                Ver todas
              </Button>
            }
          >
            <EmptyState
              id="empty-generations-state"
              icon={<Sparkles className="w-6 h-6" />}
              title="Nenhuma geração realizada ainda"
              description="Ambiente criativo pronto. Sua carteira e saldo estão disponíveis para geração no Creative Workspace."
              action={
                <Button
                  id="dash-explore-create-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('create')}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Conhecer os Modelos Catalogados
                </Button>
              }
            />
          </Card>
        </div>

        {/* Right 1 Col: Platform Architectural Guarantees */}
        <div className="space-y-4">
          <Card
            id="card-architectural-specs"
            title="Garantias da Plataforma"
            subtitle="Diretrizes ativas de segurança e integridade"
          >
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-900 block">Razão Contábil (Ledger)</span>
                  <p className="text-zinc-500 leading-relaxed">
                    Nenhum ponto flutuante. Todos os saldos e transações utilizam centavos inteiros com derivação estrita.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-900 block">Zero-Trust & Firestore Rules</span>
                  <p className="text-zinc-500 leading-relaxed">
                    O cliente não tem autoridade direta sobre saldo, papéis ou catálogo de modelos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-900 block">Isolamento de Provedores</span>
                  <p className="text-zinc-500 leading-relaxed">
                    Atlas Cloud, WaveSpeed e Fal catalogados de forma segura sem exposição de segredos no cliente.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
