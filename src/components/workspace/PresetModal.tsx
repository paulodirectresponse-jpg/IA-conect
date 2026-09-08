import React, { useState } from 'react';
import { WorkspacePreset } from '../../types/index.js';
import { Bookmark, X, Check, Trash2, Plus, Sparkles } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: WorkspacePreset[];
  onApplyPreset: (preset: WorkspacePreset, mode: 'REPLACE' | 'MERGE') => void;
  onSaveCurrentAsPreset: (presetData: { name: string; description: string; category: string }) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  currentHasContent: boolean;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  presets,
  onApplyPreset,
  onSaveCurrentAsPreset,
  onDeletePreset,
  currentHasContent,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'LIST' | 'SAVE'>('LIST');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Comercial');
  const [saving, setSaving] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<WorkspacePreset | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaveCurrentAsPreset({ name: name.trim(), description: description.trim(), category });
      setName('');
      setDescription('');
      setActiveTab('LIST');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPreset = (preset: WorkspacePreset) => {
    if (currentHasContent) {
      setPendingPreset(preset);
    } else {
      onApplyPreset(preset, 'REPLACE');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div
        id="modal-presets-manager"
        className="w-full max-w-xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Presets de Produção</h2>
              <p className="text-xs text-zinc-500">Configurações prontas e templates de geração</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex gap-2 border-b border-zinc-100 bg-zinc-50/50 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`px-3 py-2 font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'LIST'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Templates & Presets ({presets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SAVE')}
            className={`px-3 py-2 font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'SAVE'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            + Salvar Setup Atual como Preset
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {pendingPreset ? (
            /* Confirmation for replace or merge */
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 text-center space-y-4">
              <Sparkles className="w-8 h-8 text-emerald-600 mx-auto" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Aplicar preset &quot;{pendingPreset.name}&quot;?</h3>
                <p className="text-zinc-500 text-xs mt-1">
                  Você já possui parâmetros e prompt configurados no Workspace.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onApplyPreset(pendingPreset, 'REPLACE');
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors cursor-pointer shadow-xs"
                >
                  Substituir Configuração Atual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyPreset(pendingPreset, 'MERGE');
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-medium transition-colors cursor-pointer"
                >
                  Mesclar Mantendo Meu Prompt
                </button>
              </div>
            </div>
          ) : activeTab === 'LIST' ? (
            <div className="space-y-2.5">
              {presets.map((preset) => {
                const isSystem = preset.user_id === 'system';
                return (
                  <div
                    key={preset.preset_id}
                    id={`preset-item-${preset.preset_id}`}
                    onClick={() => handleSelectPreset(preset)}
                    className="group p-3 rounded-xl bg-white border border-zinc-200 hover:border-emerald-500 hover:shadow-2xs cursor-pointer transition-all flex items-start justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 text-xs">{preset.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                          {preset.category}
                        </span>
                        {isSystem && (
                          <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            SISTEMA
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-[11px] mt-1 line-clamp-1">{preset.description}</p>
                      <p className="text-zinc-400 text-[10px] mt-1 truncate font-mono">
                        Prompt: &quot;{preset.prompt_template}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isSystem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePreset(preset.preset_id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="Excluir preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[11px] text-emerald-700 font-medium px-2 py-1 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        Aplicar
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Nome do Preset</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Comercial Perfume Dourado 10s"
                  required
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="Comercial">Comercial</option>
                  <option value="Cinematografia">Cinematografia</option>
                  <option value="Personagens">Personagens</option>
                  <option value="Moda & Luxo">Moda & Luxo</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explique para qual finalidade este preset foi afinado..."
                  rows={2}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="px-4 py-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{saving ? 'Salvando...' : 'Salvar Preset'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
