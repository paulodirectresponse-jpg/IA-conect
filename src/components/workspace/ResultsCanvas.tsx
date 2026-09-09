import React, { useEffect, useMemo, useState } from 'react';
import { WorkspacePreset, Generation, Asset } from '../../types/index.js';
import { AlertCircle, Bookmark, Download, Film, Image as ImageIcon, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { generationClient } from '../../services/generationClient.js';
import { assetService } from '../../services/assetService.js';
import { downloadMediaDirect, safeDownloadName } from '../../utils/mediaDownload.js';

interface Props {
  lastSavedTime: string | null;
  validating: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  onOpenPresets: () => void;
  presets: WorkspacePreset[];
  onApplyPreset: (p: WorkspacePreset) => void;
  prompt: string;
  hasReferences: boolean;
}

type MediaFilter = 'VIDEO' | 'ALL';
type MediaGroup = { generation: Generation; assets: Asset[]; ratio: string; kind: 'IMAGE' | 'VIDEO' };

const working = (status: string) => ['QUEUED','RESERVING_FUNDS','SUBMITTED','PROCESSING'].includes(status);
const isImageGeneration = (g: Generation) => g.mode === 'TEXT_TO_IMAGE' || g.mode === 'IMAGE_TO_IMAGE';
const cssRatio = (ratio?: string) => (ratio || '16:9').replace(':', ' / ');
const ratioValue = (ratio?: string) => {
  const [w, h] = String(ratio || '16:9').split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
};
const widthClassFor = (ratio?: string) => {
  const value = ratioValue(ratio);
  if (value < 0.8) return 'w-[176px] md:w-[196px]';
  if (value < 1.2) return 'w-[220px] md:w-[240px]';
  if (value < 1.6) return 'w-[268px] md:w-[292px]';
  return 'w-[310px] md:w-[340px]';
};
const generatedAsset = (asset: Asset) => {
  const raw = asset as any;
  return !asset.deleted_at && Boolean(raw.source_generation_id || String(raw.origin || '').toUpperCase() === 'GENERATED');
};

export const ResultsCanvas: React.FC<Props> = ({ lastSavedTime, validationErrors, onOpenPresets, presets, prompt }) => {
  const [live, setLive] = useState<Generation | null>(null);
  const [items, setItems] = useState<Generation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('VIDEO');
  const [downloadError, setDownloadError] = useState('');

  const refresh = async () => {
    try {
      const [generationRows, assetRows] = await Promise.all([
        generationClient.list(100),
        assetService.listAssets(),
      ]);
      setItems(generationRows || []);
      setAssets(assetRows || []);
    } catch {
      // Current live generation remains visible even if history refresh fails.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const handler = (e: Event) => {
      const next = (e as CustomEvent<Generation>).detail;
      setLive(next);
      setItems((prev) => [next, ...prev.filter((x) => x.generation_id !== next.generation_id)]);
      if (next.status === 'SUCCEEDED' || next.status === 'FAILED') window.setTimeout(refresh, 650);
    };
    window.addEventListener('generation:updated', handler);
    return () => window.removeEventListener('generation:updated', handler);
  }, []);

  const mergedGenerations = useMemo(() => {
    const rows = live ? [live, ...items.filter((x) => x.generation_id !== live.generation_id)] : items;
    return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [items, live]);

  const groups = useMemo<MediaGroup[]>(() => {
    const mediaByGeneration = new Map<string, Asset[]>();
    for (const asset of assets.filter(generatedAsset)) {
      const generationId = String((asset as any).source_generation_id || '');
      if (!generationId) continue;
      const bucket = mediaByGeneration.get(generationId) || [];
      const dedupeKey = asset.public_url || asset.asset_id;
      if (!bucket.some((x) => (x.public_url || x.asset_id) === dedupeKey)) bucket.push(asset);
      mediaByGeneration.set(generationId, bucket);
    }

    return mergedGenerations.map((generation) => {
      const kind: 'IMAGE' | 'VIDEO' = isImageGeneration(generation) ? 'IMAGE' : 'VIDEO';
      let groupAssets = mediaByGeneration.get(generation.generation_id) || [];
      if (!groupAssets.length && generation.result_url) {
        groupAssets = [{
          asset_id: `runtime-${generation.generation_id}`,
          owner_user_id: generation.user_id,
          type: kind,
          category: 'GENERIC',
          name: kind === 'VIDEO' ? `Vídeo ${generation.generation_id.slice(-6)}` : `Imagem ${generation.generation_id.slice(-6)}`,
          alias: `resultado_${generation.generation_id.slice(-6)}`,
          storage_path: '',
          public_url: generation.result_url,
          thumbnail_url: generation.thumbnail_url || generation.result_url,
          mime_type: kind === 'VIDEO' ? 'video/mp4' : 'image/png',
          size_bytes: 0,
          status: 'READY',
          created_at: generation.completed_at || generation.created_at,
          updated_at: generation.completed_at || generation.created_at,
          deleted_at: null,
        }];
      }
      return { generation, assets: groupAssets, ratio: generation.aspect_ratio || '16:9', kind };
    });
  }, [assets, mergedGenerations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((group) => {
      if (filter === 'VIDEO' && group.kind !== 'VIDEO') return false;
      if (q && !`${group.generation.original_prompt} ${group.generation.model_id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [groups, filter, query]);

  const handleDownload = async (asset: Asset) => {
    if (!asset.public_url) return;
    setDownloadError('');
    try {
      await downloadMediaDirect(asset.public_url, safeDownloadName(asset.name, asset.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'));
    } catch (err: any) {
      setDownloadError(err?.message || 'Não foi possível baixar este arquivo.');
    }
  };

  return (
    <div className="flex-1 h-full min-w-0 flex flex-col bg-[#0b0e13] overflow-hidden">
      <div className="shrink-0 px-5 lg:px-6 pt-5 pb-3 border-b border-white/[0.055]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div><h2 className="text-[20px] font-bold tracking-tight text-white">Minhas criações</h2><p className="mt-0.5 text-[10px] text-zinc-600">{lastSavedTime ? `Projeto salvo ${lastSavedTime}` : 'Resultados recentes do seu studio'}</p></div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 xl:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar criações..." className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.035] border border-white/[0.07] text-[11px] text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-violet-400/25"/></div>
            <button onClick={onOpenPresets} className="h-9 px-3 rounded-xl bg-white/[0.035] border border-white/[0.07] text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5 hover:bg-white/[0.06] hover:text-white"><Bookmark className="w-3.5 h-3.5"/> Presets <span className="text-zinc-700">{presets.length}</span></button>
            <button className="w-9 h-9 rounded-xl bg-white/[0.035] border border-white/[0.07] flex items-center justify-center text-zinc-500 hover:text-white"><SlidersHorizontal className="w-3.5 h-3.5"/></button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 text-[10px] font-semibold">
          <button onClick={() => setFilter('VIDEO')} className={`px-3 py-1.5 rounded-lg border ${filter === 'VIDEO' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>Vídeos</button>
          <button onClick={() => setFilter('ALL')} className={`px-3 py-1.5 rounded-lg border ${filter === 'ALL' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>Todos</button>
        </div>
        {downloadError && <p className="mt-2 text-[9px] text-rose-400">{downloadError}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-5">
        {loading && !visible.length ? <div className="h-full min-h-[360px] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-violet-400"/></div> : visible.length ? (
          <div className="space-y-7">
            {visible.map((group) => {
              const g = group.generation;
              return <section key={g.generation_id} className="min-w-0">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-semibold text-zinc-300 truncate">{g.original_prompt || 'Geração sem título'}</p><p className="mt-0.5 text-[8px] text-zinc-600 truncate">{g.model_id} · {g.aspect_ratio || '-'} · {g.resolution || '-'}{group.kind === 'VIDEO' && g.duration_seconds ? ` · ${g.duration_seconds}s` : ''}</p></div>
                  <span className="text-[8px] uppercase tracking-wider text-zinc-700">{group.kind === 'VIDEO' ? 'vídeo' : 'imagem'}</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {group.assets.length ? group.assets.map((asset) => <article key={asset.asset_id} className={`group/card shrink-0 ${widthClassFor(group.ratio)}`}>
                    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#121720] shadow-[0_16px_50px_rgba(0,0,0,.16)]" style={{ aspectRatio: cssRatio(group.ratio) }}>
                      {asset.type === 'VIDEO' ? <video src={asset.public_url} muted controls preload="metadata" className="w-full h-full object-cover"/> : <img src={asset.public_url} alt={asset.name} className="w-full h-full object-cover"/>}
                      <button onClick={() => handleDownload(asset)} title="Baixar" className="absolute right-2.5 top-2.5 w-8 h-8 rounded-xl bg-black/75 backdrop-blur border border-white/10 grid place-items-center text-white hover:bg-black/90"><Download className="w-3.5 h-3.5"/></button>
                    </div>
                  </article>) : working(g.status) ? Array.from({ length: Math.max(1, Number((g as any).number_of_outputs || 1)) }).map((_, index) => <article key={`${g.generation_id}-loading-${index}`} className={`shrink-0 ${widthClassFor(group.ratio)}`}>
                    <div className="relative overflow-hidden rounded-[14px] border border-cyan-300/20 bg-[#10141b]" style={{ aspectRatio: cssRatio(group.ratio) }}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.10),transparent_48%)] animate-pulse"/>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-300"/><span className="mt-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-600">{g.progress_percent != null ? `${g.progress_percent}%` : g.status}</span></div>
                    </div>
                  </article>) : g.status === 'FAILED' ? <div className="w-[260px] aspect-video rounded-[14px] border border-rose-400/10 bg-rose-500/[0.04] flex flex-col items-center justify-center"><AlertCircle className="w-5 h-5 text-rose-400"/><span className="mt-2 text-[9px] text-zinc-600">Falha na geração</span></div> : null}
                </div>
              </section>;
            })}
          </div>
        ) : (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center"><div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] grid place-items-center">{filter === 'VIDEO' ? <Film className="w-6 h-6 text-zinc-700"/> : <ImageIcon className="w-6 h-6 text-zinc-700"/>}</div><h3 className="mt-4 text-sm font-semibold text-zinc-300">{prompt.trim() ? 'Pronto para gerar' : 'Crie seu próximo vídeo'}</h3><p className="mt-1 text-[10px] text-zinc-600">Cada geração vira uma linha e preserva a proporção original.</p>{validationErrors.length > 0 && <p className="mt-3 text-[10px] text-rose-400">{validationErrors[0]}</p>}</div>
        )}
      </div>
    </div>
  );
};
