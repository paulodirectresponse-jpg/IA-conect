import React from 'react';
import {
  Asset,
  WorkspaceReference,
  GenerationMode,
  ModelCapabilities,
} from '../../types/index.js';
import {
  Plus,
  X,
  Sliders,
  Sparkles,
  Image as ImageIcon,
  Video,
  Music,
  Layers3,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  initialImage: Asset | null;
  endImage: Asset | null;
  references: WorkspaceReference[];
  onOpenPicker: (target: 'INITIAL' | 'END' | 'GENERAL') => void;
  onRemoveSlot: (slot: 'INITIAL' | 'END') => void;
  onRemoveReference: (id: string) => void;
  onConfigureReference: (ref: WorkspaceReference) => void;
  capabilities: ModelCapabilities | null;
  resolvedMode: GenerationMode;
  modeExplanation?: string;
  selectionMode: 'AUTO' | 'MANUAL';
  resolvedModelName?: string;
}

const MediaThumb: React.FC<{ asset?: Asset; className?: string }> = ({ asset, className = 'w-full h-full' }) => {
  const url = asset?.thumbnail_url || asset?.public_url;
  if (asset?.type === 'IMAGE' && url) return <img src={url} alt={asset.name} className={`${className} object-cover`} />;
  if (asset?.type === 'VIDEO') return <Video className="w-5 h-5 text-sky-500" />;
  if (asset?.type === 'AUDIO') return <Music className="w-5 h-5 text-violet-500" />;
  return <ImageIcon className="w-5 h-5 text-zinc-400" />;
};

const FrameSlot: React.FC<{
  asset: Asset | null;
  label: string;
  subtitle: string;
  onPick: () => void;
  onRemove: () => void;
  canPick: boolean;
  incompatible?: boolean;
}> = ({ asset, label, subtitle, onPick, onRemove, canPick, incompatible = false }) => {
  if (!asset && !canPick) return null;

  if (asset) {
    return (
      <div className={`relative group h-24 rounded-xl border overflow-hidden bg-zinc-100 shadow-2xs ${incompatible ? 'border-amber-300' : 'border-zinc-200'}`}>
        <MediaThumb asset={asset} />
        {incompatible && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50/95 border border-amber-200 text-[8px] font-semibold text-amber-700 shadow-sm">
            <AlertTriangle className="w-2.5 h-2.5" /> Incompatível
          </span>
        )}
        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
          {canPick && (
            <button type="button" onClick={onPick} className="px-2 py-1 rounded-md bg-white text-zinc-800 text-[10px] font-semibold shadow-sm">
              Trocar
            </button>
          )}
          <button type="button" onClick={onRemove} className="p-1 rounded-md bg-red-600 text-white shadow-sm" title={`Remover ${label.toLowerCase()}`}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[9px] font-medium backdrop-blur-sm">
          {label}
        </span>
      </div>
    );
  }

  return (
    <button type="button" onClick={onPick} className="w-full h-24 rounded-xl border-2 border-dashed border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/30 bg-zinc-50 flex flex-col items-center justify-center gap-1 transition-all group">
      <div className="w-6 h-6 rounded-lg bg-white border border-zinc-200 group-hover:border-emerald-300 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 transition-colors">
        <Plus className="w-3.5 h-3.5" />
      </div>
      <span className="text-[11px] font-semibold text-zinc-650 group-hover:text-emerald-700">{label}</span>
      <span className="text-[9px] text-zinc-400">{subtitle}</span>
    </button>
  );
};

