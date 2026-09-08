import React, { useEffect, useState } from 'react';
import { Plus, Tag, Calendar, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { PromotionEntry, ModelRegistryItem, ProviderRegistryItem, DiscountType } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminPromotions: React.FC = () => {
  const [promotions, setPromotions] = useState<PromotionEntry[]>([]);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [providers, setProviders] = useState<ProviderRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promos, mList, pList] = await Promise.all([
        adminService.listPromotions(),
        adminService.listModels(),
        adminService.listProviders(),
      ]);
      setPromotions(promos);
      setModels(mList);
      setProviders(pList);
    } catch (err) {
      console.error('Falha ao listar promoções:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setName('');
    setModelId(models[0]?.model_id || '');
    setProviderId(providers[0]?.provider_id || '');
    setDiscountType('PERCENTAGE');
    setDiscountValue(20);
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setStartsAt(now.toISOString().slice(0, 16));
    setExpiresAt(nextWeek.toISOString().slice(0, 16));
    setSourceNote('');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceNote.trim()) {
      setError('A nota sobre a origem da promoção é obrigatória.');
      return;
    }

    setSaveLoading(true);
    try {
      await adminService.savePromotion({
        name,
        model_id: modelId,
        provider_id: providerId,
        discount_type: discountType,
        discount_value: Number(discountValue),
        starts_at: new Date(startsAt).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        source_note: sourceNote,
        active: true,
      });

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar promoção.');
    } finally {
      setSaveLoading(false);
    }
  };

  const isExpired = (expiresAtStr: string) => {
    return new Date(expiresAtStr).getTime() <= Date.now();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Gestão de Promoções de Custo</h2>
          <p className="text-xs text-zinc-500">Descontos temporários negociados com provedores de computação</p>
        </div>
        <Button
          id="btn-add-promotion"
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Nova Promoção
        </Button>
      </div>

      <Card id="admin-promotions-card">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Carregando promoções...</div>
        ) : promotions.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">Nenhuma promoção cadastrada no momento.</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Nome / Descrição</th>
                  <th className="py-3 px-4">Modelo & Provedor</th>
                  <th className="py-3 px-4">Desconto</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 sm:px-6">Origem da Informação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {promotions.map((pr) => {
                  const expired = isExpired(pr.expires_at);
                  const mName = models.find((m) => m.model_id === pr.model_id)?.name || pr.model_id;
                  const pName = providers.find((p) => p.provider_id === pr.provider_id)?.name || pr.provider_id;

                  return (
                    <tr key={pr.promotion_id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4 sm:px-6 font-semibold text-zinc-900">
                        {pr.name}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        {mName} ({pName})
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        {pr.discount_type === 'PERCENTAGE'
                          ? `${pr.discount_value}% OFF`
                          : `R$ ${(pr.discount_value / 100).toFixed(2)} OFF`}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                        Até {new Date(pr.expires_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={expired ? 'danger' : pr.active ? 'success' : 'neutral'}>
                          {expired ? 'Expirada' : pr.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-zinc-500 max-w-xs truncate" title={pr.source_note}>
                        {pr.source_note || '—'}
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
        id="promotion-form-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Cadastrar Promoção de Custo"
        description="Vincule reduções de custo temporárias a provedores específicos"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Título da Campanha</label>
            <input
              id="promo-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Campanha de Lançamento WAN 2.1"
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Modelo</label>
              <select
                id="promo-model-select"
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
                id="promo-provider-select"
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
              <label className="block font-semibold text-zinc-700 mb-1">Tipo de Desconto</label>
              <select
                id="promo-type-select"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED_AMOUNT">Valor Fixo em Centavos</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Valor do Desconto</label>
              <input
                id="promo-value-input"
                type="number"
                min={1}
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Início</label>
              <input
                id="promo-start-input"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Término (Expiração)</label>
              <input
                id="promo-expire-input"
                type="datetime-local"
                required
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">
              Origem da Informação (Obrigatório)
            </label>
            <textarea
              id="promo-source-note"
              required
              rows={2}
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="Ex: Acordo promocional via e-mail do representante Atlas Cloud para o mês corrente..."
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none"
            />
          </div>

          <Button
            id="save-promotion-submit-btn"
            type="submit"
            variant="primary"
            size="md"
            isLoading={saveLoading}
            className="w-full mt-2"
          >
            Cadastrar Promoção
          </Button>
        </form>
      </Modal>
    </div>
  );
};
