import React from 'react';
import { Asset } from '../../types/index.js';
import { Image as ImageIcon, Video, Music, Plus } from 'lucide-react';

interface ReferenceAutocompleteProps {
  assets: Asset[];
  selectedIndex: number;
  onSelect: (asset: Asset) => void;
  onQuickUpload: () => void;
  query: string;
}

export const ReferenceAutocomplete: React.FC<ReferenceAutocompleteProps> = ({
  assets,
  selectedIndex,
  onSelect,
  onQuickUpload,
  query,
}) => {
  return (
    <div
      id="reference-autocomplete-dropdown"
      className="absolute z-50 w-80 max-h-72 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 backdrop-blur-md text-xs"
    >
      <div className="px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 border-b border-zinc-800/80 flex items-center justify-between">
        <span>Referências visuais (@)</span>
        {query && <span className="text-zinc-500 font-mono">filtro: @{query}</span>}
      </div>

      <div className="py-1">
        {assets.length === 0 ? (
          <div className="px-3 py-3 text-center text-zinc-500 text-xs">
            Nenhum asset encontrado com &quot;@{query}&quot;
          </div>
        ) : (
          assets.map((asset, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={asset.asset_id}
                type="button"
                id={`autocomplete-item-${asset.asset_id}`}
                onClick={() => onSelect(asset)}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                {/* Preview / Thumbnail */}
                <div className="w-8 h-8 rounded-md bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-700/50">
                  {asset.thumbnail_url || asset.public_url ? (
                    <img
                      src={asset.thumbnail_url || asset.public_url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : asset.type === 'VIDEO' ? (
                    <Video className="w-4 h-4 text-sky-400" />
                  ) : asset.type === 'AUDIO' ? (
                    <Music className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-emerald-400 font-mono">@{asset.alias}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                      {asset.category}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-[11px] truncate mt-0.5">{asset.name}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-zinc-800/80 pt-1 mt-1">
        <button
          type="button"
          id="btn-quick-upload-from-autocomplete"
          onClick={onQuickUpload}
          className="w-full text-left px-2.5 py-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Fazer upload de novo asset...</span>
        </button>
      </div>
    </div>
  );
};
