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
        <label className="font-semibold text-zinc-900 flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-zinc-600" />
          <span>Modelo de Geração</span>
        </label>
        <span className="text-[11px] text-zinc-400">{activeModels.length} disponíveis</span>
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
                  ? 'bg-white border-zinc-900 shadow-xs ring-1 ring-zinc-900'
                  : 'bg-zinc-50/60 border-zinc-200 hover:bg-white hover:border-zinc-300'
              }`}
            >
              {/* Top row: Name, Badges, Favorite Star */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>

                  <span className="font-semibold text-zinc-900 tracking-tight">{model.name}</span>

                  {model.best_for && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 font-medium">
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
                    isFavorite ? 'text-amber-500' : 'text-zinc-300 hover:text-zinc-500'
                  }`}
                  title={isFavorite ? 'Remover dos favoritos' : 'Favoritar modelo'}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500' : ''}`} />
                </button>
              </div>

              {/* Description */}
              <p className="text-zinc-500 text-[11px] mt-1 line-clamp-1 leading-relaxed">
                {model.description}
              </p>

              {/* Capability Chips */}
              <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center gap-2 text-[10px] text-zinc-500">
                <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/80">
                  Até {caps.supported_resolutions[caps.supported_resolutions.length - 1] || '1080p'}
                </span>
                <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/80">
                  {Math.max(...caps.supported_durations)}s máx
                </span>
                {caps.supports_video_reference && (
                  <span className="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200/80 font-medium">
                    Vídeo @Ref
                  </span>
                )}
                {caps.supports_image_reference && (
                  <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/80">
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
