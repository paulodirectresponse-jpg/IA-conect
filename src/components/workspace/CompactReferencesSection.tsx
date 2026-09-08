import React, { useState } from 'react';
import { Asset, WorkspaceReference } from '../../types/index.js';
import { ReferenceRulesModal } from './ReferenceRulesModal.js';
import { Image as ImageIcon, Video, Music, Plus, X, Settings, Sparkles } from 'lucide-react';

interface CompactReferencesSectionProps {
  references: WorkspaceReference[];
  initialImage: Asset | null;
  endImage: Asset | null;
  supportsEndImage: boolean;
  onSetInitialImage: (asset: Asset | null) => void;
  onSetEndImage: (asset: Asset | null) => void;
  onAddReference: (asset: Asset) => void;
  onRemoveReference: (assetId: string) => void;
  onUpdateReference: (updated: WorkspaceReference) => void;
  onOpenAssetPicker: (targetSlot?: 'INITIAL' | 'END' | 'GENERAL') => void;
  prompt: string;
}

export const CompactReferencesSection: React.FC<CompactReferencesSectionProps> = ({
  references,
  initialImage,
  endImage,
  supportsEndImage,
  onSetInitialImage,
  onSetEndImage,
  onRemoveReference,
  onUpdateReference,
  onOpenAssetPicker,
  prompt,
}) => {
  const [editingRef, setEditingRef] = useState<WorkspaceReference | null>(null);

  // Filter out the ones that are assigned directly to initial or end image slots
  const generalReferences = references.filter(
    (r) => r.asset_id !== initialImage?.asset_id && r.asset_id !== endImage?.asset_id
  );

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {/* Slot: Imagem Inicial */}
        <div className="flex items-center">
          {initialImage ? (
            <div className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-emerald-500/40 text-zinc-100 shadow-xs">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                <img
                  src={initialImage.thumbnail_url || initialImage.public_url}
                  alt={initialImage.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-emerald-400">Start Frame</span>
                </div>
                <p className="text-[11px] font-mono text-zinc-300 truncate max-w-[90px]">@{initialImage.alias}</p>
              </div>
              <button
                type="button"
                onClick={() => onSetInitialImage(null)}
                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title="Remover frame inicial"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="btn-add-initial-image"
              onClick={() => onOpenAssetPicker('INITIAL')}
              className="px-3 py-2 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
              <span>+ Imagem inicial</span>
            </button>
          )}
        </div>

        {/* Slot: Imagem Final (conditionally rendered) */}
        {supportsEndImage && (
          <div className="flex items-center">
            {endImage ? (
              <div className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-indigo-500/40 text-zinc-100 shadow-xs">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                  <img
                    src={endImage.thumbnail_url || endImage.public_url}
                    alt={endImage.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0 pr-1">
                  <span className="text-[10px] font-semibold text-indigo-400">End Frame</span>
                  <p className="text-[11px] font-mono text-zinc-300 truncate max-w-[90px]">@{endImage.alias}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSetEndImage(null)}
                  className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  title="Remover frame final"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-add-end-image"
                onClick={() => onOpenAssetPicker('END')}
                className="px-3 py-2 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
              >
                <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>+ Imagem final</span>
              </button>
            )}
          </div>
        )}

        {/* Button: Add other reference */}
        <button
          type="button"
          id="btn-add-general-reference"
          onClick={() => onOpenAssetPicker('GENERAL')}
          className="px-3 py-2 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
        >
          <Plus className="w-3.5 h-3.5 text-zinc-500" />
          <span>+ Referência</span>
        </button>
      </div>

      {/* General References Chips */}
      {generalReferences.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {generalReferences.map((ref) => {
            const isMentionedInPrompt = prompt.includes(`@${ref.alias_snapshot}`);

            return (
              <div
                key={ref.asset_id}
                id={`ref-chip-${ref.asset_id}`}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-900 border transition-all ${
                  isMentionedInPrompt
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                  {ref.asset?.thumbnail_url || ref.asset?.public_url ? (
                    <img
                      src={ref.asset.thumbnail_url || ref.asset.public_url}
                      alt={ref.asset.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : ref.asset?.type === 'VIDEO' ? (
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                  ) : ref.asset?.type === 'AUDIO' ? (
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-emerald-400 font-medium text-xs truncate max-w-[110px]">
                    @{ref.alias_snapshot}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                    {ref.asset?.category || 'REF'}
                  </span>
                </div>

                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onClick={() => setEditingRef(ref)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Regras de preservação"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveReference(ref.asset_id)}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    title="Remover referência"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rules Modal */}
      {editingRef && (
        <ReferenceRulesModal
          reference={editingRef}
          isOpen={true}
          onClose={() => setEditingRef(null)}
          onSave={(updated) => {
            onUpdateReference(updated);
            setEditingRef(null);
          }}
        />
      )}
    </div>
  );
};