export const ReferenceSlots: React.FC<Props> = ({
  initialImage,
  endImage,
  references,
  onOpenPicker,
  onRemoveSlot,
  onRemoveReference,
  onConfigureReference,
  capabilities,
  resolvedMode,
  modeExplanation,
  selectionMode,
  resolvedModelName,
}) => {
  const extras = references.filter(
    (r) =>
      r.asset_id !== initialImage?.asset_id &&
      r.asset_id !== endImage?.asset_id &&
      !['START_FRAME', 'INITIAL_FRAME', 'INITIAL', 'END_FRAME', 'END'].includes(String(r.role || '').toUpperCase())
  );

  const frameModeActive = Boolean(initialImage || endImage);
  const referenceModeActive = extras.length > 0;
  const modelCanStart = Boolean(capabilities?.supports_image_reference && capabilities.supported_modes.includes('IMAGE_TO_VIDEO'));
  const modelCanEnd = Boolean(modelCanStart && capabilities?.supports_start_end_image);
  const modelCanGeneral = Boolean(
    capabilities?.supports_image_reference || capabilities?.supports_video_reference || capabilities?.supports_audio_reference
  );

  // Current upstream APIs expose first/last-frame and multimodal-reference as
  // different generation modes. Disable the opposite add path instead of letting
  // the user build a request whose references would be silently ignored.
  const canAddStart = modelCanStart && !referenceModeActive;
  const canAddEnd = modelCanEnd && !referenceModeActive;
  const canAddGeneral = modelCanGeneral && !frameModeActive;
  const showFrames = Boolean(initialImage || endImage) || canAddStart;
  const showGeneral = extras.length > 0 || canAddGeneral;

  const isAssetSupported = (asset?: Asset) => {
    if (!asset) return true;
    if (asset.type === 'IMAGE') return Boolean(capabilities?.supports_image_reference);
    if (asset.type === 'VIDEO') return Boolean(capabilities?.supports_video_reference);
    if (asset.type === 'AUDIO') return Boolean(capabilities?.supports_audio_reference);
    return false;
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Layers3 className="w-3.5 h-3.5 text-zinc-500" />
            <label className="text-xs font-semibold text-zinc-800">Mídia deste vídeo</label>
          </div>
          <p className="text-[9px] text-zinc-400 mt-0.5 leading-snug">
            Anexe aqui primeiro. Depois use <strong className="font-mono text-zinc-600">@</strong> no prompt para mencionar assets.
          </p>
        </div>
        <div title={modeExplanation} className="flex items-center gap-1 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">
          <Sparkles className="w-2.5 h-2.5" />
          {selectionMode === 'AUTO' ? 'Auto' : resolvedMode.replace(/_/g, ' ')}
        </div>
      </div>

      {selectionMode === 'AUTO' && (
        <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-2.5 py-1.5 text-[9px] text-zinc-500">
          {resolvedModelName
            ? `Rota compatível atual: ${resolvedModelName}. Ela pode mudar conforme a mídia e as configurações.`
            : 'Adicione os inputs que precisa; o sistema procura uma IA capaz de executar a combinação.'}
        </div>
      )}

      {referenceModeActive && !frameModeActive && modelCanStart && (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[9px] text-zinc-500">
          Você está em modo de referências. Remova os assets anexados para usar imagem inicial/final.
        </div>
      )}
      {frameModeActive && !referenceModeActive && modelCanGeneral && (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[9px] text-zinc-500">
          Você está em modo de primeiro/último quadro. Remova os quadros para usar referências pelo @.
        </div>
      )}

      {showFrames && (
        <div className={`grid ${canAddEnd || endImage ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          <FrameSlot
            asset={initialImage}
            label="Imagem inicial"
            subtitle={referenceModeActive ? 'Indisponível com referências' : 'Opcional'}
            onPick={() => onOpenPicker('INITIAL')}
            onRemove={() => onRemoveSlot('INITIAL')}
            canPick={canAddStart}
            incompatible={Boolean(initialImage && (!modelCanStart || referenceModeActive))}
          />
          {(canAddEnd || endImage) && (
            <FrameSlot
              asset={endImage}
              label="Imagem final"
              subtitle={referenceModeActive ? 'Indisponível com referências' : 'Opcional'}
              onPick={() => onOpenPicker('END')}
              onRemove={() => onRemoveSlot('END')}
              canPick={canAddEnd}
              incompatible={Boolean(endImage && (!modelCanEnd || referenceModeActive))}
            />
          )}
        </div>
      )}

      {showGeneral && (
        <div className="rounded-xl border border-zinc-200 bg-white p-2">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-zinc-700">Assets anexados</p>
              <p className="text-[9px] text-zinc-400">{extras.length} neste vídeo</p>
            </div>
            {canAddGeneral && (
              <button type="button" id="btn-add-media-to-video" onClick={() => onOpenPicker('GENERAL')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-semibold transition-colors shrink-0">
                <Plus className="w-3 h-3" /> Adicionar mídia
              </button>
            )}
          </div>

          {extras.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {extras.map((ref) => {
                const asset = ref.asset;
                const supported = isAssetSupported(asset) && !frameModeActive;
                return (
                  <div key={ref.asset_id} className="group relative w-[80px] shrink-0" title={asset?.name || ref.alias_snapshot}>
                    <div className={`relative h-[70px] rounded-lg overflow-hidden border bg-zinc-100 flex items-center justify-center ${supported ? 'border-zinc-200' : 'border-amber-300'}`}>
                      <MediaThumb asset={asset} />
                      {!supported && (
                        <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50/95 border border-amber-200 text-[7px] font-semibold text-amber-700">
                          <AlertTriangle className="w-2 h-2" /> incompatível
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent pt-5 pb-1 px-1.5">
                        <p className="text-[9px] text-white font-mono font-semibold truncate">@{ref.alias_snapshot}</p>
                      </div>
                      <button type="button" onClick={() => onRemoveReference(ref.asset_id)} className="absolute top-1 right-1 p-0.5 rounded bg-black/65 text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Remover deste vídeo">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1 px-0.5">
                      <span className={`text-[8px] uppercase truncate ${supported ? 'text-zinc-400' : 'text-amber-600'}`}>{asset?.type || 'IMAGE'}</span>
                      <button type="button" onClick={() => onConfigureReference(ref)} className="text-zinc-300 hover:text-zinc-600" title="Configurar referência">
                        <Sliders className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : canAddGeneral ? (
            <button type="button" onClick={() => onOpenPicker('GENERAL')} className="w-full py-3 rounded-lg border border-dashed border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/20 text-[10px] text-zinc-500 hover:text-emerald-700 transition-colors">
              + Enviar novo arquivo ou escolher da Biblioteca de Assets
            </button>
          ) : frameModeActive ? (
            <p className="py-2 text-[9px] text-zinc-500">Remova a imagem inicial/final para anexar referências multimodais.</p>
          ) : (
            <p className="py-2 text-[9px] text-amber-700">A IA selecionada não aceita novas referências. Remova itens incompatíveis ou troque de IA.</p>
          )}
        </div>
      )}
    </section>
  );
};
