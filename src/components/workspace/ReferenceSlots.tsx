import React from 'react';
import { Asset, WorkspaceReference, GenerationMode } from '../../types/index.js';
import { Plus, X, Image as ImageIcon, Sliders, Sparkles, Check, Film } from 'lucide-react';

interface ReferenceSlotsProps {
  initialImage: Asset | null;
  endImage: Asset | null;
  references: WorkspaceReference[];
  onOpenPicker: (targetSlot: 'INITIAL' | 'END' | 'GENERAL') => void;
  onRemoveSlot: (slot: 'INITIAL' | 'END') => void;
  onRemoveReference: (assetId: string) => void;
  onConfigureReference: (ref: WorkspaceReference) => void;
  supportsEndImage: boolean;
  resolvedMode: GenerationMode;
  modeExplanation?: string;
}

export const ReferenceSlots: React.FC<ReferenceSlotsProps> = ({
  initialImage,
  endImage,
  references,
  onOpenPicker,
  onRemoveSlot,
  onRemoveReference,
  onConfigureReference,
  supportsEndImage,
  resolvedMode,
  modeExplanation,
}) => {
  // Additional references that are NOT purely the start or end frame
  const additionalReferences = references.filter(
    (r) =>
      r.asset_id !== initialImage?.asset_id &&
      r.asset_id !== endImage?.asset_id
  );

  const getModeFriendlyName = (m: GenerationMode): string => {
    switch (m) {
      case 'TEXT_TO_VIDEO':
        return 'Text to Video';
      case 'IMAGE_TO_VIDEO':
        return 'Image to Video';
      case 'REFERENCE_TO_VIDEO':
        return 'Reference to Video';
      case 'VIDEO_TO_VIDEO':
        return 'Video to Video';
      default:
        return m.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header with inferred mode badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-zinc-700">References</label>
          <span className="text-[10px] text-zinc-400 font-normal">
            ({references.length} attached)
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
          <Sparkles className="w-2.5 h-2.5" />
          <span title={modeExplanation || 'Inferred from your inputs'}>
            {getModeFriendlyName(resolvedMode)}
          </span>
        </div>
      </div>

      {/* Frame Slots Grid: [ Start Frame ] [ End Frame ] */}
      <div className={`grid ${supportsEndImage ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        {/* Start Frame Slot */}
        <div className="relative">
          {initialImage ? (
            <div className="relative group w-full h-24 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 flex items-center justify-center shadow-2xs">
              <img
                src={initialImage.thumbnail_url || initialImage.public_url}
                alt={initialImage.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPicker('INITIAL')}
                  className="px-2 py-1 rounded-md bg-white text-zinc-800 text-[10px] font-medium shadow-xs cursor-pointer hover:bg-zinc-100"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSlot('INITIAL')}
                  className="p-1 rounded-md bg-red-600 text-white text-[10px] shadow-xs cursor-pointer hover:bg-red-700"
                  title="Remove start frame"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-medium backdrop-blur-2xs">
                Start frame
              </span>
            </div>
          ) : (
            <button
              type="button"
              id="slot-start-frame-btn"
              onClick={() => onOpenPicker('INITIAL')}
              className="w-full h-24 rounded-xl border-2 border-dashed border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-zinc-50/60 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:border-emerald-300 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-medium text-zinc-600 group-hover:text-emerald-700">
                Start frame
              </span>
              <span className="text-[9px] text-zinc-400">Click or drop image</span>
            </button>
          )}
        </div>

        {/* End Frame Slot (if supported by model) */}
        {supportsEndImage && (
          <div className="relative">
            {endImage ? (
              <div className="relative group w-full h-24 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 flex items-center justify-center shadow-2xs">
                <img
                  src={endImage.thumbnail_url || endImage.public_url}
                  alt={endImage.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPicker('END')}
                    className="px-2 py-1 rounded-md bg-white text-zinc-800 text-[10px] font-medium shadow-xs cursor-pointer hover:bg-zinc-100"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveSlot('END')}
                    className="p-1 rounded-md bg-red-600 text-white text-[10px] shadow-xs cursor-pointer hover:bg-red-700"
                    title="Remove end frame"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-medium backdrop-blur-2xs">
                  End frame
                </span>
              </div>
            ) : (
              <button
                type="button"
                id="slot-end-frame-btn"
                onClick={() => onOpenPicker('END')}
                className="w-full h-24 rounded-xl border-2 border-dashed border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-zinc-50/60 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:border-emerald-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-zinc-600 group-hover:text-emerald-700">
                  End frame
                </span>
                <span className="text-[9px] text-zinc-400">Optional target</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Additional References List */}
      {additionalReferences.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">
            Extra Assets & Guides
          </span>
          <div className="space-y-1">
            {additionalReferences.map((ref) => (
              <div
                key={ref.asset_id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <div className="w-5 h-5 rounded bg-zinc-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {ref.asset?.thumbnail_url || ref.asset?.public_url ? (
                      <img
                        src={ref.asset?.thumbnail_url || ref.asset?.public_url}
                        alt={ref.asset?.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="w-3 h-3 text-zinc-500" />
                    )}
                  </div>
                  <span className="font-mono text-emerald-700 font-semibold truncate text-[11px]">
                    @{ref.alias_snapshot}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-zinc-500 border border-zinc-200">
                    {ref.asset?.category || 'REF'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onConfigureReference(ref)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors"
                    title="Configure preservation rules"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveReference(ref.asset_id)}
                    className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove reference"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Button to attach extra reference */}
      <button
        type="button"
        id="btn-add-extra-reference"
        onClick={() => onOpenPicker('GENERAL')}
        className="w-full py-1.5 px-3 rounded-lg border border-dashed border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-600 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3 text-zinc-500" />
        <span>Add reference asset</span>
      </button>
    </div>
  );
};
