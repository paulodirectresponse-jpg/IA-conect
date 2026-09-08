import React, { useEffect, useState } from 'react';
import { Plus, Edit2, AlertTriangle, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { PricingEntry, ModelRegistryItem, ProviderRegistryItem } from '../../types/index.js';
import { formatCentsToBRL, parseBRLToCents } from '../../config/constants.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminPricing: React.FC = () => {
  const [pricingList, setPricingList] = useState<PricingEntry[]>([]);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [providers, setProviders] = useState<ProviderRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PricingEntry | null>(null);

  // Form State
  const [modelId, setModelId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [providerCostStr, setProviderCostStr] = useState('');
  const [customerPriceStr, setCustomerPriceStr] = useState('');
  const [reason, setReason] = useState('');
  const [confirmedHighVariation, setConfirmedHighVariation] = useState(false);
  const [highVariationWarning, setHighVariationWarning] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pricingRes, modelsRes, providersRes] = await Promise.all([
        adminService.listPricing(),
        adminService.listModels(),
        adminService.listProviders(),
      ]);
      setPricingList(pricingRes);
      setModels(modelsRes);
      setProviders(providersRes);
    } catch (err) {
      console.error('Falha ao listar precificação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingPricing(null);
    setModelId(models[0]?.model_id || '');
    setProviderId(providers[0]?.provider_id || '');
    setResolution('720p');
    setDurationSeconds(5);
    setProviderCostStr('');
    setCustomerPriceStr('');
    setReason('');
    setConfirmedHighVariation(false);
    setHighVariationWarning(null);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: PricingEntry) => {
    setEditingPricing(p);
    setModelId(p.model_id);
    setProviderId(p.provider_id);
    setResolution(p.resolution);
    setDurationSeconds(p.duration_seconds || 5);
    setProviderCostStr((p.provider_cost_cents / 100).toFixed(2).replace('.', ','));
    setCustomerPriceStr((p.customer_price_cents / 100).toFixed(2).replace('.', ','));
    setReason('');
    setConfirmedHighVariation(false);
    setHighVariationWarning(null);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const providerCostCents = parseBRLToCents(providerCostStr);
    const customerPriceCents = parseBRLToCents(customerPriceStr);

    if (customerPriceCents <= 0) {
      setError('O preço ao cliente deve ser maior que zero.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError('A justificativa é obrigatória para registrar a trilha de auditoria de preços.');
      return;
    }

    setSaveLoading(true);

    try {
      const data: Partial<PricingEntry> = {
        pricing_id: editingPricing ? editingPricing.pricing_id : undefined,
        model_id: modelId,
        provider_id: providerId,
        resolution,
        duration_seconds: durationSeconds,
        unit: 'PER_GENERATION',
        provider_cost_cents: providerCostCents,
        customer_price_cents: customerPriceCents,
        active: true,
      };

      await adminService.savePricing(data, reason, confirmedHighVariation);
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.code === 'PRICE_VARIATION_HIGH') {
        setHighVariationWarning(err.message);
      } else {
        setError(err.message || 'Falha ao salvar precificação.');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Matriz de Precificação</h2>
          <p className="text-xs text-zinc-500">Custo de provedores vs. Preço ao consumidor com salvaguardas</p>
        </div>
        <Button
          id="btn-add-pricing"
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Nova Tarifa
        </Button>
      </div>

      <Card id="admin-pricing-card">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Carregando matriz de precificação...</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Modelo / Configuração</th>
                  <th className="py-3 px-4">Provedor</th>
                  <th className="py-3 px-4 text-right">Custo Provedor</th>
                  <th className="py-3 px-4 text-right">Preço Cliente</th>
                  <th className="py-3 px-4 text-right">Margem Bruta</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pricingList.map((p) => {
                  const mName = models.find((m) => m.model_id === p.model_id)?.name || p.model_id;
                  const pName = providers.find((pr) => pr.provider_id === p.provider_id)?.name || p.provider_id;
                  const marginCents = p.customer_price_cents - p.provider_cost_cents;
                  const marginPercent = p.provider_cost_cents > 0 ? (marginCents / p.provider_cost_cents) * 100 : 0;

                  return (
                    <tr key={p.pricing_id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4 sm:px-6">
                        <span className="font-semibold text-zinc-900 block">{mName}</span>
                        <span className="text-[11px] text-zinc-500">
                          {p.resolution} • {p.duration_seconds}s ({p.unit})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-700">{pName}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-600">
                        {formatCentsToBRL(p.provider_cost_cents)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-zinc-900">
                        {formatCentsToBRL(p.customer_price_cents)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="text-emerald-700 font-semibold">
                          +{formatCentsToBRL(marginCents)} ({marginPercent.toFixed(0)}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right">
                        <Button
                          id={`btn-edit-pricing-${p.pricing_id}`}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(p)}
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        id="pricing-form-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPricing ? 'Editar Tarifa de Preço' : 'Cadastrar Tarifa de Preço'}
        description="Controle estrito em centavos e proteção contra alterações bruscas"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
              {error}
            </div>
          )}

          {highVariationWarning && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{highVariationWarning}</span>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  id="confirm-variation-checkbox"
                  type="checkbox"
                  checked={confirmedHighVariation}
                  onChange={(e) => setConfirmedHighVariation(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span className="text-[11px] font-medium text-amber-900">
                  Estou ciente e confirmo expressamente a alteração de preço superior a 50%.
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Modelo</label>
              <select
                id="pricing-model-select"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Provedor</label>
              <select
                id="pricing-provider-select"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                {providers.map((pr) => (
                  <option key={pr.provider_id} value={pr.provider_id}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Resolução</label>
              <select
                id="pricing-res-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Duração (segundos)</label>
              <input
                id="pricing-duration-input"
                type="number"
                min={1}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Custo do Provedor (R$)</label>
              <input
                id="pricing-cost-input"
                type="text"
                required
                value={providerCostStr}
                onChange={(e) => setProviderCostStr(e.target.value)}
                placeholder="Ex: 0,35"
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Preço ao Cliente (R$)</label>
              <input
                id="pricing-price-input"
                type="text"
                required
                value={customerPriceStr}
                onChange={(e) => setCustomerPriceStr(e.target.value)}
                placeholder="Ex: 0,75"
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">
              Justificativa Obrigatória para Auditoria
            </label>
            <textarea
              id="pricing-reason-textarea"
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Ajuste de tabela alinhado com redução de custo da infraestrutura..."
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none"
            />
          </div>

          <Button
            id="save-pricing-submit-btn"
            type="submit"
            variant="primary"
            size="md"
            isLoading={saveLoading}
            className="w-full mt-2"
          >
            {editingPricing ? 'Salvar Alterações de Preço' : 'Cadastrar Tarifa'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};
