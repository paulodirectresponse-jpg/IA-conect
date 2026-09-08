import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceReference,
  Asset,
  PricingEntry,
} from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { useAuth } from '../../context/AuthContext.js';
import { getModelCapabilities, validateConfiguration } from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { generationIntentResolver } from '../../services/generationIntentResolver.js';

// Clean Modular Workspace subcomponents
import { CreatorPanel } from '../workspace/CreatorPanel.js';
import { ResultsCanvas } from '../workspace/ResultsCanvas.js';
import { ImprovePromptModal } from '../workspace/ImprovePromptModal.js';
import { PresetModal } from '../workspace/PresetModal.js';
import { AssetPickerModal } from '../workspace/AssetPickerModal.js';
import { GenerationRequestPreviewModal } from '../workspace/GenerationRequestPreviewModal.js';
import { ReferenceRulesModal } from '../workspace/ReferenceRulesModal.js';

export const CreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();

  // Core State
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('wan-2-1-video');

  // Input Slots
  const [initialImage, setInitialImage] = useState<Asset | null>(null);
  const [endImage, setEndImage] = useState<Asset | null>(null);

  // Prompt & References
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [references, setReferences] = useState<WorkspaceReference[]>([]);

  // Generation Settings
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [resolution, setResolution] = useState<string>('720p');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [numberOfOutputs, setNumberOfOutputs] = useState<number>(1);

  // Advanced Settings
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [seed, setSeed] = useState<number | ''>('');
  const [motionStrength, setMotionStrength] = useState<number>(5);

  // Assets & Presets
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);

  // Modals
  const [isImproveModalOpen, setIsImproveModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [pickerTargetSlot, setPickerTargetSlot] = useState<'INITIAL' | 'END' | 'GENERAL'>('GENERAL');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedRefForRules, setSelectedRefForRules] = useState<WorkspaceReference | null>(null);

  // Validation & Draft Preview State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string>('');

  // Autosave State
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autosaveTimerRef = useRef<any>(null);

  // 1. Initial Load
  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        setLoading(true);
        const [modelsRes, presetsRes, assetsRes, prefsRes, pricingRes] = await Promise.all([
          workspaceService.listModels(),
          workspaceService.listPresets(),
          assetService.listAssets(),
          workspaceService.getUserPreferences(),
          workspaceService.listPricing(),
        ]);

        if (!isMounted) return;

        setModels(modelsRes);
        setPresets(presetsRes);
        setAvailableAssets(assetsRes);
        setFavoriteModelIds(prefsRes.favorite_model_ids || []);
        setRecentModelIds(prefsRes.recent_model_ids || []);
        setPricing(pricingRes || []);

        // Try restoring latest draft
        const draft = await workspaceService.getLatestDraft().catch(() => null);
        if (draft && isMounted) {
          if (draft.model_id) setSelectedModelId(draft.model_id);
          if (draft.prompt) setPrompt(draft.prompt);
          if (draft.negative_prompt) setNegativePrompt(draft.negative_prompt);
          if (draft.references) {
            setReferences(draft.references);
            const firstImg = draft.references.find((r) => r.asset?.type === 'IMAGE');
            if (firstImg?.asset) setInitialImage(firstImg.asset);
          }
          if (draft.settings) {
            if (draft.settings.duration_seconds) setDurationSeconds(draft.settings.duration_seconds);
            if (draft.settings.resolution) setResolution(draft.settings.resolution);
            if (draft.settings.aspect_ratio) setAspectRatio(draft.settings.aspect_ratio);
            if (draft.settings.number_of_outputs) setNumberOfOutputs(draft.settings.number_of_outputs);
            if (draft.settings.seed !== undefined) setSeed(draft.settings.seed ?? '');
            if (draft.settings.motion_strength !== undefined) setMotionStrength(draft.settings.motion_strength);
          }
        } else if (modelsRes.length > 0 && isMounted) {
          setSelectedModelId(modelsRes[0].model_id);
        }
      } catch (err) {
        console.error('[CreateView] Erro ao carregar workspace:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWorkspaceData();

    return () => {
      isMounted = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // Selected Model & Capabilities
  const selectedModel = models.find((m) => m.model_id === selectedModelId) || models[0];
  const capabilities = selectedModel ? getModelCapabilities(selectedModel) : null;
  const supportsEndImage = Boolean(
    capabilities?.supports_start_end_image ||
    (capabilities?.supported_modes.includes('IMAGE_TO_VIDEO') && capabilities.max_reference_images > 1)
  );

  // Inferred Generation Mode via GenerationIntentResolver
  const resolvedIntent = useMemo(() => {
    return generationIntentResolver.resolveMode({
      model: selectedModel,
      prompt,
      references,
      initialAsset: initialImage,
      endAsset: endImage,
    });
  }, [selectedModel, prompt, references, initialImage, endImage]);

  const mode = resolvedIntent.mode;

  // Autosave Draft
  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await workspaceService.saveDraft({
          model_id: selectedModelId,
          mode,
          prompt,
          negative_prompt: negativePrompt || undefined,
          references,
          settings: {
            duration_seconds: durationSeconds,
            resolution,
            aspect_ratio: aspectRatio,
            number_of_outputs: numberOfOutputs,
            seed: typeof seed === 'number' ? seed : null,
            motion_strength: motionStrength,
          },
        });
        const now = new Date();
        setLastSavedTime(
          now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch (e) {
        // Non-blocking autosave
      }
    }, 2000);
  }, [
    selectedModelId,
    mode,
    prompt,
    negativePrompt,
    references,
    durationSeconds,
    resolution,
    aspectRatio,
    numberOfOutputs,
    seed,
    motionStrength,
  ]);

  useEffect(() => {
    if (!loading && (prompt || references.length > 0)) {
      triggerAutosave();
    }
  }, [prompt, negativePrompt, references, selectedModelId, mode, durationSeconds, resolution, aspectRatio, triggerAutosave, loading]);

  // Real-time capability validation
  useEffect(() => {
    if (!selectedModel) return;

    const validation = validateConfiguration(selectedModel, {
      mode,
      duration_seconds: durationSeconds,
      resolution,
      aspect_ratio: aspectRatio,
      references,
      negative_prompt: negativePrompt || undefined,
      promptText: prompt,
    });

    const combinedWarnings = [...validation.warnings, ...resolvedIntent.warnings];
    setValidationErrors(validation.errors);
    setValidationWarnings(combinedWarnings);

    if (capabilities) {
      if (!capabilities.supported_durations.includes(durationSeconds)) {
        setDurationSeconds(capabilities.supported_durations[0] || 5);
      }
      if (!capabilities.supported_resolutions.includes(resolution)) {
        setResolution(capabilities.supported_resolutions[0] || '720p');
      }
    }
  }, [selectedModel, mode, durationSeconds, resolution, aspectRatio, references, negativePrompt, prompt, resolvedIntent]);

  // Pricing Calculation (BRL cents)
  const matchingPricing = pricing.filter(
    (p) =>
      p.active &&
      p.model_id === selectedModelId &&
      (p.resolution === resolution || p.resolution === 'ANY' || !p.resolution) &&
      (!p.mode || p.mode === mode)
  );

  const fallbackPricing =
    matchingPricing.length === 0
      ? pricing.filter(
          (p) =>
            p.active &&
            p.model_id === selectedModelId &&
            (p.resolution === resolution || p.resolution === 'ANY' || !p.resolution)
        )
      : matchingPricing;

  const unitPriceCents: number | null =
    fallbackPricing.length > 0
      ? Math.min(...fallbackPricing.map((p) => p.customer_price_cents))
      : null;

  const totalEstimatedCostCents: number | null =
    unitPriceCents !== null ? unitPriceCents * numberOfOutputs : null;
  const availableBalanceCents = wallet?.available_balance_cents || 0;
  const hasSufficientFunds =
    totalEstimatedCostCents !== null ? availableBalanceCents >= totalEstimatedCostCents : true;

  // Reference Handlers
  const handleAddReference = (asset: Asset) => {
    if (references.some((r) => r.asset_id === asset.asset_id)) return;

    const categoryKey = (asset.category || 'PRODUCT') as keyof typeof DEFAULT_PRESERVATION_RULES;
    const defaults = DEFAULT_PRESERVATION_RULES[categoryKey] || DEFAULT_PRESERVATION_RULES.PRODUCT;

    const newRef: WorkspaceReference = {
      asset_id: asset.asset_id,
      alias_snapshot: asset.alias,
      priority: 'HIGH',
      preservation_rules: defaults.preserve,
      flexible_rules: defaults.flexible,
      asset,
    };

    setReferences((prev) => [...prev, newRef]);
  };

  const handleUpdateReference = (updated: WorkspaceReference) => {
    setReferences((prev) => prev.map((r) => (r.asset_id === updated.asset_id ? updated : r)));
  };

  const handleRemoveReference = (assetId: string) => {
    setReferences((prev) => prev.filter((r) => r.asset_id !== assetId));
    if (initialImage?.asset_id === assetId) setInitialImage(null);
    if (endImage?.asset_id === assetId) setEndImage(null);
  };

  const handleRemoveSlot = (slot: 'INITIAL' | 'END') => {
    if (slot === 'INITIAL') {
      const id = initialImage?.asset_id;
      setInitialImage(null);
      if (id) handleRemoveReference(id);
    } else {
      const id = endImage?.asset_id;
      setEndImage(null);
      if (id) handleRemoveReference(id);
    }
  };

  const handleOpenPicker = (targetSlot: 'INITIAL' | 'END' | 'GENERAL' = 'GENERAL') => {
    setPickerTargetSlot(targetSlot);
    setIsAssetPickerOpen(true);
  };

  const handleAssetPicked = (asset: Asset) => {
    if (pickerTargetSlot === 'INITIAL') {
      setInitialImage(asset);
      handleAddReference(asset);
    } else if (pickerTargetSlot === 'END') {
      setEndImage(asset);
      handleAddReference(asset);
    } else {
      handleAddReference(asset);
    }
  };

  // Model Selection
  const handleSelectModel = (model: ModelRegistryItem) => {
    setSelectedModelId(model.model_id);
    workspaceService.trackRecentModel(model.model_id, mode).then((p) => {
      setRecentModelIds(p.recent_model_ids || []);
    });
  };

  const handleToggleFavorite = async (modelId: string) => {
    const updated = await workspaceService.toggleFavoriteModel(modelId);
    setFavoriteModelIds(updated.favorite_model_ids || []);
  };

  // Preset Handlers
  const handleApplyPreset = (preset: WorkspacePreset, applyMode: 'REPLACE' | 'MERGE' = 'REPLACE') => {
    if (applyMode === 'REPLACE') {
      setPrompt(preset.prompt_template);
      if (preset.negative_prompt_template) setNegativePrompt(preset.negative_prompt_template);
    } else {
      setPrompt((prev) => (prev ? `${prev}\n${preset.prompt_template}` : preset.prompt_template));
    }

    if (preset.generation_settings) {
      if (preset.generation_settings.duration_seconds)
        setDurationSeconds(preset.generation_settings.duration_seconds);
      if (preset.generation_settings.resolution)
        setResolution(preset.generation_settings.resolution);
      if (preset.generation_settings.aspect_ratio)
        setAspectRatio(preset.generation_settings.aspect_ratio);
    }
  };

  const handleSaveCurrentAsPreset = async (presetData: {
    name: string;
    description: string;
    category: string;
  }) => {
    const created = await workspaceService.createPreset({
      ...presetData,
      prompt_template: prompt,
      negative_prompt_template: negativePrompt || undefined,
      generation_settings: {
        mode,
        duration_seconds: durationSeconds,
        resolution,
        aspect_ratio: aspectRatio,
      },
      included_asset_ids: references.map((r) => r.asset_id),
    });
    setPresets([created, ...presets]);
  };

  const handleDeletePreset = async (presetId: string) => {
    await workspaceService.deletePreset(presetId);
    setPresets(presets.filter((p) => p.preset_id !== presetId));
  };

  // Validation and Preview Trigger (Etapa 2 Compilation)
  const handleTriggerGenerate = async () => {
    if (!prompt.trim()) {
      setValidationErrors(['The prompt describing the scene is required.']);
      return;
    }

    if (validationErrors.length > 0) return;

    setValidating(true);
    try {
      const res = await workspaceService.validateAndPreview({
        model_id: selectedModelId,
        mode,
        prompt,
        negative_prompt: negativePrompt || undefined,
        references,
        settings: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          number_of_outputs: numberOfOutputs,
          seed: typeof seed === 'number' ? seed : null,
          motion_strength: motionStrength,
        },
      });

      setPreviewData(res.request_draft);
      setPreviewNotice(res.notice);
      setIsPreviewModalOpen(true);
      await refreshWallet();
    } catch (err: any) {
      setValidationErrors([err.message || 'Falha ao validar parâmetros de produção.']);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col md:flex-row overflow-hidden bg-[#F7F7F8]">
      {/* Coluna 2: Creator Panel (300px to 380px) */}
      <CreatorPanel
        models={models}
        pricing={pricing}
        selectedModelId={selectedModelId}
        onSelectModel={handleSelectModel}
        favoriteModelIds={favoriteModelIds}
        recentModelIds={recentModelIds}
        onToggleFavorite={handleToggleFavorite}
        initialImage={initialImage}
        endImage={endImage}
        references={references}
        onOpenPicker={handleOpenPicker}
        onRemoveSlot={handleRemoveSlot}
        onRemoveReference={handleRemoveReference}
        onConfigureReference={(ref) => setSelectedRefForRules(ref)}
        supportsEndImage={supportsEndImage}
        resolvedMode={mode}
        modeExplanation={resolvedIntent.explanation}
        prompt={prompt}
        onChangePrompt={setPrompt}
        negativePrompt={negativePrompt}
        onChangeNegativePrompt={setNegativePrompt}
        onOpenImproveModal={() => setIsImproveModalOpen(true)}
        aspectRatio={aspectRatio}
        onChangeAspectRatio={setAspectRatio}
        durationSeconds={durationSeconds}
        onChangeDuration={setDurationSeconds}
        resolution={resolution}
        onChangeResolution={setResolution}
        numberOfOutputs={numberOfOutputs}
        onChangeNumberOfOutputs={setNumberOfOutputs}
        capabilities={capabilities}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        seed={seed}
        onChangeSeed={setSeed}
        motionStrength={motionStrength}
        onChangeMotionStrength={setMotionStrength}
        totalEstimatedCostCents={totalEstimatedCostCents}
        unitPriceCents={unitPriceCents}
        availableBalanceCents={availableBalanceCents}
        hasSufficientFunds={hasSufficientFunds}
        onNavigateToWallet={() => {
          // Can be routed via navbar / global event
          window.location.hash = '#wallet';
        }}
        onGenerate={handleTriggerGenerate}
        validating={validating}
        validationErrors={validationErrors}
      />

      {/* Coluna 3: Results Area / Canvas */}
      <ResultsCanvas
        lastSavedTime={lastSavedTime}
        validating={validating}
        validationErrors={validationErrors}
        validationWarnings={validationWarnings}
        onOpenPresets={() => setIsPresetModalOpen(true)}
        presets={presets}
        onApplyPreset={(p) => handleApplyPreset(p, 'REPLACE')}
        prompt={prompt}
        hasReferences={references.length > 0}
      />

      {/* Modals */}
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        availableAssets={availableAssets}
        onSelectAsset={handleAssetPicked}
        onAssetUploaded={(newAsset) => {
          setAvailableAssets((prev) => [newAsset, ...prev]);
        }}
        attachedAssetIds={references.map((r) => r.asset_id)}
        title={
          pickerTargetSlot === 'INITIAL'
            ? 'Select start frame'
            : pickerTargetSlot === 'END'
            ? 'Select end frame'
            : 'Add reference asset'
        }
      />

      <ImprovePromptModal
        isOpen={isImproveModalOpen}
        onClose={() => setIsImproveModalOpen(false)}
        originalPrompt={prompt}
        onApplyImproved={(improved) => setPrompt(improved)}
        modelName={selectedModel?.name}
        references={references.map((r) => ({
          alias: r.alias_snapshot,
          type: r.asset?.type,
          category: r.asset?.category,
        }))}
      />

      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onApplyPreset={handleApplyPreset}
        onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
        onDeletePreset={handleDeletePreset}
        currentHasContent={Boolean(prompt.trim() || references.length > 0)}
      />

      {selectedRefForRules && (
        <ReferenceRulesModal
          reference={selectedRefForRules}
          isOpen={Boolean(selectedRefForRules)}
          onClose={() => setSelectedRefForRules(null)}
          onSave={handleUpdateReference}
        />
      )}

      <GenerationRequestPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        draftData={previewData}
        notice={previewNotice}
        onNavigateToWallet={() => {
          setIsPreviewModalOpen(false);
          window.location.hash = '#wallet';
        }}
      />
    </div>
  );
};
