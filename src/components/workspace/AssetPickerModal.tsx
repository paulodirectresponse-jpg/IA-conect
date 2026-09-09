import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';
import { ASSET_UPLOAD_LIMITS } from '../../config/constants.js';
import {
  Image as ImageIcon,
  Video,
  Music,
  Upload,
  X,
  Search,
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
  RefreshCw,
  Ban,
} from 'lucide-react';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAssets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onAssetUploaded: (newAsset: Asset) => void;
  attachedAssetIds: string[];
  title?: string;
  subtitle?: string;
  defaultTab?: 'LIBRARY' | 'UPLOAD';
  allowedTypes?: AssetType[];
}

const displayNameForFile = (file: File) =>
  file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || file.name;

const categoryForType = (type: AssetType): AssetCategory => {
  if (type === 'VIDEO') return 'MOTION';
  if (type === 'AUDIO') return 'AUDIO_REFERENCE';
  return 'GENERIC';
};

const detectType = (file: File): AssetType => {
  if (file.type.startsWith('video/')) return 'VIDEO';
  if (file.type.startsWith('audio/')) return 'AUDIO';
  return 'IMAGE';
};

const TypeIcon: React.FC<{ type: AssetType }> = ({ type }) => {
  if (type === 'VIDEO') return <Video className="w-5 h-5 text-sky-500" />;
  if (type === 'AUDIO') return <Music className="w-5 h-5 text-violet-500" />;
  return <ImageIcon className="w-5 h-5 text-zinc-400" />;
};

