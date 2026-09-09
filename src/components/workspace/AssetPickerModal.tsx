import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Box,
  Check,
  FolderKanban,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  Search,
  Upload,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import { Asset, AssetCategory, AssetType } from '../../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../../config/constants.js';
import { assetService } from '../../services/assetService.js';
import { creativeEntityService, CreativeEntity } from '../../services/creativeEntityService.js';

export type AssetPickerContentView = 'ASSETS' | 'CHARACTERS' | 'PRODUCTS' | 'STYLES';
type Scope = 'GLOBAL' | 'PROJECT';
type TypeFilter = 'ALL' | AssetType;
type OriginFilter = 'ALL' | 'UPLOAD' | 'GENERATED';

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
  defaultContentView?: AssetPickerContentView;
}

const displayNameForFile = (file: File) =>
  file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || file.name;

const categoryForType = (type: AssetType): AssetCategory =>
  type === 'VIDEO' ? 'MOTION' : type === 'AUDIO' ? 'AUDIO_REFERENCE' : 'GENERIC';

const detectType = (file: File): AssetType =>
  file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('audio/') ? 'AUDIO' : 'IMAGE';

const originOf = (asset: Asset): 'UPLOAD' | 'GENERATED' =>
  String((asset as any).origin || 'UPLOAD').toUpperCase() === 'GENERATED' ? 'GENERATED' : 'UPLOAD';

