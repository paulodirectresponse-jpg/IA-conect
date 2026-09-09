import React, { useEffect, useMemo, useState } from 'react';
import { WorkspacePreset, Generation } from '../../types/index.js';
import { AlertCircle, Bookmark, Download, ExternalLink, Film, Loader2, MoreHorizontal, Play, RefreshCcw, Search, SlidersHorizontal } from 'lucide-react';
import { generationClient } from '../../services/generationClient.js';

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

const working = (status: string) => ['QUEUED','RESERVING_FUNDS','SUBMITTED','PROCESSING'].includes(status);

export const ResultsCanvas: React.FC<Props> = ({ lastSavedTime, validationErrors, onOpenPresets, presets, prompt }) => {
  const [live, setLive] = useState<Generation | null>(null);
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const refresh = async () => {
    try { setItems(await generationClient.list(30)); } catch { /* gallery remains usable for current generation */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const handler = (e: Event) => {
      const next = (e as CustomEvent<Generation>).detail;
      setLive(next);
      setItems((prev) => [next, ...prev.filter((x) => x.generation_id !== next.generation_id)]);
      if (next.status === 'SUCCEEDED' || next.status === 'FAILED') window.setTimeout(refresh, 500);
    };
    window.addEventListener('generation:updated', handler);
    return () => window.removeEventListener('generation:updated', handler);
  }, []);

  const visible = useMemo(() => {
    const merged = live ? [live, ...items.filter((x) => x.generation_id !== live.generation_id)] : items;
    const q = query.trim().toLowerCase();
    return q ? merged.filter((x) => `${x.original_prompt} ${x.model_id}`.toLowerCase().includes(q)) : merged;
  }, [items, live, query]);

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
        <div className="mt-4 flex gap-5 text-[10px] font-semibold"><span className="text-white border-b-2 border-violet-400 pb-2">Todos</span><span className="text-zinc-600 pb-2">Vídeos</span><span className="text-zinc-600 pb-2">Favoritos</span></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-5">
        {loading && !visible.length ? <div className="h-full min-h-[360px] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-violet-400"/></div> : visible.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-x-4 gap-y-5">
            {visible.map((g) => {
              const url = g.result_url || '';
              return (
                <article key={g.generation_id} className="group min-w-0">
                  <div className="relative aspect-video overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#121720] shadow-[0_16px_50px_rgba(0,0,0,.16)]">
                    {url ? <video src={url} muted preload="metadata" className="w-full h-full object-cover"/> : working(g.status) ? <div className="w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,.12),transparent_45%),#10141b]"><Loader2 className="w-6 h-6 animate-spin text-violet-400"/><span className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{g.status}{g.progress_percent != null ? ` · ${g.progress_percent}%` : ''}</span></div> : g.status === 'FAILED' ? <div className="w-full h-full flex flex-col items-center justify-center"><AlertCircle className="w-6 h-6 text-rose-400"/><span className="mt-2 text-[10px] text-zinc-600">Falha na geração</span></div> : <div className="w-full h-full grid place-items-center"><Film className="w-7 h-7 text-zinc-700"/></div>}
                    {url && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/38 transition-all flex items-center justify-center"><div className="opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#090b10]/88 backdrop-blur-xl p-1.5"><a href={url} target="_blank" rel="noreferrer" title="Abrir" className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-300"><Play className="w-4 h-4"/></a><a href={url} download title="Baixar" className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-300"><Download className="w-4 h-4"/></a><button title="Regenerar" onClick={() => window.dispatchEvent(new CustomEvent('generation:regenerate',{detail:g}))} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-300"><RefreshCcw className="w-4 h-4"/></button><a href={url} target="_blank" rel="noreferrer" title="Mais" className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-300"><ExternalLink className="w-4 h-4"/></a></div></div>}
                    <span className="absolute left-2.5 bottom-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur text-[9px] font-bold text-white">{g.duration_seconds ? `0:${String(g.duration_seconds).padStart(2,'0')}` : 'VIDEO'}</span>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-semibold text-zinc-200 truncate">{g.original_prompt || 'Geração sem título'}</p><p className="mt-0.5 text-[9px] text-zinc-600 truncate">{g.model_id} · {g.duration_seconds || '-'}s · {g.aspect_ratio || '-'} · {g.resolution || '-'}</p></div><button className="p-1 text-zinc-700 hover:text-zinc-300"><MoreHorizontal className="w-4 h-4"/></button></div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center"><div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] grid place-items-center"><Film className="w-6 h-6 text-zinc-700"/></div><h3 className="mt-4 text-sm font-semibold text-zinc-300">{prompt.trim() ? 'Pronto para gerar' : 'Crie seu próximo vídeo'}</h3><p className="mt-1 text-[10px] text-zinc-600">Suas gerações aparecem aqui e ficam prontas para reutilizar.</p>{validationErrors.length > 0 && <p className="mt-3 text-[10px] text-rose-400">{validationErrors[0]}</p>}</div>
        )}
      </div>
    </div>
  );
};
