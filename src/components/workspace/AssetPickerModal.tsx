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
  UserRound,
  Box,
  Layers3,
  ChevronRight,
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
type ContentView = 'ASSETS' | 'CHARACTERS' | 'PRODUCTS' | 'STYLES';

const displayNameForFile = (file: File) => file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || file.name;
const categoryForType = (type: AssetType): AssetCategory => type === 'VIDEO' ? 'MOTION' : type === 'AUDIO' ? 'AUDIO_REFERENCE' : 'GENERIC';
const detectType = (file: File): AssetType => file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('audio/') ? 'AUDIO' : 'IMAGE';
const originOf = (asset: Asset): 'UPLOAD' | 'GENERATED' => String((asset as any).origin || 'UPLOAD').toUpperCase() === 'GENERATED' ? 'GENERATED' : 'UPLOAD';

const TypeIcon: React.FC<{ type: AssetType }> = ({ type }) => type === 'VIDEO' ? <Video className="w-5 h-5 text-cyan-300" /> : type === 'AUDIO' ? <Music className="w-5 h-5 text-violet-300" /> : <ImageIcon className="w-5 h-5 text-zinc-500" />;

function mergeAssets(...groups: Asset[][]): Asset[] {
  const map = new Map<string, Asset>();
  for (const group of groups) for (const asset of group || []) if (asset?.asset_id) map.set(asset.asset_id, asset);
  return Array.from(map.values()).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen, onClose, availableAssets, onSelectAsset, onAssetUploaded, attachedAssetIds,
  title = 'Adicionar mídia', subtitle = 'Escolha algo da sua Biblioteca ou envie um novo arquivo.', defaultTab = 'LIBRARY',
  allowedTypes = ['IMAGE', 'VIDEO', 'AUDIO'],
}) => {
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>(defaultTab);
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [activeProjectId, setActiveProjectId] = useState('');
  const [projects, setProjects] = useState<CreativeEntity[]>([]);
  const [characters, setCharacters] = useState<CreativeEntity[]>([]);
  const [products, setProducts] = useState<CreativeEntity[]>([]);
  const [styles, setStyles] = useState<CreativeEntity[]>([]);
  const [contentView, setContentView] = useState<ContentView>('ASSETS');
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
    setLibraryLoading(true); setLibraryError(null);
    try {
      const [latest, projectRows, characterRows, productRows, styleRows] = await Promise.all([
        assetService.listAssets(),
        creativeEntityService.list('PROJECT').catch(() => []),
        creativeEntityService.list('CHARACTER').catch(() => []),
        creativeEntityService.list('PRODUCT').catch(() => []),
        creativeEntityService.list('STYLE').catch(() => []),
      ]);
      setLibraryAssets((current) => mergeAssets(latest, availableAssets, current));
      setProjects(projectRows); setCharacters(characterRows); setProducts(productRows); setStyles(styleRows);
    } catch (err: any) {
      setLibraryError(err?.message || 'Não foi possível carregar sua Biblioteca.');
      setLibraryAssets((current) => mergeAssets(availableAssets, current));
    } finally { setLibraryLoading(false); }
  }, [availableAssets]);

  useEffect(() => setLibraryAssets((current) => mergeAssets(availableAssets, current)), [availableAssets]);
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultTab); setScope('GLOBAL'); setActiveProjectId(''); setContentView('ASSETS'); setSearch('');
    setTypeFilter('ALL'); setOriginFilter('ALL'); setUploadError(null); setUploadProgress(0); setActiveFileName('');
    setLibraryAssets((current) => mergeAssets(availableAssets, current)); void refreshLibrary();
  }, [isOpen, defaultTab, availableAssets, refreshLibrary]);

  const activeProject = projects.find((p) => p.entity_id === activeProjectId) || null;
  const projectAssetIds = useMemo(() => new Set(activeProject?.asset_ids || []), [activeProject]);
  const scopedAssets = useMemo(() => scope !== 'PROJECT' || !activeProject ? libraryAssets : libraryAssets.filter((asset) => projectAssetIds.has(asset.asset_id)), [libraryAssets, scope, activeProject, projectAssetIds]);

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedAssets.filter((asset) => !asset.deleted_at && (typeFilter === 'ALL' || asset.type === typeFilter) && (originFilter === 'ALL' || originOf(asset) === originFilter) && (!q || asset.name.toLowerCase().includes(q) || asset.alias.toLowerCase().includes(q)));
  }, [scopedAssets, search, typeFilter, originFilter]);

  const entitySource = contentView === 'CHARACTERS' ? characters : contentView === 'PRODUCTS' ? products : styles;
  const visibleEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entitySource.filter((entity) => {
      const linked = entity.asset_ids || [];
      if (scope === 'PROJECT' && activeProject && !linked.some((id) => projectAssetIds.has(id))) return false;
      if (q && !`${entity.name} ${entity.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entitySource, search, scope, activeProject, projectAssetIds]);

  const libraryCount = libraryAssets.filter((a) => !a.deleted_at).length;
  if (!isOpen) return null;

  const validateFile = (file: File) => {
    const type = detectType(file);
    if (!allowedTypes.includes(type)) throw new Error(allowedTypes.length === 1 && allowedTypes[0] === 'IMAGE' ? 'Este campo aceita apenas imagens.' : 'Este tipo de arquivo não é suportado pela IA/configuração atual.');
    if (file.size > ASSET_UPLOAD_LIMITS[type].max_bytes) throw new Error(`O arquivo excede o limite atual de ${Math.round(ASSET_UPLOAD_LIMITS[type].max_bytes / (1024 * 1024))} MB para ${type.toLowerCase()}.`);
    return type;
  };

  const attachToActiveProject = async (assetId: string) => {
    if (!activeProject || (activeProject.asset_ids || []).includes(assetId)) return;
    const updated = await creativeEntityService.save({ ...activeProject, kind: 'PROJECT', name: activeProject.name, asset_ids: [...(activeProject.asset_ids || []), assetId] });
    setProjects((rows) => rows.map((row) => row.entity_id === updated.entity_id ? updated : row));
  };

  const chooseAsset = async (asset: Asset) => {
    if (scope === 'PROJECT' && activeProject) await attachToActiveProject(asset.asset_id).catch(() => {});
    onSelectAsset(asset); onClose();
  };

  const chooseEntity = async (entity: CreativeEntity) => {
    const orderedIds = [entity.cover_asset_id, ...(entity.asset_ids || [])].filter(Boolean) as string[];
    const asset = orderedIds.map((id) => libraryAssets.find((a) => a.asset_id === id)).find((a) => a && !a.deleted_at && allowedTypes.includes(a.type));
    if (!asset) return;
    await chooseAsset(asset);
  };

  const uploadImmediately = async (file?: File) => {
    if (!file || uploading) return;
    setUploadError(null);
    let type: AssetType;
    try { type = validateFile(file); } catch (err: any) { setUploadError(err.message || 'Arquivo incompatível.'); return; }
    setUploading(true); setUploadProgress(1); setActiveFileName(file.name);
    try {
      const created = await assetService.uploadAsset({ file, name: displayNameForFile(file), category: categoryForType(type), onProgress: setUploadProgress, onTaskReady: (task) => { taskRef.current = task; } });
      taskRef.current = null; setLibraryAssets((current) => mergeAssets([created], current)); onAssetUploaded(created);
      if (scope === 'PROJECT' && activeProject) await attachToActiveProject(created.asset_id).catch(() => {});
      onSelectAsset(created); onClose();
    } catch (err: any) { setUploadError(err.message || 'Falha ao enviar a mídia.'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const accept = [allowedTypes.includes('IMAGE') ? 'image/*' : '', allowedTypes.includes('VIDEO') ? 'video/*' : '', allowedTypes.includes('AUDIO') ? 'audio/*' : ''].filter(Boolean).join(',');
  const contentTabs: Array<{id:ContentView;label:string;icon:any;count:number}> = [
    {id:'ASSETS',label:'Assets',icon:Library,count:scopedAssets.length},
    {id:'CHARACTERS',label:'Personagens',icon:UserRound,count:characters.length},
    {id:'PRODUCTS',label:'Produtos',icon:Box,count:products.length},
    {id:'STYLES',label:'Estilos',icon:Layers3,count:styles.length},
  ];

  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
    <div className="w-full max-w-[980px] h-[min(700px,90vh)] bg-[#0b0e13] border border-white/[0.08] rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,.6)] overflow-hidden text-zinc-100 flex flex-col">
      <header className="h-[72px] px-5 border-b border-white/[0.06] flex items-center justify-between gap-4 shrink-0"><div className="min-w-0"><div className="flex items-center gap-2"><Library className="w-4 h-4 text-cyan-300"/><h2 className="text-sm font-bold text-white">{title}</h2></div><p className="text-[10px] text-zinc-600 mt-1 truncate">{subtitle}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setActiveTab('UPLOAD')} className="h-9 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white text-[10px] font-bold inline-flex items-center gap-1.5 hover:brightness-110"><Plus className="w-3.5 h-3.5"/> Enviar novo</button><button type="button" onClick={onClose} disabled={uploading} className="w-9 h-9 rounded-xl border border-white/[0.07] grid place-items-center text-zinc-600 hover:text-white hover:bg-white/[0.04]"><X className="w-4 h-4"/></button></div></header>
      <div className="flex flex-1 min-h-0">
        <aside className="w-[210px] shrink-0 border-r border-white/[0.06] bg-[#090c11] p-3 overflow-y-auto">
          <p className="px-2 mb-2 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">Biblioteca</p>
          <button onClick={() => {setActiveTab('LIBRARY');setScope('GLOBAL');setActiveProjectId('');}} className={`w-full h-9 px-2.5 rounded-xl flex items-center gap-2 text-[10px] font-semibold ${scope==='GLOBAL'&&activeTab==='LIBRARY'?'bg-white/[0.08] text-white border border-white/[0.07]':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><Library className="w-3.5 h-3.5"/> Geral <span className="ml-auto text-[8px] text-zinc-700">{libraryCount}</span></button>
          <div className="mt-4"><div className="px-2 mb-2 flex items-center justify-between"><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">Projetos</p><span className="text-[8px] text-zinc-800">{projects.length}</span></div><div className="space-y-1">{projects.map((project)=><button key={project.entity_id} onClick={()=>{setActiveTab('LIBRARY');setScope('PROJECT');setActiveProjectId(project.entity_id);}} className={`w-full min-h-9 px-2.5 py-2 rounded-xl flex items-center gap-2 text-left ${scope==='PROJECT'&&activeProjectId===project.entity_id?'bg-violet-500/10 text-white border border-violet-400/15':'text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><FolderKanban className="w-3.5 h-3.5 shrink-0"/><span className="truncate text-[9px] font-semibold">{project.name}</span><span className="ml-auto text-[7px] text-zinc-700">{project.asset_ids?.length||0}</span></button>)}</div></div>
          <div className="mt-4 pt-4 border-t border-white/[0.055]"><button onClick={()=>setActiveTab('UPLOAD')} className={`w-full h-9 px-2.5 rounded-xl flex items-center gap-2 text-[10px] font-semibold ${activeTab==='UPLOAD'?'bg-cyan-300/10 text-cyan-200 border border-cyan-300/15':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035]'}`}><Upload className="w-3.5 h-3.5"/> Upload rápido</button></div>
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5">
          {activeTab==='UPLOAD' ? <div className="h-full flex flex-col"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Upload rápido</p><h3 className="mt-1 text-base font-bold text-white">Adicionar à sua Biblioteca</h3><p className="mt-1 text-[9px] text-zinc-600">O arquivo entra no acervo global e pode depois ser classificado como personagem, produto ou estilo.</p></div><input ref={fileInputRef} type="file" accept={accept} className="hidden" disabled={uploading} onChange={(e)=>uploadImmediately(e.target.files?.[0])}/><div onClick={()=>!uploading&&fileInputRef.current?.click()} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();if(!uploading)uploadImmediately(e.dataTransfer.files?.[0]);}} className={`mt-5 flex-1 min-h-[300px] rounded-2xl border border-dashed flex flex-col items-center justify-center text-center px-8 ${uploading?'border-cyan-300/25 bg-cyan-300/[0.035]':'border-white/[0.09] bg-white/[0.02] hover:border-cyan-300/20 cursor-pointer'}`}>{uploading?<><Loader2 className="w-6 h-6 text-cyan-300 animate-spin"/><p className="mt-3 text-xs text-white">{activeFileName}</p><p className="mt-1 text-[9px] text-zinc-600">{uploadProgress}%</p></>:<><Upload className="w-7 h-7 text-zinc-600"/><p className="mt-4 text-sm font-semibold text-zinc-200">Clique ou arraste um arquivo</p><p className="mt-1.5 text-[9px] text-zinc-600">Nome e alias são criados automaticamente.</p></>}</div>{uploadError&&<div className="mt-3 p-3 rounded-xl bg-rose-500/[0.06] border border-rose-400/15 text-rose-300 text-[9px] flex gap-2"><AlertCircle className="w-3.5 h-3.5"/>{uploadError}</div>}</div> : <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{contentTabs.map(({id,label,icon:Icon,count})=><button key={id} onClick={()=>{setContentView(id);setSearch('');}} className={`h-11 px-3 rounded-xl border flex items-center gap-2 text-left ${contentView===id?'border-cyan-300/25 bg-cyan-300/[0.06] text-white':'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-200'}`}><Icon className={`w-3.5 h-3.5 ${contentView===id?'text-cyan-300':'text-zinc-600'}`}/><div className="min-w-0"><p className="text-[9px] font-semibold truncate">{label}</p><p className="text-[7px] text-zinc-700">{count}</p></div></button>)}</div>
            <div className="flex gap-2"><div className="relative flex-1"><Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700"/><input autoFocus value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={`Buscar em ${contentView==='ASSETS'?'assets':contentView==='CHARACTERS'?'personagens':contentView==='PRODUCTS'?'produtos':'estilos'}...`} className="w-full h-10 pl-9 pr-3 bg-[#0a0d12] border border-white/[0.07] rounded-xl text-[10px] text-zinc-200 outline-none focus:border-cyan-300/20"/></div><button onClick={()=>void refreshLibrary()} className="w-10 h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] grid place-items-center text-zinc-600"><RefreshCw className={`w-3.5 h-3.5 ${libraryLoading?'animate-spin':''}`}/></button></div>
            {contentView==='ASSETS'&&<div className="flex flex-wrap gap-2 items-center justify-between"><div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">{(['ALL','IMAGE','VIDEO','AUDIO'] as TypeFilter[]).filter((type)=>type==='ALL'||allowedTypes.includes(type as AssetType)).map((type)=><button key={type} onClick={()=>setTypeFilter(type)} className={`h-7 px-2.5 rounded-lg text-[8px] font-semibold ${typeFilter===type?'bg-white/[0.09] text-white':'text-zinc-600'}`}>{type==='ALL'?'Todos':type==='IMAGE'?'Imagens':type==='VIDEO'?'Vídeos':'Áudios'}</button>)}</div><div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">{(['ALL','UPLOAD','GENERATED'] as OriginFilter[]).map((origin)=><button key={origin} onClick={()=>setOriginFilter(origin)} className={`h-7 px-2.5 rounded-lg text-[8px] font-semibold ${originFilter===origin?'bg-white/[0.09] text-white':'text-zinc-600'}`}>{origin==='ALL'?'Tudo':origin==='UPLOAD'?'Uploads':'Gerados'}</button>)}</div></div>}
            {libraryError&&<div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-400/15 text-amber-300 text-[9px]">{libraryError}</div>}
            {contentView==='ASSETS' ? (visibleAssets.length?<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{visibleAssets.map((asset)=>{const attached=attachedAssetIds.includes(asset.asset_id);const compatible=allowedTypes.includes(asset.type);const url=asset.thumbnail_url||asset.public_url;return <button key={asset.asset_id} disabled={attached||!compatible} onClick={()=>void chooseAsset(asset)} className={`group text-left rounded-xl border overflow-hidden ${attached?'border-cyan-300/25 bg-cyan-300/[0.04]':!compatible?'border-white/[0.05] opacity-45':'border-white/[0.07] bg-[#11151c] hover:border-cyan-300/25'}`}><div className="aspect-[4/3] bg-[#0a0d12] relative flex items-center justify-center overflow-hidden">{asset.type==='IMAGE'&&url?<img src={url} alt="" className="w-full h-full object-cover"/>:<TypeIcon type={asset.type}/>}<span className="absolute left-2 top-2 px-1.5 py-0.5 rounded-md bg-black/65 text-[6px] font-bold">{asset.category==='CHARACTER'?'PERSONAGEM':asset.category==='PRODUCT'?'PRODUTO':asset.category==='STYLE'?'ESTILO':asset.type}</span>{attached&&<span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-cyan-300 text-[#071015] text-[6px] font-black"><Check className="inline w-2 h-2"/> EM USO</span>}</div><div className="p-2.5"><p className="text-[9px] font-semibold text-zinc-200 truncate">{asset.name}</p><p className="mt-1 text-[7px] font-mono text-cyan-300">@{asset.alias}</p></div></button>})}</div>:<EmptyState label="Nenhum asset encontrado"/>) : (visibleEntities.length?<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{visibleEntities.map((entity)=>{const ids=[entity.cover_asset_id,...(entity.asset_ids||[])].filter(Boolean) as string[];const previewAsset=ids.map((id)=>libraryAssets.find((a)=>a.asset_id===id)).find(Boolean);const compatible=ids.some((id)=>{const a=libraryAssets.find((asset)=>asset.asset_id===id);return a&&allowedTypes.includes(a.type)&&!a.deleted_at;});const preview=entity.cover_url||previewAsset?.thumbnail_url||previewAsset?.public_url;const label=contentView==='CHARACTERS'?'PERSONAGEM':contentView==='PRODUCTS'?'PRODUTO':'ESTILO';return <button key={entity.entity_id} disabled={!compatible} onClick={()=>void chooseEntity(entity)} className={`group text-left rounded-xl border overflow-hidden ${compatible?'border-white/[0.07] bg-[#11151c] hover:border-violet-400/30':'border-white/[0.05] opacity-45 cursor-not-allowed'}`}><div className="aspect-[4/3] bg-[#0a0d12] relative overflow-hidden flex items-center justify-center">{preview?<img src={preview} alt="" className="w-full h-full object-cover"/>:<div className="text-zinc-700">{contentView==='CHARACTERS'?<UserRound className="w-7 h-7"/>:contentView==='PRODUCTS'?<Box className="w-7 h-7"/>:<Layers3 className="w-7 h-7"/>}</div>}<span className="absolute left-2 top-2 px-1.5 py-0.5 rounded-md bg-violet-500/80 text-[6px] font-black text-white">{label}</span><span className="absolute right-2 top-2 px-1.5 py-0.5 rounded-md bg-black/65 text-[6px] text-zinc-300">{entity.asset_ids?.length||0} refs</span></div><div className="p-2.5 flex items-center gap-2"><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-zinc-200 truncate">{entity.name}</p><p className="mt-1 text-[7px] text-zinc-700 truncate">{entity.description||'Sem descrição'}</p></div><ChevronRight className="w-3.5 h-3.5 text-zinc-700"/></div></button>})}</div>:<EmptyState label={`Nenhum ${contentView==='CHARACTERS'?'personagem':contentView==='PRODUCTS'?'produto':'estilo'} encontrado`}/>) }
          </div>}
        </main>
      </div>
    </div>
  </div>;
};

const EmptyState: React.FC<{label:string}> = ({label}) => <div className="py-16 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] text-center"><FolderOpen className="w-8 h-8 text-zinc-800 mx-auto"/><p className="mt-3 text-[10px] font-semibold text-zinc-400">{label}</p><p className="mt-1 text-[8px] text-zinc-700">Use a Biblioteca para organizar e reutilizar referências.</p></div>;
