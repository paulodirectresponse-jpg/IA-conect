import React, { useEffect, useState } from 'react';
import { Plus, Check, Edit2, Layers, AlertCircle } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { ModelRegistryItem, ModelStatus, ModelCategory } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminModels: React.FC = () => {
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelRegistryItem | null>(null);

  // Form State
  const [modelId, setModelId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<ModelCategory>('VIDEO');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ModelStatus>('ACTIVE');
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModels = async () => {
    try {
      setLoading(true);
      const res = await adminService.listModels();
      setModels(res);
    } catch (err) {
      console.error('Falha ao listar modelos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleOpenCreate = () => {
    setEditingModel(null);
    setModelId('');
    setName('');
    setSlug('');
    setCategory('VIDEO');
    setDescription('');
    setStatus('ACTIVE');
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: ModelRegistryItem) => {
    setEditingModel(m);
    setModelId(m.model_id);
    setName(m.name);
    setSlug(m.slug);
    setCategory(m.category);
    setDescription(m.description);
    setStatus(m.status);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveLoading(true);

    try {
      const data = {
        model_id: modelId || slug,
        name,
        slug,
        category,
        description,
        status,
      };

      if (editingModel) {
        await adminService.updateModel(editingModel.model_id, data);
      } else {
        await adminService.saveModel(data);
      }

      setModalOpen(false);
      loadModels();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar modelo.');
    } finally {
      setSaveLoading(false);
    }
  };

  const getStatusBadge = (st: ModelStatus) => {
    switch (st) {
      case 'ACTIVE':
        return <Badge variant="success">Ativo</Badge>;
      case 'EXPERIMENTAL':
        return <Badge variant="warning">Experimental</Badge>;
      case 'INACTIVE':
        return <Badge variant="danger">Inativo</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Catálogo de Modelos (Model Registry)</h2>
          <p className="text-xs text-zinc-500">Modelos de IA homologados para roteamento e precificação</p>
        </div>
        <Button
          id="btn-add-model"
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Cadastrar Modelo
        </Button>
      </div>

      <Card id="admin-models-card">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Carregando catálogo de modelos...</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Nome do Modelo</th>
                  <th className="py-3 px-4">Identificador (Slug)</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {models.map((m) => (
                  <tr key={m.model_id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <span className="font-semibold text-zinc-900 block">{m.name}</span>
                      <span className="text-[11px] text-zinc-500 line-clamp-1">{m.description}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600">{m.slug}</td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{m.category}</Badge>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(m.status)}</td>
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <Button
                        id={`btn-edit-model-${m.model_id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(m)}
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
        id="model-form-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingModel ? 'Editar Modelo de IA' : 'Novo Modelo de IA'}
        description="Parâmetros oficiais e metadados de execução"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Nome de Exibição</label>
            <input
              id="model-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingModel) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }
              }}
              placeholder="Ex: WAN 2.1 Video"
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Slug / Identificador Único</label>
            <input
              id="model-slug-input"
              type="text"
              required
              disabled={!!editingModel}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Ex: wan-2-1-video"
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 disabled:bg-zinc-100 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Categoria</label>
              <select
                id="model-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ModelCategory)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                <option value="VIDEO">VIDEO</option>
                <option value="IMAGE">IMAGE</option>
                <option value="AUDIO">AUDIO</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Status</label>
              <select
                id="model-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ModelStatus)}
                className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900"
              >
                <option value="ACTIVE">ACTIVE (Ativo)</option>
                <option value="EXPERIMENTAL">EXPERIMENTAL (Em testes)</option>
                <option value="INACTIVE">INACTIVE (Desativado)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Descrição</label>
            <textarea
              id="model-desc-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as especificações técnicas e capacidades do modelo..."
              className="w-full p-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none"
            />
          </div>

          <Button
            id="save-model-submit-btn"
            type="submit"
            variant="primary"
            size="md"
            isLoading={saveLoading}
            className="w-full mt-2"
          >
            {editingModel ? 'Salvar Alterações' : 'Cadastrar no Registro'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};
