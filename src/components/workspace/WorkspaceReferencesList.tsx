import React, { useState } from 'react';
import { WorkspaceReference } from '../../types/index.js';
import { ReferenceRulesModal } from './ReferenceRulesModal.js';
import { Image as ImageIcon, Video, Music, Settings, X, Plus, ShieldCheck } from 'lucide-react';

interface WorkspaceReferencesListProps {
  references: WorkspaceReference[];
  onUpdateReference: (updated: WorkspaceReference) => void;
  onRemoveReference: (assetId: string) => void;
  onOpenAssetPicker: () => void;
  maxReferences?: number;
}

export const WorkspaceReferencesList: React.FC<WorkspaceReferencesListProps> = ({
  references,
  onUpdateReference,
  onRemoveReference,
  onOpenAssetPicker,
  maxReferences = 4,
}) => {
  const [editingRef, setEditingRef] = useState<WorkspaceReference | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Mídias & Referências de Prompt</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
            {references.length}/{maxReferences}
          </span>
        </div>

        {references.length < maxReferences && (
          <button
            type="button"
            id="btn-add-reference-trigger"
            onClick={onOpenAssetPicker}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Referência</span>
          </button>
        )}
      </div>

      {references.length === 0 ? (
        <div
          onClick={onOpenAssetPicker}
          className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 rounded-xl p-3 text-center cursor-pointer transition-colors"
        >
          <p className="text-xs text-zinc-400">
            Nenhuma referência anexada. Digite <span className="text-emerald-400 font-mono font-medium">@</span> no prompt ou clique para adicionar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {references.map((ref) => {
            const priorityColor: Record<string, string> = {
              LOW: 'bg-zinc-800 text-zinc-400 border-zinc-700',
              MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
              HIGH: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              CRITICAL: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            };

            return (
              <div
                key={ref.asset_id}
                id={`reference-card-${ref.asset_id}`}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between hover:border-zinc-700 transition-all text-xs"
              >
                {/* Top preview */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/60 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {ref.asset?.thumbnail_url || ref.asset?.public_url ? (
                      <img
                        src={ref.asset.thumbnail_url || ref.asset.public_url}
                        alt={ref.asset.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : ref.asset?.type === 'VIDEO' ? (
                      <Video className="w-4 h-4 text-sky-400" />
                    ) : ref.asset?.type === 'AUDIO' ? (
                      <Music className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-emerald-400 font-semibold truncate">@{ref.alias_snapshot}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{ref.asset?.name || 'Asset'}</p>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveReference(ref.asset_id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-all"
                    title="Remover referência"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Bottom status & action */}
                <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityColor[ref.priority] || priorityColor.HIGH}`}>
                    {ref.priority}
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingRef(ref)}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 py-0.5 px-1 rounded hover:bg-zinc-800 transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Regras</span>
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
