import React, { useEffect, useState, useRef } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';
import {
  FolderOpen,
  UploadCloud,
  Search,
  Image as ImageIcon,
  Video,
  Music,
  Trash2,
  Copy,
  Check,
  Edit2,
  X,
  ExternalLink,
  Plus,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const AssetsView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadAlias, setUploadAlias] = useState('');
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>('PRODUCT');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editCategory, setEditCategory] = useState<AssetCategory>('PRODUCT');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await assetService.listAssets();
      setAssets(res);
    } catch (err) {
      console.error('Erro ao carregar assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // Filtered list
  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.alias.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === 'ALL' || a.type === selectedType;
    const matchesCategory = selectedCategory === 'ALL' || a.category === selectedCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const handleCopyAlias = (alias: string, id: string) => {
    navigator.clipboard.writeText(`@${alias}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Deseja realmente remover este asset da sua biblioteca?')) return;
    try {
      await assetService.deleteAsset(assetId);
      setAssets(assets.filter((a) => a.asset_id !== assetId));
    } catch (err: any) {
      alert(err.message || 'Falha ao remover asset.');
    }
  };

  const handleStartEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditAlias(asset.alias);
    setEditCategory(asset.category);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await assetService.updateAsset(editingAsset.asset_id, {
        name: editName.trim(),
        alias: editAlias.trim(),
        category: editCategory,
      });

      setAssets(assets.map((a) => (a.asset_id === updated.asset_id ? updated : a)));
      setEditingAsset(null);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao atualizar dados do asset.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name.replace(/\.[^/.]+$/, ''));
      }
      if (!uploadAlias) {
        const clean = file.name
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 16);
        setUploadAlias(clean);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    try {
      const created = await assetService.uploadAsset({
        file: uploadFile,
        name: uploadName.trim() || uploadFile.name,
        alias: uploadAlias.trim() || undefined,
        category: uploadCategory,
        onProgress: (p) => setUploadProgress(p),
      });

      setAssets([created, ...assets]);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadAlias('');
    } catch (err: any) {
      setUploadError(err.message || 'Falha no envio do asset.');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-emerald-400" />
              <span>Biblioteca de Assets (@References)</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Gerencie imagens de produtos, personagens, trilhas e referências visuais para os prompts
          </p>
        </div>

        <button
          type="button"
          id="btn-open-upload-modal"
          onClick={() => setIsUploadModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/10 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Fazer Upload de Asset</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou @alias..."
            className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Type Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'IMAGE', label: 'Imagens' },
            { id: 'VIDEO', label: 'Vídeos' },
            { id: 'AUDIO', label: 'Áudios' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedType(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                selectedType === tab.id
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-zinc-700 w-full sm:w-auto"
        >
          <option value="ALL">Todas Categorias</option>
          <option value="PRODUCT">Produtos</option>
          <option value="CHARACTER">Personagens</option>
          <option value="ENVIRONMENT">Cenários</option>
          <option value="STYLE_REFERENCE">Estilo</option>
          <option value="MOTION_REFERENCE">Movimento</option>
          <option value="AUDIO_REFERENCE">Áudios</option>
        </select>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
          <p className="text-xs">Carregando seus assets...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-16 px-4 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl">
          <FolderOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Nenhum asset encontrado</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
            Faça upload de fotos de produtos, logos, personagens ou vídeos de referência. Eles recebem um <strong className="text-emerald-400 font-mono">@alias</strong> automático para você usar no Creative Workspace.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fazer Primeiro Upload</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.asset_id}
              id={`asset-card-${asset.asset_id}`}
              className="group bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden flex flex-col justify-between transition-all"
            >
              {/* Media Thumbnail */}
              <div className="w-full h-44 bg-zinc-950 flex items-center justify-center relative overflow-hidden border-b border-zinc-800/80">
                {asset.thumbnail_url || asset.public_url ? (
                  <img
                    src={asset.thumbnail_url || asset.public_url}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : asset.type === 'VIDEO' ? (
                  <Video className="w-10 h-10 text-sky-400" />
                ) : asset.type === 'AUDIO' ? (
                  <Music className="w-10 h-10 text-emerald-400" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-amber-400" />
                )}

                {/* Top Category Badge */}
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-md text-[10px] text-zinc-300 border border-zinc-700/60 font-medium">
                    {asset.category}
                  </span>
                </div>

                {/* Open in new tab */}
                {asset.public_url && (
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-950/80 backdrop-blur-md text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Ver mídia original"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Asset Info */}
              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-xs">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyAlias(asset.alias, asset.asset_id)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-mono font-semibold transition-colors"
                      title="Copiar @alias para colar no prompt"
                    >
                      <span>@{asset.alias}</span>
                      {copiedId === asset.asset_id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-emerald-500/60" />
                      )}
                    </button>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formatBytes(asset.size_bytes)}
                    </span>
                  </div>

                  <p className="font-semibold text-zinc-200 mt-1.5 truncate">{asset.name}</p>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-zinc-400">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(asset)}
                      className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Editar metadados"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(asset.asset_id)}
                      className="p-1.5 rounded-lg hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      title="Remover asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Upload de Novo Asset</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/60 rounded-2xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                {uploadFile ? (
                  <div>
                    <p className="font-semibold text-white">{uploadFile.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {formatBytes(uploadFile.size)} • Clique para trocar arquivo
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-zinc-200">Arraste ou clique para selecionar arquivo</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Imagens (até 25 MB), Vídeos (até 500 MB), Áudios (até 100 MB)
                    </p>
                  </div>
                )}
              </div>

              {uploadFile && (
                <>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Nome de Exibição</label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1">
                        Alias de Prompt (<strong className="text-emerald-400 font-mono">@alias</strong>)
                      </label>
                      <input
                        type="text"
                        value={uploadAlias}
                        onChange={(e) => setUploadAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-1">Categoria de Preservação</label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="PRODUCT">Produto (logo e geometria)</option>
                        <option value="CHARACTER">Personagem (rosto/consistência)</option>
                        <option value="ENVIRONMENT">Cenário / Background</option>
                        <option value="STYLE_REFERENCE">Estilo Visual</option>
                        <option value="MOTION_REFERENCE">Referência de Movimento</option>
                        <option value="AUDIO_REFERENCE">Trilha de Áudio</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {uploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Enviando arquivo...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold"
                >
                  {uploading ? 'Enviando...' : 'Salvar Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Editar Metadados do Asset</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Nome do Asset</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Alias (<strong className="text-emerald-400 font-mono">@alias</strong>)
                </label>
                <input
                  type="text"
                  value={editAlias}
                  onChange={(e) => setEditAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Categoria de Preservação</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as AssetCategory)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="PRODUCT">Produto (logo e geometria)</option>
                  <option value="CHARACTER">Personagem (rosto/consistência)</option>
                  <option value="ENVIRONMENT">Cenário / Background</option>
                  <option value="STYLE_REFERENCE">Estilo Visual</option>
                  <option value="MOTION_REFERENCE">Referência de Movimento</option>
                  <option value="AUDIO_REFERENCE">Trilha de Áudio</option>
                </select>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
