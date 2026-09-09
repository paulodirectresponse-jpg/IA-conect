import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModelRegistryItem, PricingEntry } from '../../types/index.js';
import { ChevronDown, Search, Star, Check, Sparkles } from 'lucide-react';
import { formatCentsToBRL } from '../../config/constants.js';

interface Props {
  models: ModelRegistryItem[];
  pricing: PricingEntry[];
  selectionMode: 'AUTO' | 'MANUAL';
  selectedModelId: string;
  autoResolvedModel?: ModelRegistryItem | null;
  onSelectAuto: () => void;
  onSelectModel: (m: ModelRegistryItem) => void;
  favoriteModelIds: string[];
  recentModelIds: string[];
  onToggleFavorite: (id: string) => void;
  currentResolution: string;
  currentDuration: number;
  currentOutputs: number;
}

export const CompactModelPicker: React.FC<Props> = ({
  models,
  pricing,
  selectionMode,
  selectedModelId,
  autoResolvedModel,
  onSelectAuto,
  onSelectModel,
  favoriteModelIds,
  recentModelIds,
  onToggleFavorite,
  currentResolution,
  currentDuration,
  currentOutputs,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = models.find((m) => m.model_id === selectedModelId) || null;

  const modelPrice = (id?: string | null) => {
    if (!id) return null;
    const rows = pricing.filter(
      (p) =>
        p.active &&
        p.model_id === id &&
        (!p.resolution || p.resolution === 'ANY' || p.resolution.toLowerCase() === currentResolution.toLowerCase())
    );
    if (!rows.length) return null;
    return Math.min(
      ...rows.map((p) =>
        Math.ceil(
          p.customer_price_cents *
            (currentDuration / Math.max(1, p.duration_seconds || 1)) *
            Math.max(1, currentOutputs)
        )
      )
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter(
      (m) =>
        m.status !== 'INACTIVE' &&
        (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
    );
  }, [models, search]);

  const sorted = [...filtered].sort(
    (a, b) =>
      Number(favoriteModelIds.includes(b.model_id)) - Number(favoriteModelIds.includes(a.model_id)) ||
      Number(recentModelIds.includes(b.model_id)) - Number(recentModelIds.includes(a.model_id)) ||
      a.name.localeCompare(b.name)
  );

  const displayModel = selectionMode === 'AUTO' ? autoResolvedModel : selected;
  const displayPrice = modelPrice(displayModel?.model_id);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">IA</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-left transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs truncate flex items-center gap-1.5">
            {selectionMode === 'AUTO' && <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
            {selectionMode === 'AUTO' ? 'Auto' : selected?.name || 'Selecionar IA'}
          </p>
          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
            {selectionMode === 'AUTO'
              ? autoResolvedModel
                ? `Compatível agora: ${autoResolvedModel.name}`
                : 'Defina o que precisa e o sistema encontra a IA compatível'
              : selected?.best_for || selected?.description || ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs font-semibold text-emerald-700">
            {displayPrice == null ? '—' : formatCentsToBRL(displayPrice)}
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-[70] top-full mt-1.5 inset-x-0 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-1.5 border-b border-zinc-100">
            <button
              type="button"
              onClick={() => {
                onSelectAuto();
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                selectionMode === 'AUTO' ? 'bg-emerald-50' : 'hover:bg-zinc-50'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Auto</p>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  Você define os inputs; o sistema escolhe uma IA realmente compatível.
                </p>
              </div>
              {selectionMode === 'AUTO' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          </div>

          <div className="p-2 border-b border-zinc-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar IA"
                className="w-full pl-8 pr-3 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {sorted.map((m) => {
              const fav = favoriteModelIds.includes(m.model_id);
              const cents = modelPrice(m.model_id);
              const active = selectionMode === 'MANUAL' && m.model_id === selectedModelId;
              return (
                <div
                  key={m.model_id}
                  onClick={() => {
                    onSelectModel(m);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                    active ? 'bg-emerald-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(m.model_id);
                    }}
                    className={fav ? 'text-amber-500' : 'text-zinc-300 hover:text-zinc-400'}
                    title="Favoritar"
                  >
                    <Star className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{m.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{m.best_for || m.description}</p>
                  </div>
                  <span className="font-mono text-xs text-emerald-700">
                    {cents == null ? '—' : formatCentsToBRL(cents)}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
              );
            })}
            {!sorted.length && <p className="p-6 text-center text-xs text-zinc-400">Nenhuma IA encontrada.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