function mergeAssets(...groups: Asset[][]): Asset[] {
  const byId = new Map<string, Asset>();
  for (const group of groups) {
    for (const asset of group || []) {
      if (asset?.asset_id) byId.set(asset.asset_id, asset);
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

const TypeIcon: React.FC<{ type: AssetType }> = ({ type }) => {
  if (type === 'VIDEO') return <Video className="h-5 w-5 text-cyan-300" />;
  if (type === 'AUDIO') return <Music className="h-5 w-5 text-violet-300" />;
  return <ImageIcon className="h-5 w-5 text-zinc-500" />;
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] py-16 text-center">
    <FolderOpen className="mx-auto h-8 w-8 text-zinc-800" />
    <p className="mt-3 text-[10px] font-semibold text-zinc-400">{label}</p>
    <p className="mt-1 text-[8px] text-zinc-700">Use a Biblioteca para organizar e reutilizar referências.</p>
  </div>
);

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  availableAssets,
  onSelectAsset,
  onAssetUploaded,
  attachedAssetIds,
  title = 'Adicionar mídia',
  subtitle = 'Escolha algo da sua Biblioteca ou envie um novo arquivo.',
  defaultTab = 'LIBRARY',
  allowedTypes = ['IMAGE', 'VIDEO', 'AUDIO'],
  defaultContentView = 'ASSETS',
}) => {
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>(defaultTab);
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [activeProjectId, setActiveProjectId] = useState('');
  const [projects, setProjects] = useState<CreativeEntity[]>([]);
  const [characters, setCharacters] = useState<CreativeEntity[]>([]);
  const [products, setProducts] = useState<CreativeEntity[]>([]);
  const [styles, setStyles] = useState<CreativeEntity[]>([]);
  const [contentView, setContentView] = useState<AssetPickerContentView>(defaultContentView);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>(availableAssets || []);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<{ cancel: () => void } | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const [latest, projectRows, characterRows, productRows, styleRows] = await Promise.all([
        assetService.listAssets(),
        creativeEntityService.list('PROJECT').catch(() => []),
        creativeEntityService.list('CHARACTER').catch(() => []),
        creativeEntityService.list('PRODUCT').catch(() => []),
        creativeEntityService.list('STYLE').catch(() => []),
      ]);
      setLibraryAssets((current) => mergeAssets(latest, availableAssets, current));
      setProjects(projectRows);
      setCharacters(characterRows);
      setProducts(productRows);
      setStyles(styleRows);
    } catch (err: any) {
      setLibraryError(err?.message || 'Não foi possível carregar sua Biblioteca.');
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
    setScope('GLOBAL');
    setActiveProjectId('');
    setContentView(defaultContentView);
    setSearch('');
    setTypeFilter('ALL');
    setOriginFilter('ALL');
    setUploadError(null);
    setUploadProgress(0);
    setActiveFileName('');
    setLibraryAssets((current) => mergeAssets(availableAssets, current));
    void refreshLibrary();
  }, [isOpen, defaultTab, defaultContentView, availableAssets, refreshLibrary]);

  const activeProject = projects.find((project) => project.entity_id === activeProjectId) || null;
  const projectAssetIds = useMemo(() => new Set(activeProject?.asset_ids || []), [activeProject]);
  const scopedAssets = useMemo(
    () => scope !== 'PROJECT' || !activeProject
      ? libraryAssets
      : libraryAssets.filter((asset) => projectAssetIds.has(asset.asset_id)),
    [libraryAssets, scope, activeProject, projectAssetIds],
  );

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedAssets.filter((asset) =>
      !asset.deleted_at &&
      (typeFilter === 'ALL' || asset.type === typeFilter) &&
      (originFilter === 'ALL' || originOf(asset) === originFilter) &&
      (!q || asset.name.toLowerCase().includes(q) || asset.alias.toLowerCase().includes(q)),
    );
  }, [scopedAssets, search, typeFilter, originFilter]);

  const entitySource = contentView === 'CHARACTERS' ? characters : contentView === 'PRODUCTS' ? products : styles;
  const visibleEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entitySource.filter((entity) => {
      const linked = entity.asset_ids || [];
      if (scope === 'PROJECT' && activeProject && !linked.some((id) => projectAssetIds.has(id))) return false;
      if (q && !`${entity.name} ${entity.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entitySource, search, scope, activeProject, projectAssetIds]);

  if (!isOpen) return null;

  const validateFile = (file: File) => {
    const type = detectType(file);
    if (!allowedTypes.includes(type)) {
      throw new Error(allowedTypes.length === 1 && allowedTypes[0] === 'IMAGE'
        ? 'Este campo aceita apenas imagens.'
        : 'Este tipo de arquivo não é suportado pela IA/configuração atual.');
    }
    if (file.size > ASSET_UPLOAD_LIMITS[type].max_bytes) {
      throw new Error(`O arquivo excede o limite atual de ${Math.round(ASSET_UPLOAD_LIMITS[type].max_bytes / (1024 * 1024))} MB.`);
    }
    return type;
  };

  const attachToActiveProject = async (assetId: string) => {
    if (!activeProject || (activeProject.asset_ids || []).includes(assetId)) return;
    const updated = await creativeEntityService.save({
      ...activeProject,
      kind: 'PROJECT',
      name: activeProject.name,
      asset_ids: [...(activeProject.asset_ids || []), assetId],
    });
    setProjects((rows) => rows.map((row) => row.entity_id === updated.entity_id ? updated : row));
  };

  const chooseAsset = async (asset: Asset) => {
    if (scope === 'PROJECT' && activeProject) await attachToActiveProject(asset.asset_id).catch(() => {});
    onSelectAsset(asset);
    onClose();
  };

  const chooseEntity = async (entity: CreativeEntity) => {
    const orderedIds = [entity.cover_asset_id, ...(entity.asset_ids || [])].filter(Boolean) as string[];
    const asset = orderedIds
      .map((id) => libraryAssets.find((row) => row.asset_id === id))
      .find((row) => row && !row.deleted_at && allowedTypes.includes(row.type));
    if (asset) await chooseAsset(asset);
  };

  const uploadImmediately = async (file?: File) => {
    if (!file || uploading) return;
    setUploadError(null);
    let type: AssetType;
    try {
      type = validateFile(file);
    } catch (err: any) {
      setUploadError(err?.message || 'Arquivo incompatível.');
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
        onTaskReady: (task) => { taskRef.current = task; },
      });
      taskRef.current = null;
      setLibraryAssets((current) => mergeAssets([created], current));
      onAssetUploaded(created);
      if (scope === 'PROJECT' && activeProject) await attachToActiveProject(created.asset_id).catch(() => {});
      onSelectAsset(created);
      onClose();
    } catch (err: any) {
      setUploadError(err?.message || 'Falha ao enviar a mídia.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const accept = [
    allowedTypes.includes('IMAGE') ? 'image/*' : '',
    allowedTypes.includes('VIDEO') ? 'video/*' : '',
    allowedTypes.includes('AUDIO') ? 'audio/*' : '',
  ].filter(Boolean).join(',');

  const contentTabs: Array<{ id: AssetPickerContentView; label: string; icon: React.ElementType; count: number }> = [
    { id: 'ASSETS', label: 'Assets', icon: Library, count: scopedAssets.length },
    { id: 'CHARACTERS', label: 'Personagens', icon: UserRound, count: characters.length },
    { id: 'PRODUCTS', label: 'Produtos', icon: Box, count: products.length },
    { id: 'STYLES', label: 'Estilos', icon: Layers3, count: styles.length },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="flex h-[min(700px,90vh)] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e13] text-zinc-100 shadow-[0_30px_100px_rgba(0,0,0,.6)]">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Library className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-bold">{title}</h2></div>
            <p className="mt-1 truncate text-[10px] text-zinc-600">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setActiveTab('UPLOAD')} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-3 text-[10px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Enviar novo</button>
            <button type="button" onClick={onClose} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] text-zinc-600 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-[210px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#090c11] p-3">
            <p className="mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">Biblioteca</p>
            <button type="button" onClick={() => { setActiveTab('LIBRARY'); setScope('GLOBAL'); setActiveProjectId(''); }} className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-[10px] font-semibold text-zinc-300 hover:bg-white/[0.04]"><Library className="h-3.5 w-3.5" /> Geral</button>
            <div className="mt-4 space-y-1">
              {projects.map((project) => (
                <button key={project.entity_id} type="button" onClick={() => { setActiveTab('LIBRARY'); setScope('PROJECT'); setActiveProjectId(project.entity_id); }} className="flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[9px] text-zinc-500 hover:bg-white/[0.04] hover:text-white"><FolderKanban className="h-3.5 w-3.5" /><span className="truncate">{project.name}</span></button>
              ))}
            </div>
            <button type="button" onClick={() => setActiveTab('UPLOAD')} className="mt-4 flex h-9 w-full items-center gap-2 rounded-xl border-t border-white/[0.055] px-2.5 text-[10px] font-semibold text-zinc-500 hover:text-white"><Upload className="h-3.5 w-3.5" /> Upload rápido</button>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {activeTab === 'UPLOAD' ? (
              <div className="flex h-full flex-col">
                <input ref={fileInputRef} type="file" accept={accept} className="hidden" disabled={uploading} onChange={(event) => void uploadImmediately(event.target.files?.[0])} />
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); if (!uploading) void uploadImmediately(event.dataTransfer.files?.[0]); }}
                  className="flex min-h-[300px] flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.02] px-8 text-center"
                >
                  {uploading ? <><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /><p className="mt-3 text-xs">{activeFileName}</p><p className="mt-1 text-[9px] text-zinc-600">{uploadProgress}%</p></> : <><Upload className="h-7 w-7 text-zinc-600" /><p className="mt-4 text-sm font-semibold">Clique ou arraste um arquivo</p></>}
                </div>
                {uploadError && <div className="mt-3 flex gap-2 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-3 text-[9px] text-rose-300"><AlertCircle className="h-3.5 w-3.5" />{uploadError}</div>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {contentTabs.map(({ id, label, icon: Icon, count }) => (
                    <button key={id} type="button" onClick={() => { setContentView(id); setSearch(''); }} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-left ${contentView === id ? 'border-cyan-300/25 bg-cyan-300/[0.06] text-white' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'}`}><Icon className="h-3.5 w-3.5" /><div><p className="text-[9px] font-semibold">{label}</p><p className="text-[7px] text-zinc-700">{count}</p></div></button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-700" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-white/[0.07] bg-[#0a0d12] pl-9 pr-3 text-[10px] outline-none" placeholder="Buscar..." /></div>
                  <button type="button" onClick={() => void refreshLibrary()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07]"><RefreshCw className={`h-3.5 w-3.5 ${libraryLoading ? 'animate-spin' : ''}`} /></button>
                </div>
                {contentView === 'ASSETS' && <div className="flex flex-wrap justify-between gap-2"><div className="flex gap-1">{(['ALL', ...allowedTypes] as TypeFilter[]).map((type) => <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-lg px-2.5 py-1.5 text-[8px] ${typeFilter === type ? 'bg-white/[0.09] text-white' : 'text-zinc-600'}`}>{type === 'ALL' ? 'Todos' : type}</button>)}</div><div className="flex gap-1">{(['ALL', 'UPLOAD', 'GENERATED'] as OriginFilter[]).map((origin) => <button key={origin} type="button" onClick={() => setOriginFilter(origin)} className={`rounded-lg px-2.5 py-1.5 text-[8px] ${originFilter === origin ? 'bg-white/[0.09] text-white' : 'text-zinc-600'}`}>{origin === 'ALL' ? 'Tudo' : origin}</button>)}</div></div>}
                {libraryError && <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] p-3 text-[9px] text-amber-300">{libraryError}</div>}

                {contentView === 'ASSETS' ? (
                  visibleAssets.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visibleAssets.map((asset) => {
                    const attached = attachedAssetIds.includes(asset.asset_id);
                    const url = asset.thumbnail_url || asset.public_url;
                    return <button key={asset.asset_id} type="button" disabled={attached || !allowedTypes.includes(asset.type)} onClick={() => void chooseAsset(asset)} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#11151c] text-left disabled:opacity-50"><div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#0a0d12]">{asset.type === 'IMAGE' && url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <TypeIcon type={asset.type} />}{attached && <span className="absolute right-2 top-2 rounded-md bg-cyan-300 px-1.5 py-0.5 text-[6px] font-black text-[#071015]"><Check className="inline h-2 w-2" /> EM USO</span>}</div><div className="p-2.5"><p className="truncate text-[9px] font-semibold">{asset.name}</p><p className="mt-1 text-[7px] font-mono text-cyan-300">@{asset.alias}</p></div></button>;
                  })}</div> : <EmptyState label="Nenhum asset encontrado" />
                ) : (
                  visibleEntities.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visibleEntities.map((entity) => {
                    const ids = [entity.cover_asset_id, ...(entity.asset_ids || [])].filter(Boolean) as string[];
                    const previewAsset = ids.map((id) => libraryAssets.find((asset) => asset.asset_id === id)).find(Boolean);
                    const preview = entity.cover_url || previewAsset?.thumbnail_url || previewAsset?.public_url;
                    return <button key={entity.entity_id} type="button" onClick={() => void chooseEntity(entity)} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#11151c] text-left"><div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#0a0d12]">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : contentView === 'CHARACTERS' ? <UserRound className="h-7 w-7 text-zinc-700" /> : contentView === 'PRODUCTS' ? <Box className="h-7 w-7 text-zinc-700" /> : <Layers3 className="h-7 w-7 text-zinc-700" />}</div><div className="p-2.5"><p className="truncate text-[9px] font-semibold">{entity.name}</p></div></button>;
                  })}</div> : <EmptyState label="Nenhum item encontrado" />
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
