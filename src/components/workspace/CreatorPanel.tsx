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
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface CreatorPanelProps {
  // Model
  models: ModelRegistryItem[];
  pricing: PricingEntry[];
  selectedModelId: string;
  onSelectModel: (model: ModelRegistryItem) => void;
  favoriteModelIds: string[];
  recentModelIds: string[];
  onToggleFavorite: (modelId: string) => void;

  // References & Slots
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

  // Prompt
  prompt: string;
  onChangePrompt: (text: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (text: string) => void;
  onOpenImproveModal: () => void;

  // Quick Settings
  aspectRatio: string;
  onChangeAspectRatio: (val: string) => void;
  durationSeconds: number;
  onChangeDuration: (val: number) => void;
  resolution: string;
  onChangeResolution: (val: string) => void;
  numberOfOutputs: number;
  onChangeNumberOfOutputs: (val: number) => void;
  capabilities: ModelCapabilities | null;

  // Advanced Settings
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  seed: number | '';
  onChangeSeed: (val: number | '') => void;
  motionStrength: number;
  onChangeMotionStrength: (val: number) => void;

  // Price & Wallet
  totalEstimatedCostCents: number | null;
  unitPriceCents: number | null;
  availableBalanceCents: number;
  hasSufficientFunds: boolean;
  onNavigateToWallet?: () => void;

  // Action
  onGenerate: () => void;
  validating: boolean;
  validationErrors: string[];
}

export const CreatorPanel: React.FC<CreatorPanelProps> = ({
  models,
  pricing,
  selectedModelId,
  onSelectModel,
  favoriteModelIds,
  recentModelIds,
  onToggleFavorite,
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
  prompt,
  onChangePrompt,
  negativePrompt,
  onChangeNegativePrompt,
  onOpenImproveModal,
  aspectRatio,
  onChangeAspectRatio,
  durationSeconds,
  onChangeDuration,
  resolution,
  onChangeResolution,
  numberOfOutputs,
  onChangeNumberOfOutputs,
  capabilities,
  showAdvanced,
  onToggleAdvanced,
  seed,
  onChangeSeed,
  motionStrength,
  onChangeMotionStrength,
  totalEstimatedCostCents,
  unitPriceCents,
  availableBalanceCents,
  hasSufficientFunds,
  onNavigateToWallet,
  onGenerate,
  validating,
  validationErrors,
}) => {
  const canGenerate = prompt.trim().length > 0 && hasSufficientFunds && !validating;

  return (
    <div className="w-full md:w-[350px] lg:w-[360px] xl:w-[380px] h-full shrink-0 bg-white border-r border-zinc-200 flex flex-col z-10 shadow-xs">
      {/* Scrollable controls panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. Model */}
        <CompactModelPicker
          models={models}
          pricing={pricing}
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
          favoriteModelIds={favoriteModelIds}
          recentModelIds={recentModelIds}
          onToggleFavorite={onToggleFavorite}
          currentResolution={resolution}
          currentMode={resolvedMode}
        />

        {/* 2. References */}
        <ReferenceSlots
          initialImage={initialImage}
          endImage={endImage}
          references={references}
          onOpenPicker={onOpenPicker}
          onRemoveSlot={onRemoveSlot}
          onRemoveReference={onRemoveReference}
          onConfigureReference={onConfigureReference}
          supportsEndImage={supportsEndImage}
          resolvedMode={resolvedMode}
          modeExplanation={modeExplanation}
        />

        {/* 3. Prompt */}
        <PromptComposer
          prompt={prompt}
          onChangePrompt={onChangePrompt}
          negativePrompt={negativePrompt}
          onChangeNegativePrompt={onChangeNegativePrompt}
          onOpenImproveModal={onOpenImproveModal}
          references={references}
        />

        {/* 4. Quick Settings */}
        <GenerationQuickSettings
          aspectRatio={aspectRatio}
          onChangeAspectRatio={onChangeAspectRatio}
          durationSeconds={durationSeconds}
          onChangeDuration={onChangeDuration}
          resolution={resolution}
          onChangeResolution={onChangeResolution}
          numberOfOutputs={numberOfOutputs}
          onChangeNumberOfOutputs={onChangeNumberOfOutputs}
          capabilities={capabilities}
        />

        {/* 5. Advanced Settings */}
        <AdvancedSettings
          isOpen={showAdvanced}
          onToggle={onToggleAdvanced}
          seed={seed}
          onChangeSeed={onChangeSeed}
          motionStrength={motionStrength}
          onChangeMotionStrength={onChangeMotionStrength}
        />
      </div>

      {/* Fixed bottom footer with Price & Generate */}
      <div className="p-4 bg-white border-t border-zinc-100 space-y-3">
        {/* 6. Price Summary */}
        <PriceSummary
          totalEstimatedCostCents={totalEstimatedCostCents}
          unitPriceCents={unitPriceCents}
          numberOfOutputs={numberOfOutputs}
          availableBalanceCents={availableBalanceCents}
          hasSufficientFunds={hasSufficientFunds}
          onNavigateToWallet={onNavigateToWallet}
        />

        {/* 7. Generate button */}
        <button
          type="button"
          id="btn-generate-video"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {validating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Validating parameters...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate video</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
