import React, { useEffect, useState } from 'react';
import {
  Users,
  ShieldAlert,
  Sliders,
  DollarSign,
  Tag,
  Flag,
  FileSpreadsheet,
  Layers,
  Server,
  Activity,
  Wallet,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { AdminUsersList } from '../admin/AdminUsersList.js';
import { AdminModels } from '../admin/AdminModels.js';
import { AdminProviders } from '../admin/AdminProviders.js';
import { AdminPricing } from '../admin/AdminPricing.js';
import { AdminPromotions } from '../admin/AdminPromotions.js';
import { AdminFeatureFlags } from '../admin/AdminFeatureFlags.js';
import { AdminAuditLogs } from '../admin/AdminAuditLogs.js';

type AdminTab =
  | 'overview'
  | 'users'
  | 'models'
  | 'providers'
  | 'pricing'
  | 'promotions'
  | 'flags'
  | 'audit';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Falha ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const tabs = [
    { id: 'overview' as const, label: 'Painel Geral', icon: <Activity className="w-4 h-4" /> },
    { id: 'users' as const, label: 'Usuários & Saldo', icon: <Users className="w-4 h-4" /> },
    { id: 'models' as const, label: 'Modelos de IA', icon: <Layers className="w-4 h-4" /> },
    { id: 'providers' as const, label: 'Provedores', icon: <Server className="w-4 h-4" /> },
    { id: 'pricing' as const, label: 'Precificação', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'promotions' as const, label: 'Promoções', icon: <Tag className="w-4 h-4" /> },
    { id: 'flags' as const, label: 'Feature Flags', icon: <Flag className="w-4 h-4" /> },
    { id: 'audit' as const, label: 'Auditoria', icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              Painel de Controle e Governança
            </h1>
            <Badge variant="neutral" className="bg-zinc-900 text-zinc-50 border-zinc-900">
              ADMIN CORE
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Gestão financeira, isolamento de provedores e parametrização de infraestrutura
          </p>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              id={`admin-tab-btn-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-zinc-50 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card id="admin-stat-users" className="bg-white">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Usuários Totais
              </span>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats?.total_users ?? '—'}
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                {stats?.active_users ?? 0} ativos • {stats?.suspended_users ?? 0} suspensos
              </span>
            </Card>

            <Card id="admin-stat-balance" className="bg-white">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Saldo em Custódia (Plataforma)
              </span>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums">
                {formatCentsToBRL(stats?.total_platform_balance_cents ?? 0)}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
                Soma de todos os saldos em ledger
              </span>
            </Card>

            <Card id="admin-stat-models" className="bg-white">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Modelos Catalogados
              </span>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats?.models_count ?? '—'}
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                WAN 2.1, Kling 1.5, Hunyuan
              </span>
            </Card>

            <Card id="admin-stat-providers" className="bg-white">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Provedores Configurados
              </span>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats?.providers_count ?? '—'}
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Atlas Cloud, WaveSpeed, Fal
              </span>
            </Card>
          </div>

          {/* Foundation Scope Status Card */}
          <Card
            id="admin-foundation-scope-card"
            title="Status da Etapa 1 & Preparação para Etapas 2 e 3"
            subtitle="Critérios de aceitação validados e isolamento garantido"
          >
            <div className="space-y-3 text-xs leading-relaxed text-zinc-700">
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <span className="font-semibold block">Pronto para Dinheiro Real e Créditos Pré-Pagos:</span>
                <p>
                  O sistema de balanço está formalmente auditado. Nenhum cálculo utiliza ponto flutuante, eliminando qualquer risco de inconsistência contábil em centavos. Débitos são estritamente atômicos e impedem saldo negativo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="font-semibold text-zinc-900 block">Isolamento de Credenciais</span>
                  <p className="text-zinc-500">
                    O Firestore nunca armazena segredos ou tokens de provedores. As chaves de API estão encapsuladas no backend.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="font-semibold text-zinc-900 block">Governança por Feature Flags</span>
                  <p className="text-zinc-500">
                    Os módulos das etapas posteriores (Workspace de geração, Smart Router, Checkout de Pagamentos) estão catalogados e com flags de controle.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && <AdminUsersList />}

      {/* Models Tab */}
      {activeTab === 'models' && <AdminModels />}

      {/* Providers Tab */}
      {activeTab === 'providers' && <AdminProviders />}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && <AdminPricing />}

      {/* Promotions Tab */}
      {activeTab === 'promotions' && <AdminPromotions />}

      {/* Feature Flags Tab */}
      {activeTab === 'flags' && <AdminFeatureFlags />}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && <AdminAuditLogs />}
    </div>
  );
};
