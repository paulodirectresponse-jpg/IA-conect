import React from 'react';
import { ModelRegistryItem } from '../../types/index.js';
import { getModelCapabilities } from '../../services/modelCapabilities.js';
import { Star, Zap, Film, Check, Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  models: ModelRegistryItem[];
  selectedModelId: string;
  onSelectModel: (model: ModelRegistryItem) => void;
  favoriteModelIds: string[];
  onToggleFavorite: (modelId: string) => void;
  recentModelIds: string[];
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  favoriteModelIds,
  onToggleFavorite,
  recentModelIds,
}) => {
  const activeModels = models.filter((m) => m.status !== 'INACTIVE');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-emerald-400" />
          <span>Motor de Inteligência Artificial</span>
        </label>
        <span className="text-[10px] text-zinc-500">{activeModels.length} modelos disponíveis</span>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 gap-2">
        {activeModels.map((model) => {
          const isSelected = model.model_id === selectedModelId;
          const isFavorite = favoriteModelIds.includes(model.model_id);
          const caps = getModelCapabilities(model);

          return (
            <div
              key={model.model_id}
              id={`model-card-${model.model_id}`}
              onClick={() => onSelectModel(model)}
              className={`group relative p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                isSelected
                  ? 'bg-zinc-900 border-emerald-500/70 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              {/* Top row: Name, Badges, Favorite Star */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-700'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>

                  <span className="font-semibold text-white tracking-tight">{model.name}</span>

                  {model.best_for && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      {model.best_for}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  id={`btn-star-model-${model.model_id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(model.model_id);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    isFavorite ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title={isFavorite ? 'Remover dos favoritos' : 'Favoritar modelo'}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
              </div>

              {/* Description */}
              <p className="text-zinc-400 text-[11px] mt-1 line-clamp-1 leading-relaxed">
                {model.description}
              </p>

              {/* Capability Chips */}
              <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center gap-2 text-[10px] text-zinc-400">
                <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/40">
                  Até {caps.supported_resolutions[caps.supported_resolutions.length - 1] || '1080p'}
                </span>
                <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/40">
                  {Math.max(...caps.supported_durations)}s máx
                </span>
                {caps.supports_video_reference && (
                  <span className="bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">
                    Vídeo @Ref
                  </span>
                )}
                {caps.supports_image_reference && (
                  <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/40">
                    Até {caps.max_reference_images} img @ref
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
