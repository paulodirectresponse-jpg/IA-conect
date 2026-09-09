import React from 'react';
import {
  ModelRegistryItem,
  PricingEntry,
  WorkspaceReference,
  Asset,
  GenerationMode,
  ModelCapabilities,
} from '../../types/index.js';
import { CompactModelPicker } from './CompactModelPicker.js';
import { ReferenceSlots } from './ReferenceSlots.js';
import { PromptComposer } from './PromptComposer.js';
import { GenerationQuickSettings } from './GenerationQuickSettings.js';
import { AdvancedSettings } from './AdvancedSettings.js';
import { PriceSummary } from './PriceSummary.js';
import { Sparkles, RefreshCw } from 'lucide-react';

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
  initialImage: Asset | null;
  endImage: Asset | null;
  references: WorkspaceReference[];
  onOpenPicker: (s: 'INITIAL' | 'END' | 'GENERAL') => void;
  onRemoveSlot: (s: 'INITIAL' | 'END') => void;
  onRemoveReference: (id: string) => void;
  onConfigureReference: (r: WorkspaceReference) => void;
  resolvedMode: GenerationMode;
  modeExplanation?: string;
  prompt: string;
  onChangePrompt: (t: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (t: string) => void;
  onOpenImproveModal: () => void;
  aspectRatio: string;
  onChangeAspectRatio: (v: string) => void;
  durationSeconds: number;
  onChangeDuration: (v: number) => void;
  resolution: string;
  onChangeResolution: (v: string) => void;
  numberOfOutputs: number;
  onChangeNumberOfOutputs: (v: number) => void;
  capabilities: ModelCapabilities | null;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  seed: number | '';
  onChangeSeed: (v: number | '') => void;
  motionStrength: number;
  onChangeMotionStrength: (v: number) => void;
  totalEstimatedCostCents: number | null;
  unitPriceCents: number | null;
  availableBalanceCents: number;
  hasSufficientFunds: boolean;
  onNavigateToWallet?: () => void;
  onGenerate: () => void;
  validating: boolean;
  validationErrors: string[];
}

export const CreatorPanel: React.FC<Props> = (p) => {
  const rows = p.pricing.filter((x) => x.active && x.model_id === p.selectedModelId && (!x.resolution || x.resolution === 'ANY' || x.resolution.toLowerCase() === p.resolution.toLowerCase()));
  const totals = rows.map((x) => Math.ceil(x.customer_price_cents * (p.durationSeconds / Math.max(1, x.duration_seconds || 1)) * Math.max(1, p.numberOfOutputs)));
  const total = totals.length ? Math.min(...totals) : p.totalEstimatedCostCents;
  const unit = total == null ? null : Math.ceil(total / Math.max(1, p.numberOfOutputs));
  const enough = total == null ? p.hasSufficientFunds : p.availableBalanceCents >= total;
  const canGenerate = p.prompt.trim().length > 0 && enough && !p.validating && p.validationErrors.length === 0;
  const canUseMedia = Boolean(p.references.length || p.initialImage || p.endImage || p.capabilities?.supports_image_reference || p.capabilities?.supports_video_reference || p.capabilities?.supports_audio_reference);

  return (
    <div className="w-full md:w-[338px] lg:w-[350px] xl:w-[360px] h-full shrink-0 bg-[#0d1117] border-r border-white/[0.07] flex flex-col z-10">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        <CompactModelPicker models={p.models} pricing={p.pricing} selectionMode={p.selectionMode} selectedModelId={p.selectedModelId} autoResolvedModel={p.autoResolvedModel} onSelectAuto={p.onSelectAuto} onSelectModel={p.onSelectModel} favoriteModelIds={p.favoriteModelIds} recentModelIds={p.recentModelIds} onToggleFavorite={p.onToggleFavorite} currentResolution={p.resolution} currentDuration={p.durationSeconds} currentOutputs={p.numberOfOutputs} />
        {canUseMedia && <ReferenceSlots initialImage={p.initialImage} endImage={p.endImage} references={p.references} onOpenPicker={p.onOpenPicker} onRemoveSlot={p.onRemoveSlot} onRemoveReference={p.onRemoveReference} onConfigureReference={p.onConfigureReference} capabilities={p.capabilities} resolvedMode={p.resolvedMode} modeExplanation={p.modeExplanation} selectionMode={p.selectionMode} resolvedModelName={p.autoResolvedModel?.name} />}
        <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt={p.negativePrompt} onChangeNegativePrompt={p.onChangeNegativePrompt} onOpenImproveModal={p.onOpenImproveModal} references={p.references} onRequestAddMedia={() => p.onOpenPicker('GENERAL')} supportsNegativePrompt={p.capabilities?.supports_negative_prompt !== false} maxChars={p.capabilities?.max_prompt_length || 2000} />
        <GenerationQuickSettings aspectRatio={p.aspectRatio} onChangeAspectRatio={p.onChangeAspectRatio} durationSeconds={p.durationSeconds} onChangeDuration={p.onChangeDuration} resolution={p.resolution} onChangeResolution={p.onChangeResolution} numberOfOutputs={p.numberOfOutputs} onChangeNumberOfOutputs={p.onChangeNumberOfOutputs} capabilities={p.capabilities} />
        <AdvancedSettings isOpen={p.showAdvanced} onToggle={p.onToggleAdvanced} seed={p.seed} onChangeSeed={p.onChangeSeed} motionStrength={p.motionStrength} onChangeMotionStrength={p.onChangeMotionStrength} capabilities={p.capabilities} />
      </div>

      <div className="px-3 py-3 bg-[#0b0f15] border-t border-white/[0.06] space-y-2.5">
        <PriceSummary totalEstimatedCostCents={total} unitPriceCents={unit} numberOfOutputs={p.numberOfOutputs} availableBalanceCents={p.availableBalanceCents} hasSufficientFunds={enough} onNavigateToWallet={p.onNavigateToWallet} />
        <button type="button" id="btn-generate-video" onClick={p.onGenerate} disabled={!canGenerate} className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 hover:brightness-110 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-[0_10px_35px_rgba(124,58,237,.18)]">
          {p.validating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Validando...</> : <><Sparkles className="w-4 h-4" /> Gerar vídeo</>}
        </button>
      </div>
    </div>
  );
};
