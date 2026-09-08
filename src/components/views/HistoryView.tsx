import React from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { Card } from '../common/Card.js';
import { EmptyState } from '../common/EmptyState.js';

export const HistoryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Histórico de Gerações
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Registro de execuções, tempo de processamento e deduções de saldo
        </p>
      </div>

      <Card id="history-container-card">
        <EmptyState
          id="empty-history-view"
          icon={<Clock className="w-6 h-6" />}
          title="Nenhum job de geração executado"
          description="O histórico registrará cada execução de IA com seu respectivo job_id, provedor roteado, custo exato deduzido e status do processamento assim que a Etapa 2 for iniciada."
        />
      </Card>
    </div>
  );
};