function mergeAssets(...groups: Asset[][]): Asset[] {
  const map = new Map<string, Asset>();
  for (const group of groups) {
    for (const asset of group || []) {
      if (!asset?.asset_id) continue;
      map.set(asset.asset_id, asset);
    }
  }
  return Array.from(map.values()).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  availableAssets,
  onSelectAsset,
  onAssetUploaded,
  attachedAssetIds,
  title = 'Adicionar mídia',
  subtitle = 'Envie um arquivo agora ou use algo que já está na sua Biblioteca de Assets.',
  defaultTab = 'UPLOAD',
  allowedTypes = ['IMAGE', 'VIDEO', 'AUDIO'],
}) => {
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>(defaultTab);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>(availableAssets || []);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<{ cancel: () => void } | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const latest = await assetService.listAssets();
      setLibraryAssets((current) => mergeAssets(latest, availableAssets, current));
    } catch (err: any) {
      setLibraryError(err?.message || 'Não foi possível carregar a Biblioteca de Assets.');
      setLibraryAssets((current) => mergeAssets(availableAssets, current));
    } finally {
      setLibraryLoading(false);
    }
  }, [availableAssets]);

  useEffect(() => {
    setLibraryAssets((current) => mergeAssets(availableAssets, current));
  }, [availableAssets]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultTab);
    setSearch('');
    setUploadError(null);
    setUploadProgress(0);
    setActiveFileName('');
    setLibraryAssets((current) => mergeAssets(availableAssets, current));
    void refreshLibrary();
  }, [isOpen, defaultTab, availableAssets, refreshLibrary]);

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return libraryAssets.filter(
      (a) =>
        !a.deleted_at &&
        (!q || a.name.toLowerCase().includes(q) || a.alias.toLowerCase().includes(q))
    );
  }, [libraryAssets, search]);

  const libraryCount = useMemo(
    () => libraryAssets.filter((a) => !a.deleted_at).length,
    [libraryAssets]
  );

  if (!isOpen) return null;

  const validateFile = (file: File) => {
    const type = detectType(file);
    if (!allowedTypes.includes(type)) {
      throw new Error(
        allowedTypes.length === 1 && allowedTypes[0] === 'IMAGE'
          ? 'Este campo aceita apenas imagens.'
          : 'Este tipo de arquivo não é suportado pela IA/configuração atual.'
      );
    }
    if (file.size > ASSET_UPLOAD_LIMITS[type].max_bytes) {
      const mb = Math.round(ASSET_UPLOAD_LIMITS[type].max_bytes / (1024 * 1024));
      throw new Error(`O arquivo excede o limite atual de ${mb} MB para ${type.toLowerCase()}.`);
    }
    return type;
  };

  const uploadImmediately = async (file?: File) => {
    if (!file || uploading) return;
    setUploadError(null);
    let type: AssetType;
    try {
      type = validateFile(file);
    } catch (err: any) {
      setUploadError(err.message || 'Arquivo incompatível.');
      return;
    }

    setUploading(true);
    setUploadProgress(1);
    setActiveFileName(file.name);
    try {
      const created = await assetService.uploadAsset({
        file,
        name: displayNameForFile(file),
        category: categoryForType(type),
        onProgress: setUploadProgress,
        onTaskReady: (task) => {
          taskRef.current = task;
        },
      });
      taskRef.current = null;
      setLibraryAssets((current) => mergeAssets([created], current));
      onAssetUploaded(created);
      onSelectAsset(created);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar a mídia.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const accept = [
    allowedTypes.includes('IMAGE') ? 'image/*' : '',
    allowedTypes.includes('VIDEO') ? 'video/*' : '',
    allowedTypes.includes('AUDIO') ? 'audio/*' : '',
  ]
    .filter(Boolean)
    .join(',');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden text-zinc-900 flex flex-col max-h-[86vh]">
        <header className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5 max-w-lg leading-relaxed">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 pt-3 flex gap-1 border-b border-zinc-100 bg-zinc-50/40">
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
              activeTab === 'UPLOAD' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-zinc-500'
            }`}
          >
            Enviar novo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LIBRARY')}
            className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
              activeTab === 'LIBRARY' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-zinc-500'
            }`}
          >
            Biblioteca ({libraryCount})
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'UPLOAD' ? (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="hidden"
                disabled={uploading}
                onChange={(e) => uploadImmediately(e.target.files?.[0])}
              />

              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!uploading) uploadImmediately(e.dataTransfer.files?.[0]);
                }}
                className={`min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center px-8 transition-all ${
                  uploading
                    ? 'border-emerald-300 bg-emerald-50/40 cursor-wait'
                    : 'border-zinc-200 bg-zinc-50/60 hover:bg-emerald-50/25 hover:border-emerald-400 cursor-pointer'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shadow-sm">
                      <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-zinc-800 truncate max-w-full">{activeFileName}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">Enviando e anexando automaticamente...</p>
                    <div className="mt-3 w-full max-w-xs h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${Math.max(2, uploadProgress)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-mono text-[10px] text-emerald-700">{uploadProgress}%</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          taskRef.current?.cancel();
                        }}
                        className="text-[10px] text-zinc-500 hover:text-red-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                      <Upload className="w-5 h-5 text-zinc-500" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-zinc-800">Clique ou arraste um arquivo</p>
                    <p className="mt-1 text-[10px] text-zinc-500 max-w-sm leading-relaxed">
                      Sem formulário. O nome é criado automaticamente, o upload começa na hora e a mídia entra neste vídeo assim que terminar.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap justify-center">
                      {allowedTypes.map((type) => (
                        <span key={type} className="px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-[9px] text-zinc-500">
                          {type === 'IMAGE' ? 'Imagens' : type === 'VIDEO' ? 'Vídeos' : 'Áudios'}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar na Biblioteca de Assets..."
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void refreshLibrary()}
                  disabled={libraryLoading}
                  className="w-10 h-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-emerald-700 hover:border-emerald-300 disabled:opacity-50"
                  title="Atualizar biblioteca"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${libraryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {libraryError && (
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px]">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{libraryError}</span>
                  </div>
                  <button type="button" onClick={() => void refreshLibrary()} className="font-semibold whitespace-nowrap">
                    Tentar novamente
                  </button>
                </div>
              )}

              {libraryLoading && libraryCount === 0 ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-7 h-7 text-emerald-600 mx-auto animate-spin" />
                  <p className="mt-2 text-xs font-semibold text-zinc-600">Carregando sua biblioteca...</p>
                </div>
              ) : visibleAssets.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visibleAssets.map((asset) => {
                    const attached = attachedAssetIds.includes(asset.asset_id);
                    const compatible = allowedTypes.includes(asset.type);
                    const url = asset.thumbnail_url || asset.public_url;
                    return (
                      <button
                        key={asset.asset_id}
                        type="button"
                        disabled={attached || !compatible}
                        onClick={() => {
                          onSelectAsset(asset);
                          onClose();
                        }}
                        className={`group text-left rounded-xl border overflow-hidden transition-all ${
                          attached
                            ? 'border-emerald-200 bg-emerald-50/40 cursor-default'
                            : !compatible
                              ? 'border-zinc-200 bg-zinc-50 opacity-65 cursor-not-allowed'
                              : 'border-zinc-200 bg-white hover:border-emerald-400 hover:shadow-sm'
                        }`}
                      >
                        <div className="h-28 bg-zinc-100 relative flex items-center justify-center overflow-hidden">
                          {asset.type === 'IMAGE' && url ? (
                            <img src={url} alt={asset.name} className="w-full h-full object-cover" />
                          ) : (
                            <TypeIcon type={asset.type} />
                          )}
                          {attached && (
                            <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/95 border border-emerald-200 text-[9px] font-semibold text-emerald-700 shadow-sm">
                              <Check className="w-2.5 h-2.5" /> Neste vídeo
                            </span>
                          )}
                          {!compatible && !attached && (
                            <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/95 border border-zinc-200 text-[9px] font-semibold text-zinc-600 shadow-sm">
                              <Ban className="w-2.5 h-2.5" /> Incompatível
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-semibold text-zinc-800 truncate">{asset.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] uppercase text-zinc-400">{asset.type}</span>
                            <span className="text-[9px] text-zinc-400">{(asset.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <FolderOpen className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="mt-2 text-xs font-semibold text-zinc-600">{search ? 'Nenhum asset corresponde à busca' : 'Sua biblioteca está vazia'}</p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {search ? 'Limpe a busca ou atualize a biblioteca.' : 'Envie um novo arquivo e ele ficará disponível aqui automaticamente.'}
                  </p>
                  {!search && (
                    <button type="button" onClick={() => setActiveTab('UPLOAD')} className="mt-3 text-[11px] font-semibold text-emerald-700">
                      Enviar agora
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
