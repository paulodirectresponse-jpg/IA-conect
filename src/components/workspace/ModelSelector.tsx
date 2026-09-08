import React, { useState, useRef, useEffect } from 'react';
import { ModelRegistryItem, PricingEntry, GenerationMode } from '../../types/index.js';
import { formatCentsToBRL } from '../../config/constants.js';
import { ChevronDown, Star, Check, Film, Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  models: ModelRegistryItem[];
  selectedModelId: string;
  onSelectModel: (model: ModelRegistryItem) => void;
  favoriteModelIds?: string[];
  onToggleFavorite?: (modelId: string) => void;
  recentModelIds?: string[];
  pricing: PricingEntry[];
  currentResolution: string;
  currentDuration: number;
  currentOutputs: number;
  currentMode: GenerationMode;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  favoriteModelIds = [],
  onToggleFavorite,
  pricing,
  currentResolution,
  currentOutputs,
  currentMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModels = models.filter((m) => m.status !== 'INACTIVE');
  const selectedModel = activeModels.find((m) => m.model_id === selectedModelId) || activeModels[0];

  // Helper to calculate price strictly for current parameters
  const calculateModelPrice = (modelId: string): string => {
    const matching = pricing.filter(
      (p) =>
        p.active &&
        p.model_id === modelId &&
        (p.resolution === currentResolution || p.resolution === 'ANY' || !p.resolution) &&
        (!p.mode || p.mode === currentMode)
    );

    if (matching.length === 0) {
      // Fallback matching resolution without mode restriction if mode-specific is not seeded
      const fallbackMatching = pricing.filter(
        (p) =>
          p.active &&
          p.model_id === modelId &&
          (p.resolution === currentResolution || p.resolution === 'ANY' || !p.resolution)
      );
      if (fallbackMatching.length === 0) {
        return 'Price unavailable';
      }
      const minCents = Math.min(...fallbackMatching.map((p) => p.customer_price_cents));
      return formatCentsToBRL(minCents * currentOutputs);
    }

    const minCents = Math.min(...matching.map((p) => p.customer_price_cents));
    return formatCentsToBRL(minCents * currentOutputs);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort: Favorites first, then alphabetical
  const sortedModels = [...activeModels].sort((a, b) => {
    const aFav = favoriteModelIds.includes(a.model_id);
    const bFav = favoriteModelIds.includes(b.model_id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });

  const selectedPriceDisplay = selectedModel ? calculateModelPrice(selectedModel.model_id) : 'Price unavailable';

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <label className="font-medium text-zinc-300 flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-zinc-400" />
          <span>Model</span>
        </label>
        <span className="text-[11px] text-zinc-500 font-mono">{activeModels.length} models</span>
      </div>

      {/* Compact Single-line Trigger */}
      <div className="relative">
        <button
          type="button"
          id="btn-model-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border ${
            isOpen ? 'border-zinc-700 ring-1 ring-zinc-700' : 'border-zinc-800 hover:border-zinc-700'
          } text-zinc-100 flex items-center justify-between transition-all cursor-pointer text-xs`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-semibold text-zinc-100 tracking-tight truncate">
              {selectedModel?.name || 'Selecione um modelo'}
            </span>
            {selectedModel?.best_for && (
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 truncate">
                {selectedModel.best_for}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-xs font-mono font-medium ${
                selectedPriceDisplay === 'Price unavailable' ? 'text-zinc-500' : 'text-emerald-400'
              }`}
            >
              {selectedPriceDisplay}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 divide-y divide-zinc-800/60 max-h-72 overflow-y-auto">
            {sortedModels.map((model) => {
              const isSelected = model.model_id === selectedModelId;
              const isFavorite = favoriteModelIds.includes(model.model_id);
              const priceDisplay = calculateModelPrice(model.model_id);

              return (
                <div
                  key={model.model_id}
                  id={`model-option-${model.model_id}`}
                  onClick={() => {
                    onSelectModel(model);
                    setIsOpen(false);
                  }}
                  className={`group px-3.5 py-2.5 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                    isSelected ? 'bg-zinc-800/90 text-white' : 'hover:bg-zinc-800/50 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-700 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isSelected ? 'text-white font-semibold' : 'text-zinc-200'}`}>
                          {model.name}
                        </span>
                        {model.best_for && (
                          <span className="text-[10px] text-zinc-400 font-normal truncate">
                            • {model.best_for}
                          </span>
                        )}
                      </div>
                      {model.description && (
                        <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                          {model.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`text-xs font-mono ${
                        priceDisplay === 'Price unavailable' ? 'text-zinc-500' : 'text-emerald-400 font-medium'
                      }`}
                    >
                      {priceDisplay}
                    </span>

                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(model.model_id);
                        }}
                        className={`p-1 rounded hover:bg-zinc-700/60 transition-colors ${
                          isFavorite ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
