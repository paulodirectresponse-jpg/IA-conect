import React from 'react';
import { GenerationRequestDraft } from '../../types/index.js';
import { CheckCircle, AlertTriangle, Shield, Wallet, Film, Clock, Eye, X, ArrowRight } from 'lucide-react';

interface GenerationRequestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftData: (GenerationRequestDraft & { has_sufficient_funds: boolean; balance_after_generation_cents: number }) | null;
  notice: string;
  onNavigateToWallet?: () => void;
}

export const GenerationRequestPreviewModal: React.FC<GenerationRequestPreviewModalProps> = ({
  isOpen,
  onClose,
  draftData,
  notice,
  onNavigateToWallet,
}) => {
  if (!isOpen || !draftData) return null;

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) {
      return 'Preço ainda não disponível';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const hasPricing = draftData.estimated_cost_cents !== null && draftData.estimated_cost_cents !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        id="modal-generation-request-preview"
        className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Validação & Compilação de Produção</h2>
              <p className="text-xs text-zinc-500">Parâmetros técnicos e referências estruturadas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
            <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs text-emerald-950">Parâmetros Validados com Sucesso</p>
              <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">{notice}</p>
            </div>
          </div>

          {/* Model & Technical Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              <span className="text-[10px] text-zinc-500 block">Modelo</span>
              <span className="font-semibold text-zinc-900 mt-0.5 block truncate">{draftData.model_name}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              <span className="text-[10px] text-zinc-500 block">Modo</span>
              <span className="font-semibold text-zinc-900 mt-0.5 block truncate">{draftData.mode}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              <span className="text-[10px] text-zinc-500 block">Duração & Resolução</span>
              <span className="font-semibold text-zinc-900 mt-0.5 block truncate">
                {draftData.settings.duration_seconds}s • {draftData.settings.resolution} ({draftData.settings.aspect_ratio})
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
              <span className="text-[10px] text-zinc-500 block">Variações</span>
              <span className="font-semibold text-zinc-900 mt-0.5 block">
                {draftData.settings.number_of_outputs} saída(s)
              </span>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-zinc-500 text-[11px]">Custo Estimado da Produção</p>
                <p className={`text-sm font-bold ${hasPricing ? 'text-zinc-900' : 'text-amber-600'}`}>
                  {formatCurrency(draftData.estimated_cost_cents)}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-zinc-500 text-[11px]">Seu Saldo Disponível</p>
              <p className="text-xs font-semibold text-zinc-900">
                {formatCurrency(draftData.customer_balance_available_cents)}
              </p>
            </div>
          </div>

          {!hasPricing && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Configuração de preço pendente no catálogo para esta resolução.</span>
            </div>
          )}

          {hasPricing && !draftData.has_sufficient_funds && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Saldo insuficiente na carteira para cobrir a estimativa.</span>
              </div>
              {onNavigateToWallet && (
                <button
                  type="button"
                  onClick={onNavigateToWallet}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-[11px]"
                >
                  Recarregar
                </button>
              )}
            </div>
          )}

          {/* Compiled Prompt View */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-zinc-700 font-medium">Prompt Compilado (com referências @ estruturadas)</label>
              <span className="text-[10px] text-zinc-400 font-mono">
                {draftData.references.length} referências injetadas
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900 text-zinc-100 whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-40 overflow-y-auto border border-zinc-800">
              {draftData.compiled_prompt}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <span className="text-[11px] text-zinc-400 font-mono">ID: {draftData.request_id}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
