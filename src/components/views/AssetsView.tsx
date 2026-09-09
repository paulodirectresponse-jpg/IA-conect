import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService, AssetOriginFilter } from '../../services/assetService.js';
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
  Sparkles,
  CloudUpload,
} from 'lucide-react';

type TypeFilter = 'ALL' | AssetType;

const originOf = (asset: Asset): 'UPLOAD' | 'GENERATED' =>
  String((asset as any).origin || 'UPLOAD').toUpperCase() === 'GENERATED' ? 'GENERATED' : 'UPLOAD';

const formatBytes = (bytes: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const AssetsView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<TypeFilter>('ALL');
  const [selectedOrigin, setSelectedOrigin] = useState<AssetOriginFilter>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editCategory, setEditCategory] = useState<AssetCategory>('GENERIC');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      setAssets(await assetService.listAssets());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, []);

  const counts = useMemo(() => ({
    all: assets.length,
    upload: assets.filter((a) => originOf(a) === 'UPLOAD').length,
    generated: assets.filter((a) => originOf(a) === 'GENERATED').length,
  }), [assets]);

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || asset.name.toLowerCase().includes(term) || asset.alias.toLowerCase().includes(term);
    const matchesType = selectedType === 'ALL' || asset.type === selectedType;
    const matchesOrigin = selectedOrigin === 'ALL' || originOf(asset) === selectedOrigin;
    const matchesCategory = selectedCategory === 'ALL' || asset.category === selectedCategory;
    return matchesSearch && matchesType && matchesOrigin && matchesCategory;
  }), [assets, search, selectedType, selectedOrigin, selectedCategory]);

  const copyAlias = async (asset: Asset) => {
    await navigator.clipboard.writeText(`@${asset.alias}`);
    setCopiedId(asset.asset_id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const quickUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const created = await assetService.uploadAsset({
        file,
        name: baseName,
        category: 'GENERIC',
        onProgress: setUploadProgress,
      });
      setAssets((current) => [created, ...current.filter((a) => a.asset_id !== created.asset_id)]);
    } catch (err: any) {
      setUploadError(err?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditAlias(asset.alias);
    setEditCategory(asset.category);
    setEditError('');
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAsset) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const updated = await assetService.updateAsset(editingAsset.asset_id, {
        name: editName.trim(),
        alias: editAlias.trim(),
        category: editCategory,
      });
      setAssets((current) => current.map((a) => a.asset_id === updated.asset_id ? updated : a));
      setEditingAsset(null);
    } catch (err: any) {
      setEditError(err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (asset: Asset) => {
    if (!window.confirm(`Remover “${asset.name}” da biblioteca?`)) return;
    await assetService.deleteAsset(asset.asset_id);
    setAssets((current) => current.filter((a) => a.asset_id !== asset.asset_id));
  };

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-5">
      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => quickUpload(e.target.files?.[0])}/>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Biblioteca de Assets</h1>
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">{counts.all}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Uploads e resultados gerados no estúdio, prontos para reutilizar com @.</p>
        </div>
        <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors">
          {uploading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
          {uploading ? `Enviando ${uploadProgress}%` : 'Adicionar asset'}
        </button>
      </div>

      {uploadError && <div className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">{uploadError}</div>}

      <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou @alias..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 text-xs outline-none focus:border-emerald-400"/>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 border border-zinc-200 overflow-x-auto">
            {([
              ['ALL','Todos',counts.all],
              ['UPLOAD','Uploads',counts.upload],
              ['GENERATED','Gerados',counts.generated],
            ] as const).map(([id,label,count]) => (
              <button key={id} onClick={() => setSelectedOrigin(id)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${selectedOrigin === id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}>
                {label} <span className="ml-1 text-zinc-400">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              ['ALL','Todos'],['IMAGE','Imagens'],['VIDEO','Vídeos'],['AUDIO','Áudios'],
            ] as const).map(([id,label]) => (
              <button key={id} onClick={() => setSelectedType(id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium ${selectedType === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>{label}</button>
            ))}
          </div>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-600 outline-none">
            <option value="ALL">Todas categorias</option>
            <option value="GENERIC">Geral</option>
            <option value="PRODUCT">Produto</option>
            <option value="CHARACTER">Personagem</option>
            <option value="ENVIRONMENT">Cenário</option>
            <option value="STYLE">Estilo</option>
            <option value="MOTION">Movimento</option>
            <option value="AUDIO_REFERENCE">Áudio</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center text-zinc-400 gap-3"><RefreshCw className="w-5 h-5 animate-spin"/><span className="text-xs">Carregando biblioteca...</span></div>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-20 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-zinc-300"/>
          <h3 className="mt-3 text-sm font-semibold text-zinc-900">Nenhum asset neste filtro</h3>
          <p className="mt-1 text-xs text-zinc-500">Faça um upload ou gere uma imagem/vídeo no Create. O resultado aparece aqui automaticamente.</p>
          <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold inline-flex items-center gap-2"><CloudUpload className="w-4 h-4"/>Upload rápido</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => {
            const origin = originOf(asset);
            const generated = origin === 'GENERATED';
            const preview = asset.thumbnail_url || asset.public_url;
            return <article key={asset.asset_id} className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs hover:shadow-sm hover:border-zinc-300 transition-all">
              <div className="h-44 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                {asset.type === 'IMAGE' && preview ? <img src={preview} alt={asset.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" referrerPolicy="no-referrer"/> : asset.type === 'VIDEO' && asset.public_url ? <video src={asset.public_url} muted preload="metadata" className="w-full h-full object-cover"/> : asset.type === 'VIDEO' ? <Video className="w-9 h-9 text-zinc-400"/> : asset.type === 'AUDIO' ? <Music className="w-9 h-9 text-zinc-400"/> : <ImageIcon className="w-9 h-9 text-zinc-400"/>}

                <div className="absolute top-2 left-2 flex gap-1.5">
                  <span className={`px-2 py-1 rounded-lg backdrop-blur-md border text-[9px] font-bold tracking-wide ${generated ? 'bg-violet-600/90 text-white border-violet-400/40' : 'bg-white/90 text-zinc-700 border-white/50'}`}>
                    {generated ? <span className="inline-flex items-center gap-1"><Sparkles className="w-2.5 h-2.5"/>GERADO</span> : <span className="inline-flex items-center gap-1"><UploadCloud className="w-2.5 h-2.5"/>UPLOAD</span>}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-black/55 text-white text-[9px] font-semibold backdrop-blur-md">{asset.type}</span>
                </div>

                {asset.public_url && <a href={asset.public_url} target="_blank" rel="noreferrer" className="absolute top-2 right-2 p-2 rounded-lg bg-white/90 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Abrir original"><ExternalLink className="w-3.5 h-3.5"/></a>}
              </div>

              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-zinc-900 truncate">{asset.name}</p>
                    <button onClick={() => copyAlias(asset)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 hover:text-emerald-600">@{asset.alias}{copiedId === asset.asset_id ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3 text-zinc-400"/>}</button>
                  </div>
                  <span className="text-[9px] text-zinc-400">{formatBytes(asset.size_bytes)}</span>
                </div>

                {generated && <div className="mt-3 rounded-xl bg-violet-50 border border-violet-100 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide font-bold text-violet-600">Criado no IA Connect</p>
                  <p className="text-[10px] text-violet-700 mt-0.5 truncate">{String((asset as any).source_model_id || 'Modelo de IA')}</p>
                </div>}

                <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <div className="text-[9px] text-zinc-400">
                    <div>{new Date(asset.created_at).toLocaleDateString('pt-BR')}</div>
                    <div className="mt-0.5">{asset.category === 'GENERIC' ? 'Geral' : asset.category}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(asset)} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => remove(asset)} className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50" title="Remover"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div>
      )}

      {editingAsset && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
        <form onSubmit={saveEdit} className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between"><div><h2 className="text-sm font-bold text-zinc-900">Editar asset</h2><p className="text-[10px] text-zinc-500 mt-0.5">O arquivo não muda, apenas seus metadados.</p></div><button type="button" onClick={() => setEditingAsset(null)} className="p-2 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500"/></button></div>
          <div className="p-5 space-y-4">
            <div><label className="text-[11px] font-semibold text-zinc-700">Nome</label><input required value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full h-10 px-3 border border-zinc-200 rounded-xl text-xs outline-none focus:border-emerald-400"/></div>
            <div><label className="text-[11px] font-semibold text-zinc-700">Alias</label><div className="mt-1 flex items-center h-10 rounded-xl border border-zinc-200 overflow-hidden focus-within:border-emerald-400"><span className="px-3 text-zinc-400 text-xs">@</span><input required value={editAlias} onChange={(e) => setEditAlias(e.target.value)} className="flex-1 h-full pr-3 text-xs outline-none"/></div></div>
            <div><label className="text-[11px] font-semibold text-zinc-700">Categoria</label><select value={editCategory} onChange={(e) => setEditCategory(e.target.value as AssetCategory)} className="mt-1 w-full h-10 px-3 border border-zinc-200 rounded-xl text-xs outline-none"><option value="GENERIC">Geral</option><option value="PRODUCT">Produto</option><option value="CHARACTER">Personagem</option><option value="ENVIRONMENT">Cenário</option><option value="STYLE">Estilo</option><option value="MOTION">Movimento</option><option value="AUDIO_REFERENCE">Áudio</option></select></div>
            {editError && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">{editError}</div>}
          </div>
          <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2"><button type="button" onClick={() => setEditingAsset(null)} className="px-3 py-2 text-xs text-zinc-600">Cancelar</button><button disabled={savingEdit} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold disabled:opacity-50">{savingEdit ? 'Salvando...' : 'Salvar'}</button></div>
        </form>
      </div>}
    </div>
  );
};
