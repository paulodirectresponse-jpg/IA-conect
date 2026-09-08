import React, { useEffect, useState } from 'react';
import { Plus, Edit2, ShieldAlert, Server, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { ProviderRegistryItem, ProviderStatus } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminProviders: React.FC = () => {
  const [providers, setProviders] = useState<ProviderRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderRegistryItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<ProviderStatus>('ACTIVE');
  const [priority, setPriority] = useState<number>(100);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await adminService.listProviders();
      setProviders(res);
    } catch (err) {
      console.error('Falha ao listar provedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleOpenCreate = () => {
    setEditingProvider(null);
    setName('');
    setSlug('');
    setStatus('ACTIVE');
    setPriority(100);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: ProviderRegistryItem) => {
    setEditingProvider(p);
    setName(p.name);
    setSlug(p.slug);
    setStatus(p.status);
    setPriority(p.priority);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveLoading(true);

    try {
      const data = {
        provider_id: editingProvider ? editingProvider.provider_id : `provider-${slug}`,
        name,
        slug,
        status,
        priority: Number(priority),
        is_configured: false, // Secrets never stored in registry
      };

      if (editingProvider) {
        await adminService.updateProvider(editingProvider.provider_id, data);
      } else {
        await adminService.saveProvider(data);
      }

      setModalOpen(false);
      loadProviders();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar provedor.');
    } finally {
      setSaveLoading(false);
    }
  };

  const getStatusBadge = (st: ProviderStatus) => {
    switch (st) {
      case 'ACTIVE':
        return <Badge variant="success">Ativo</Badge>;
      case 'DEGRADED':
        return <Badge variant="warning">Degradado</Badge>;
      case 'INACTIVE':
        return <Badge variant="danger">Inativo</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Provedores de Computação (Provider Registry)</h2>
          <p className="text-xs text-zinc-500">Clusters de geração por API catalogados para roteamento automático</p>
        </div>
        <Button
          id="btn-add-provider"
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Cadastrar Provedor
        </Button>
      </div>

      {/* Security Architecture Note */}
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs text-zinc-700">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          <strong>Diretriz de Segurança:</strong> As chaves de API nunca são salvas no Firestore ou expostas ao cliente. Elas residem exclusivamente no backend (Secret Manager / Environment).
        </span>
      </div>

      <Card id="admin-providers-card">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Carregando provedores...</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Nome</th>
                  <th className="py-3 px-4">Identificador (Slug)</th>
                  <th className="py-3 px-4">Prioridade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {providers.map((p) => (
                  <tr key={p.provider_id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600">{p.slug}</td>
                    <td className="py-3 px-4 font-semibold text-zinc-900 tabular-nums">{p.priority}</td>
                    <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <Button
                        id={`btn-edit-provider-${p.provider_id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(p)}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        id="provider-form-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProvider ? 'Editar Provedor' : 'Novo Provedor'}
        description="Configuração de metadados e prioridade de roteamento"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Nome do Provedor</label>
            <input
              id="provider-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingProvider) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }
              }}
              placeholder="Ex: Atlas Cloud"
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Slug / Identificador</label>
            <input
              id="provider-slug-input"
              type="text"
              required
              disabled={!!editingProvider}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Ex: atlas-cloud"
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 disabled:bg-zinc-100 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Status Operacional</label>
              <select
                id="provider-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProviderStatus)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                <option value="ACTIVE">ACTIVE (Operação Normal)</option>
                <option value="DEGRADED">DEGRADED (Latência / Falhas Parciais)</option>
                <option value="INACTIVE">INACTIVE (Indisponível)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Prioridade (0 - 100)</label>
              <input
                id="provider-priority-input"
                type="number"
                min={0}
                max={100}
                required
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              />
            </div>
          </div>

          <Button
            id="save-provider-submit-btn"
            type="submit"
            variant="primary"
            size="md"
            isLoading={saveLoading}
            className="w-full mt-2"
          >
            {editingProvider ? 'Salvar Alterações' : 'Cadastrar Provedor'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};
