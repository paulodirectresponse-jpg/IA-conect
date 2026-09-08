import React, { useEffect, useState } from 'react';
import { Sparkles, Video, Info, Check, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';
import { ModelRegistryItem, PricingEntry } from '../../types/index.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';

export const CreateView: React.FC = () => {
  const { wallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [modelsRes, pricingRes] = await Promise.all([
          apiRequest<ModelRegistryItem[]>('/api/catalog/models'),
          apiRequest<PricingEntry[]>('/api/catalog/pricing'),
        ]);
        setModels(modelsRes);
        setPricing(pricingRes);
        if (modelsRes.length > 0) {
          setSelectedModelId(modelsRes[0].model_id);
        }
      } catch (err) {
        console.error('Falha ao carregar catálogo para criação:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  const selectedModel = models.find((m) => m.model_id === selectedModelId);

  // Compute pricing from catalog
  const matchingPrice = pricing.find(
    (p) => p.model_id === selectedModelId && p.resolution === resolution && p.active
  ) || pricing.find((p) => p.model_id === selectedModelId && p.active);

  const estimatedCostCents = matchingPrice?.customer_price_cents || 75;
  const hasEnoughFunds = (wallet?.available_balance_cents || 0) >= estimatedCostCents;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Nova Geração de Vídeo
          </h1>
          <Badge variant="info">Preparado para Etapa 2</Badge>
        </div>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Configuração de parâmetros e estimativa de débito contábil
        </p>
      </div>

      {/* Stage 1 Scope Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold block mb-0.5">
            Escopo da Etapa 1 — Integridade e Catálogo
          </strong>
          Conforme a especificação mestre, nenhum provedor de IA (Atlas, WaveSpeed, Fal) deve ser disparado nesta fase.
          A interface abaixo demonstra a seleção de modelos reais catalogados, derivação de preços em centavos e validação de saldo antes do disparo que será conectado na Etapa 2.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prompt & Model Selector */}
        <div className="lg:col-span-2 space-y-4">
          <Card id="create-prompt-card" title="Prompt & Modelo">
            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400">Carregando catálogo...</div>
            ) : (
              <div className="space-y-4">
                {/* Model Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">
                    Selecione o Modelo
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {models.map((m) => {
                      const isSelected = m.model_id === selectedModelId;
                      return (
                        <button
                          key={m.model_id}
                          id={`model-select-${m.model_id}`}
                          type="button"
                          onClick={() => setSelectedModelId(m.model_id)}
                          className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-zinc-900 bg-zinc-900 text-zinc-50 shadow-xs'
                              : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{m.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <span
                            className={`text-[10px] block mt-1 ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            {m.category} • {m.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt Input */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Descrição da Cena (Prompt)
                  </label>
                  <textarea
                    id="create-prompt-textarea"
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Descreva detalhadamente a cena em movimento, ângulo de câmera e iluminação..."
                    className="w-full p-3 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 resize-none"
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    Otimizador de prompts e referências com @ serão ativados na Etapa 2.
                  </span>
                </div>

                {/* Resolution & Duration */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Resolução
                    </label>
                    <select
                      id="create-resolution-select"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="720p">720p (HD Padrão)</option>
                      <option value="1080p">1080p (FHD Pro)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Duração
                    </label>
                    <select
                      id="create-duration-select"
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                      className="w-full p-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value={5}>5 segundos</option>
                      <option value={10}>10 segundos</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Cost Breakdown & Pre-check */}
        <div>
          <Card
            id="create-cost-summary-card"
            title="Custo Estimado"
            subtitle="Calculado a partir da matriz de precificação"
          >
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                <div className="flex justify-between text-zinc-600">
                  <span>Modelo:</span>
                  <span className="font-medium text-zinc-900">{selectedModel?.name || '—'}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Resolução:</span>
                  <span className="font-medium text-zinc-900">{resolution}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Duração:</span>
                  <span className="font-medium text-zinc-900">{durationSeconds}s</span>
                </div>
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-baseline">
                  <span className="font-semibold text-zinc-900">Preço ao Cliente:</span>
                  <span className="text-base font-bold text-zinc-900 tabular-nums">
                    {formatCentsToBRL(estimatedCostCents)}
                  </span>
                </div>
              </div>

              {/* Wallet check */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Seu saldo disponível:</span>
                  <span className="font-semibold text-zinc-900 tabular-nums">
                    {formatCentsToBRL(wallet?.available_balance_cents || 0)}
                  </span>
                </div>

                {!hasEnoughFunds && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 text-rose-700 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Saldo insuficiente para esta geração.</span>
                  </div>
                )}
              </div>

              <Button
                id="create-action-btn"
                variant="primary"
                size="md"
                disabled={!hasEnoughFunds || !prompt.trim()}
                className="w-full"
                icon={<Sparkles className="w-4 h-4 text-amber-300" />}
                onClick={() => {
                  alert('Validação bem-sucedida! O disparo de IA será habilitado na Etapa 2.');
                }}
              >
                Gerar com IA (Etapa 2)
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
