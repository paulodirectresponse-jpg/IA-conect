import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';
import { creativeEntityService, CreativeEntity } from '../../services/creativeEntityService.js';
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
  Library,
  FolderKanban,
  Plus,
  Sparkles,
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

type Scope = 'GLOBAL' | 'PROJECT';
type TypeFilter = 'ALL' | AssetType;
type OriginFilter = 'ALL' | 'UPLOAD' | 'GENERATED';

const displayNameForFile = (file: File) =>
  file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || file.name;

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

const originOf = (asset: Asset): 'UPLOAD' | 'GENERATED' =>
  String((asset as any).origin || 'UPLOAD').toUpperCase() === 'GENERATED' ? 'GENERATED' : 'UPLOAD';

const TypeIcon: React.FC<{ type: AssetType }> = ({ type }) => {
  if (type === 'VIDEO') return <Video className="w-5 h-5 text-cyan-300" />;
  if (type === 'AUDIO') return <Music className="w-5 h-5 text-violet-300" />;
  return <ImageIcon className="w-5 h-5 text-zinc-500" />;
};

function mergeAssets(...groups: Asset[][]): Asset[] {
  const map = new Map<string, Asset>();
  for (const group of groups) for (const asset of group || []) if (asset?.asset_id) map.set(asset.asset_id, asset);
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
  subtitle = 'Escolha algo da sua Biblioteca ou envie um novo arquivo.',
  defaultTab = 'LIBRARY',
  allowedTypes = ['IMAGE', 'VIDEO', 'AUDIO'],
}) => {
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>(defaultTab);
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [activeProjectId, setActiveProjectId] = useState('');
  const [projects, setProjects] = useState<CreativeEntity[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
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
      const [latest, projectRows] = await Promise.all([
        assetService.listAssets(),
        creativeEntityService.list('PROJECT').catch(() => []),
      ]);
      setLibraryAssets((current) => mergeAssets(latest, availableAssets, current));
      setProjects(projectRows);
    } catch (err: any) {
      setLibraryError(err?.message || 'Não foi possível carregar sua Biblioteca.');
      setLibraryAssets((current) => mergeAssets(availableAssets, current));
    } finally {
      setLibraryLoading(false);
    }
  }, [availableAssets]);

  useEffect(() => setLibraryAssets((current) => mergeAssets(availableAssets, current)), [availableAssets]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultTab);
    setScope('GLOBAL');
    setActiveProjectId('');
    setSearch('');
    setTypeFilter('ALL');
    setOriginFilter('ALL');
    setUploadError(null);
    setUploadProgress(0);
    setActiveFileName('');
    setLibraryAssets((current) => mergeAssets(availableAssets, current));
    void refreshLibrary();
  }, [isOpen, defaultTab, availableAssets, refreshLibrary]);

  const activeProject = projects.find((project) => project.entity_id === activeProjectId) || null;

  const scopedAssets = useMemo(() => {
    if (scope !== 'PROJECT' || !activeProject) return libraryAssets;
    const ids = new Set(activeProject.asset_ids || []);
    return libraryAssets.filter((asset) => ids.has(asset.asset_id));
  }, [libraryAssets, scope, activeProject]);

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedAssets.filter((asset) => {
      if (asset.deleted_at) return false;
      if (typeFilter !== 'ALL' && asset.type !== typeFilter) return false;
      if (originFilter !== 'ALL' && originOf(asset) !== originFilter) return false;
      if (q && !asset.name.toLowerCase().includes(q) && !asset.alias.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scopedAssets, search, typeFilter, originFilter]);

  const libraryCount = libraryAssets.filter((asset) => !asset.deleted_at).length;

  if (!isOpen) return null;

  const validateFile = (file: File) => {
    const type = detectType(file);
    if (!allowedTypes.includes(type)) throw new Error(allowedTypes.length === 1 && allowedTypes[0] === 'IMAGE' ? 'Este campo aceita apenas imagens.' : 'Este tipo de arquivo não é suportado pela IA/configuração atual.');
    if (file.size > ASSET_UPLOAD_LIMITS[type].max_bytes) {
      const mb = Math.round(ASSET_UPLOAD_LIMITS[type].max_bytes / (1024 * 1024));
      throw new Error(`O arquivo excede o limite atual de ${mb} MB para ${type.toLowerCase()}.`);
    }
    return type;
  };

  const attachToActiveProject = async (assetId: string) => {
    if (!activeProject) return;
    if ((activeProject.asset_ids || []).includes(assetId)) return;
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

  const uploadImmediately = async (file?: File) => {
    if (!file || uploading) return;
    setUploadError(null);
    let type: AssetType;
    try { type = validateFile(file); }
    catch (err: any) { setUploadError(err.message || 'Arquivo incompatível.'); return; }

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
  ].filter(Boolean).join(',');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-[920px] h-[min(680px,88vh)] bg-[#0b0e13] border border-white/[0.08] rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,.6)] overflow-hidden text-zinc-100 flex flex-col">
        <header className="h-[72px] px-5 border-b border-white/[0.06] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Library className="w-4 h-4 text-cyan-300"/><h2 className="text-sm font-bold text-white">{title}</h2></div>
            <p className="text-[10px] text-zinc-600 mt-1 truncate">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setActiveTab('UPLOAD')} className="h-9 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white text-[10px] font-bold inline-flex items-center gap-1.5 hover:brightness-110"><Plus className="w-3.5 h-3.5"/> Enviar novo</button>
            <button type="button" onClick={onClose} disabled={uploading} className="w-9 h-9 rounded-xl border border-white/[0.07] grid place-items-center text-zinc-600 hover:text-white hover:bg-white/[0.04] disabled:opacity-40"><X className="w-4 h-4"/></button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <aside className="w-[210px] shrink-0 border-r border-white/[0.06] bg-[#090c11] p-3 overflow-y-auto">
            <p className="px-2 mb-2 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">Biblioteca</p>
            <button type="button" onClick={() => { setActiveTab('LIBRARY'); setScope('GLOBAL'); setActiveProjectId(''); }} className={`w-full h-9 px-2.5 rounded-xl flex items-center gap-2 text-[10px] font-semibold transition-colors ${scope==='GLOBAL'&&activeTab==='LIBRARY'?'bg-white/[0.08] text-white border border-white/[0.07]':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><Library className="w-3.5 h-3.5"/> Geral <span className="ml-auto text-[8px] text-zinc-700">{libraryCount}</span></button>

            <div className="mt-4"><div className="px-2 mb-2 flex items-center justify-between"><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">Projetos</p><span className="text-[8px] text-zinc-800">{projects.length}</span></div>
              <div className="space-y-1">{projects.map((project) => <button key={project.entity_id} type="button" onClick={() => { setActiveTab('LIBRARY'); setScope('PROJECT'); setActiveProjectId(project.entity_id); }} className={`w-full min-h-9 px-2.5 py-2 rounded-xl flex items-center gap-2 text-left transition-colors ${scope==='PROJECT'&&activeProjectId===project.entity_id?'bg-violet-500/10 text-white border border-violet-400/15':'text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><FolderKanban className="w-3.5 h-3.5 shrink-0"/><span className="truncate text-[9px] font-semibold">{project.name}</span><span className="ml-auto text-[7px] text-zinc-700">{project.asset_ids?.length||0}</span></button>)}</div>
              {!projects.length && <div className="px-2 py-3 text-[8px] leading-relaxed text-zinc-700">Seus projetos aparecerão aqui. Crie projetos na Biblioteca.</div>}
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.055]"><button type="button" onClick={() => setActiveTab('UPLOAD')} className={`w-full h-9 px-2.5 rounded-xl flex items-center gap-2 text-[10px] font-semibold ${activeTab==='UPLOAD'?'bg-cyan-300/10 text-cyan-200 border border-cyan-300/15':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><Upload className="w-3.5 h-3.5"/> Upload rápido</button></div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5">
            {activeTab === 'UPLOAD' ? (
              <div className="h-full flex flex-col">
                <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Upload rápido</p><h3 className="mt-1 text-base font-bold text-white">Adicionar à sua Biblioteca</h3><p className="mt-1 text-[9px] text-zinc-600">O arquivo entra no acervo global e, se um projeto estiver selecionado, também será vinculado a ele.</p></div>
                <input ref={fileInputRef} type="file" accept={accept} className="hidden" disabled={uploading} onChange={(e) => uploadImmediately(e.target.files?.[0])}/>
                <div onClick={() => !uploading && fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!uploading) uploadImmediately(e.dataTransfer.files?.[0]); }} className={`mt-5 flex-1 min-h-[300px] rounded-2xl border border-dashed flex flex-col items-center justify-center text-center px-8 transition-all ${uploading?'border-cyan-300/25 bg-cyan-300/[0.035] cursor-wait':'border-white/[0.09] bg-white/[0.02] hover:bg-white/[0.035] hover:border-cyan-300/20 cursor-pointer'}`}>
                  {uploading ? <><div className="w-12 h-12 rounded-2xl bg-cyan-300/10 border border-cyan-300/15 grid place-items-center"><Loader2 className="w-5 h-5 text-cyan-300 animate-spin"/></div><p className="mt-3 text-xs font-semibold text-white truncate max-w-full">{activeFileName}</p><p className="mt-1 text-[9px] text-zinc-600">Enviando e anexando automaticamente...</p><div className="mt-4 w-full max-w-xs h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-300 rounded-full transition-all" style={{width:`${Math.max(2,uploadProgress)}%`}}/></div><div className="mt-2 flex items-center gap-3"><span className="font-mono text-[9px] text-cyan-300">{uploadProgress}%</span><button type="button" onClick={(e)=>{e.stopPropagation();taskRef.current?.cancel();}} className="text-[9px] text-zinc-600 hover:text-rose-400">Cancelar</button></div></> : <><div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.07] grid place-items-center"><Upload className="w-5 h-5 text-zinc-500"/></div><p className="mt-4 text-sm font-semibold text-zinc-200">Clique ou arraste um arquivo</p><p className="mt-1.5 text-[9px] text-zinc-600 max-w-sm leading-relaxed">Sem formulário. Nome e alias são criados automaticamente e a mídia fica pronta para usar no prompt.</p><div className="mt-4 flex gap-1.5 flex-wrap justify-center">{allowedTypes.map((type)=><span key={type} className="px-2 py-1 rounded-lg border border-white/[0.07] bg-white/[0.025] text-[8px] text-zinc-500">{type==='IMAGE'?'Imagens':type==='VIDEO'?'Vídeos':'Áudios'}</span>)}</div></>}
                </div>
                {uploadError && <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-500/[0.06] border border-rose-400/15 text-rose-300 text-[9px]"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/><span>{uploadError}</span></div>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-2.5"><div className="relative flex-1"><Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"/><input autoFocus value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={`Buscar em ${scope==='PROJECT'&&activeProject?activeProject.name:'Geral'}...`} className="w-full h-10 pl-9 pr-3 bg-[#0a0d12] border border-white/[0.07] rounded-xl text-[10px] text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-300/20"/></div><button type="button" onClick={()=>void refreshLibrary()} disabled={libraryLoading} className="w-10 h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] grid place-items-center text-zinc-600 hover:text-cyan-300 disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${libraryLoading?'animate-spin':''}`}/></button></div>

                <div className="flex flex-wrap gap-2 items-center justify-between"><div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">{(['ALL','IMAGE','VIDEO','AUDIO'] as TypeFilter[]).filter((type)=>type==='ALL'||allowedTypes.includes(type as AssetType)).map((type)=><button key={type} type="button" onClick={()=>setTypeFilter(type)} className={`h-7 px-2.5 rounded-lg text-[8px] font-semibold ${typeFilter===type?'bg-white/[0.09] text-white':'text-zinc-600 hover:text-zinc-300'}`}>{type==='ALL'?'Todos':type==='IMAGE'?'Imagens':type==='VIDEO'?'Vídeos':'Áudios'}</button>)}</div><div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">{(['ALL','UPLOAD','GENERATED'] as OriginFilter[]).map((origin)=><button key={origin} type="button" onClick={()=>setOriginFilter(origin)} className={`h-7 px-2.5 rounded-lg text-[8px] font-semibold ${originFilter===origin?'bg-white/[0.09] text-white':'text-zinc-600 hover:text-zinc-300'}`}>{origin==='ALL'?'Tudo':origin==='UPLOAD'?'Uploads':'Gerados'}</button>)}</div></div>

                {libraryError && <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-400/15 text-amber-300 text-[9px]"><div className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/><span>{libraryError}</span></div><button type="button" onClick={()=>void refreshLibrary()} className="font-semibold text-amber-200">Tentar novamente</button></div>}

                {libraryLoading && libraryCount===0 ? <div className="py-16 text-center"><Loader2 className="w-6 h-6 text-cyan-300 mx-auto animate-spin"/><p className="mt-2 text-[9px] text-zinc-600">Carregando Biblioteca...</p></div> : visibleAssets.length ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{visibleAssets.map((asset)=>{const attached=attachedAssetIds.includes(asset.asset_id);const compatible=allowedTypes.includes(asset.type);const url=asset.thumbnail_url||asset.public_url;const generated=originOf(asset)==='GENERATED';return <button key={asset.asset_id} type="button" disabled={attached||!compatible} onClick={()=>void chooseAsset(asset)} className={`group text-left rounded-xl border overflow-hidden transition-all ${attached?'border-cyan-300/25 bg-cyan-300/[0.04] cursor-default':!compatible?'border-white/[0.05] bg-white/[0.015] opacity-45 cursor-not-allowed':'border-white/[0.07] bg-[#11151c] hover:border-cyan-300/25 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,.25)]'}`}><div className="aspect-[4/3] bg-[#0a0d12] relative flex items-center justify-center overflow-hidden">{asset.type==='IMAGE'&&url?<img src={url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"/>:<TypeIcon type={asset.type}/>}<div className="absolute left-2 top-2 flex gap-1">{generated&&<span className="px-1.5 py-0.5 rounded-md bg-violet-500/80 border border-violet-300/20 text-[6px] font-black text-white inline-flex items-center gap-1"><Sparkles className="w-2 h-2"/>GERADO</span>}<span className="px-1.5 py-0.5 rounded-md bg-black/65 border border-white/10 text-[6px] font-bold text-zinc-300">{asset.type}</span></div>{attached&&<span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-300 text-[#071015] text-[6px] font-black"><Check className="w-2 h-2"/>EM USO</span>}{!compatible&&!attached&&<span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 border border-white/10 text-[6px] font-bold text-zinc-500"><Ban className="w-2 h-2"/>INCOMPATÍVEL</span>}</div><div className="p-2.5"><p className="text-[9px] font-semibold text-zinc-200 truncate">{asset.name}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="text-[7px] font-mono text-cyan-300 truncate">@{asset.alias}</span><span className="text-[7px] text-zinc-700 shrink-0">{(asset.size_bytes/(1024*1024)).toFixed(1)} MB</span></div></div></button>})}</div> : <div className="py-16 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] text-center"><FolderOpen className="w-8 h-8 text-zinc-800 mx-auto"/><p className="mt-3 text-[10px] font-semibold text-zinc-400">{search?'Nada encontrado':scope==='PROJECT'&&activeProject?'Este projeto ainda não tem mídia':'Sua Biblioteca está vazia'}</p><p className="mt-1 text-[8px] text-zinc-700">{scope==='PROJECT'&&activeProject?'Adicione arquivos ao projeto ou escolha no acervo Geral.':'Envie um arquivo e ele ficará disponível para reutilização.'}</p><button type="button" onClick={()=>setActiveTab('UPLOAD')} className="mt-3 text-[9px] font-semibold text-cyan-300">+ Enviar novo</button></div>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
