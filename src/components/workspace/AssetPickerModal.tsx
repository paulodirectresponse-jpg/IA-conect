import React, { useState, useRef } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';
import { Image as ImageIcon, Video, Music, Upload, X, Search, Check, AlertCircle } from 'lucide-react';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAssets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onAssetUploaded: (newAsset: Asset) => void;
  attachedAssetIds: string[];
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  availableAssets,
  onSelectAsset,
  onAssetUploaded,
  attachedAssetIds,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>('LIBRARY');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetAlias, setAssetAlias] = useState('');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('PRODUCT');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssets = availableAssets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.alias.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!assetName) {
        setAssetName(file.name.replace(/\.[^/.]+$/, ''));
      }
      if (!assetAlias) {
        const clean = file.name
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 16);
        setAssetAlias(clean);
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
        name: assetName.trim() || uploadFile.name,
        alias: assetAlias.trim() || undefined,
        category: assetCategory,
        onProgress: (p) => setUploadProgress(p),
      });

      onAssetUploaded(created);
      onSelectAsset(created);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar asset.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        id="modal-asset-picker"
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Selecionar Referência (@Asset)</h2>
              <p className="text-xs text-zinc-400">Escolha da sua biblioteca ou faça upload direto</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex gap-4 border-b border-zinc-800/80 bg-zinc-950/20 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('LIBRARY')}
            className={`pb-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'LIBRARY'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sua Biblioteca ({availableAssets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`pb-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'UPLOAD'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            + Upload Rápido
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'LIBRARY' ? (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar por nome ou @alias..."
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                >
                  <option value="ALL">Todas Categorias</option>
                  <option value="PRODUCT">Produtos</option>
                  <option value="CHARACTER">Personagens</option>
                  <option value="ENVIRONMENT">Cenários</option>
                  <option value="STYLE_REFERENCE">Estilo</option>
                  <option value="MOTION_REFERENCE">Movimento</option>
                  <option value="AUDIO_REFERENCE">Áudio</option>
                </select>
              </div>

              {/* Grid of assets */}
              {filteredAssets.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                  <p>Nenhum asset encontrado com os filtros selecionados.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('UPLOAD')}
                    className="mt-2 text-emerald-400 hover:underline font-medium"
                  >
                    Fazer upload de novo arquivo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredAssets.map((asset) => {
                    const isAlreadyAttached = attachedAssetIds.includes(asset.asset_id);

                    return (
                      <div
                        key={asset.asset_id}
                        id={`picker-asset-${asset.asset_id}`}
                        onClick={() => {
                          onSelectAsset(asset);
                          onClose();
                        }}
                        className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isAlreadyAttached
                            ? 'bg-zinc-950/40 border-zinc-800 opacity-60'
                            : 'bg-zinc-950/80 border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-950'
                        }`}
                      >
                        {/* Media Thumbnail */}
                        <div className="w-full h-24 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center relative mb-2">
                          {asset.thumbnail_url || asset.public_url ? (
                            <img
                              src={asset.thumbnail_url || asset.public_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : asset.type === 'VIDEO' ? (
                            <Video className="w-6 h-6 text-sky-400" />
                          ) : asset.type === 'AUDIO' ? (
                            <Music className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-amber-400" />
                          )}

                          {isAlreadyAttached && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-zinc-900/90 text-emerald-400 text-[9px] font-medium border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Anexado</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Alias */}
                        <div>
                          <p className="font-mono text-emerald-400 font-semibold text-xs truncate">
                            @{asset.alias}
                          </p>
                          <p className="text-zinc-300 text-[11px] truncate mt-0.5">{asset.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                              {asset.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Upload Tab */
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drop area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/60 rounded-2xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                {uploadFile ? (
                  <div>
                    <p className="font-medium text-white">{uploadFile.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Clique para trocar arquivo
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Nome do Asset</label>
                    <input
                      type="text"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Alias no Prompt (<strong className="text-emerald-400 font-mono">@alias</strong>)
                    </label>
                    <input
                      type="text"
                      value={assetAlias}
                      onChange={(e) => setAssetAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="ex: garrafa_dourada"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Categoria de Preservação</label>
                    <select
                      value={assetCategory}
                      onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PRODUCT">Produto (logo, geometria e cores)</option>
                      <option value="CHARACTER">Personagem (rosto e consistência)</option>
                      <option value="ENVIRONMENT">Cenário / Background</option>
                      <option value="STYLE_REFERENCE">Estilo Visual / Gradação</option>
                      <option value="MOTION_REFERENCE">Referência de Movimento</option>
                      <option value="AUDIO_REFERENCE">Trilha / Áudio de Referência</option>
                    </select>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Enviando arquivo para o storage...</span>
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
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIBRARY')}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Enviando...' : 'Fazer Upload e Anexar'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
