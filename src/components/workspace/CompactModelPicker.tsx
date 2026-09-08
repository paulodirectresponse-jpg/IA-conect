import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ModelRegistryItem, PricingEntry, GenerationMode } from '../../types/index.js';
import { ChevronDown, Search, Star, Sparkles, Check, Info } from 'lucide-react';
import { formatCentsToBRL } from '../../config/constants.js';

interface CompactModelPickerProps {
  models: ModelRegistryItem[];
  pricing: PricingEntry[];
  selectedModelId: string;
  onSelectModel: (model: ModelRegistryItem) => void;
  favoriteModelIds: string[];
  recentModelIds: string[];
  onToggleFavorite: (modelId: string) => void;
  currentResolution: string;
  currentMode: GenerationMode;
}

export const CompactModelPicker: React.FC<CompactModelPickerProps> = ({
  models,
  pricing,
  selectedModelId,
  onSelectModel,
  favoriteModelIds,
  recentModelIds,
  onToggleFavorite,
  currentResolution,
  currentMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId) || models[0];

  // Helper to calculate estimated price for any model with current specs
  const getModelPriceFormatted = (modelId: string): string => {
    const matching = pricing.filter(
      (p) =>
        p.active &&
        p.model_id === modelId &&
        (p.resolution === currentResolution || p.resolution === 'ANY' || !p.resolution) &&
        (!p.mode || p.mode === currentMode)
    );

    const fallback = matching.length === 0
      ? pricing.filter(
          (p) =>
            p.active &&
            p.model_id === modelId &&
            (p.resolution === currentResolution || p.resolution === 'ANY' || !p.resolution)
        )
      : matching;

    if (fallback.length > 0) {
      const minPrice = Math.min(...fallback.map((p) => p.customer_price_cents));
      return formatCentsToBRL(minPrice);
    }

    // Check if model has any price at all
    const anyPrice = pricing.filter((p) => p.active && p.model_id === modelId);
    if (anyPrice.length > 0) {
      const minPrice = Math.min(...anyPrice.map((p) => p.customer_price_cents));
      return formatCentsToBRL(minPrice);
    }

    return '—';
  };

  const selectedModelPrice = selectedModel ? getModelPriceFormatted(selectedModel.model_id) : '—';

  // Filtered lists
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [models, search]);

  const favoriteModels = filteredModels.filter((m) => favoriteModelIds.includes(m.model_id));
  const recentModels = filteredModels.filter(
    (m) => recentModelIds.includes(m.model_id) && !favoriteModelIds.includes(m.model_id)
  );
  const otherModels = filteredModels.filter(
    (m) => !favoriteModelIds.includes(m.model_id) && !recentModelIds.includes(m.model_id)
  );

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
        Model
      </label>

      {/* Trigger: Compact single line button: [ WAN 3.0           R$ 4,28  ▾ ] */}
      <button
        type="button"
        id="compact-model-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl transition-all shadow-2xs text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <span className="font-semibold text-xs text-zinc-900 truncate">
            {selectedModel?.name || 'Select Model'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0 font-medium">
            {selectedModel?.provider || 'AI'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            {selectedModelPrice}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-600 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          id="compact-model-picker-dropdown"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-zinc-100 bg-zinc-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 text-xs focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-3">
            {/* Auto (Smart Router) - explicitly disabled with explanation */}
            <div className="px-2 py-1.5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 flex items-center justify-between opacity-70">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <div>
                  <p className="font-medium text-zinc-700 text-xs">Auto (Smart Router)</p>
                  <p className="text-[10px] text-zinc-400">Smart routing available soon</p>
                </div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 font-medium">
                Soon
              </span>
            </div>

            {/* Favorites Group */}
            {favoriteModels.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>Favorites</span>
                </div>
                <div className="space-y-0.5">
                  {favoriteModels.map((model) => (
                    <ModelItemRow
                      key={model.model_id}
                      model={model}
                      isSelected={model.model_id === selectedModelId}
                      price={getModelPriceFormatted(model.model_id)}
                      isFavorite={true}
                      onSelect={() => {
                        onSelectModel(model);
                        setIsOpen(false);
                      }}
                      onToggleFavorite={() => onToggleFavorite(model.model_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Models */}
            {recentModels.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Recent
                </div>
                <div className="space-y-0.5">
                  {recentModels.map((model) => (
                    <ModelItemRow
                      key={model.model_id}
                      model={model}
                      isSelected={model.model_id === selectedModelId}
                      price={getModelPriceFormatted(model.model_id)}
                      isFavorite={false}
                      onSelect={() => {
                        onSelectModel(model);
                        setIsOpen(false);
                      }}
                      onToggleFavorite={() => onToggleFavorite(model.model_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Models */}
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                All Models
              </div>
              <div className="space-y-0.5">
                {(favoriteModels.length === 0 && recentModels.length === 0
                  ? filteredModels
                  : otherModels
                ).map((model) => (
                  <ModelItemRow
                    key={model.model_id}
                    model={model}
                    isSelected={model.model_id === selectedModelId}
                    price={getModelPriceFormatted(model.model_id)}
                    isFavorite={favoriteModelIds.includes(model.model_id)}
                    onSelect={() => {
                      onSelectModel(model);
                      setIsOpen(false);
                    }}
                    onToggleFavorite={() => onToggleFavorite(model.model_id)}
                  />
                ))}
              </div>
            </div>

            {filteredModels.length === 0 && (
              <div className="text-center py-6 text-zinc-400 text-xs">
                No models match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ModelItemRowProps {
  model: ModelRegistryItem;
  isSelected: boolean;
  price: string;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const ModelItemRow: React.FC<ModelItemRowProps> = ({
  model,
  isSelected,
  price,
  isFavorite,
  onSelect,
  onToggleFavorite,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-medium'
          : 'hover:bg-zinc-100 text-zinc-800 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            isFavorite
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-zinc-300 group-hover:text-zinc-400 hover:text-amber-500'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500' : ''}`} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs text-zinc-900 truncate">{model.name}</span>
            {isSelected && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-zinc-500 truncate">{model.provider}</span>
            {model.tags && model.tags[0] && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-100 text-zinc-500 font-medium">
                {model.tags[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span className="font-mono text-xs font-semibold text-emerald-700">{price}</span>
      </div>
    </div>
  );
};
