import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceReference,
  Asset,
  AssetType,
  PricingEntry,
} from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  findCompatibleModels,
  getModelCapabilities,
  mergeModelCapabilities,
  validateConfiguration,
} from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { generationIntentResolver } from '../../services/generationIntentResolver.js';
import { CreatorPanel } from '../workspace/CreatorPanel.js';
import { ResultsCanvas } from '../workspace/ResultsCanvas.js';
import { ImprovePromptModal } from '../workspace/ImprovePromptModal.js';
import { PresetModal } from '../workspace/PresetModal.js';
import { AssetPickerModal } from '../workspace/AssetPickerModal.js';
import { GenerationRequestPreviewModal } from '../workspace/GenerationRequestPreviewModal.js';
import { ReferenceRulesModal } from '../workspace/ReferenceRulesModal.js';
import { Loader2 } from 'lucide-react';

const unique = (values: string[]) => Array.from(new Set(values));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function localAliasFor(asset: Asset, refs: WorkspaceReference[]) {
  const prefix = asset.type === 'VIDEO' ? 'video' : asset.type === 'AUDIO' ? 'audio' : 'img';
  const used = new Set(refs.map((r) => r.alias_snapshot.toLowerCase()));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export const CreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();

  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [selectionMode, setSelectionMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualModelId, setManualModelId] = useState('');

  const [initialImage, setInitialImage] = useState<Asset | null>(null);
  const [endImage, setEndImage] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [references, setReferences] = useState<WorkspaceReference[]>([]);

  const [durationSeconds, setDurationSeconds] = useState(5);
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [numberOfOutputs, setNumberOfOutputs] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState<number | ''>('');
  const [motionStrength, setMotionStrength] = useState(5);

  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);

  const [isImproveModalOpen, setIsImproveModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [pickerTargetSlot, setPickerTargetSlot] = useState<'INITIAL' | 'END' | 'GENERAL'>('GENERAL');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedRefForRules, setSelectedRefForRules] = useState<WorkspaceReference | null>(null);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewNotice, setPreviewNotice] = useState('');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autosaveTimerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [modelsRes, presetsRes, assetsRes, prefsRes, pricingRes] = await Promise.all([
          workspaceService.listModels(),
          workspaceService.listPresets(),
          assetService.listAssets(),
          workspaceService.getUserPreferences(),
          workspaceService.listPricing(),
        ]);
        if (!mounted) return;

        const activeModels = modelsRes.filter((m) => m.status !== 'INACTIVE');
        setModels(activeModels);
        setPresets(presetsRes);
        setAvailableAssets(assetsRes);
        setFavoriteModelIds(prefsRes.favorite_model_ids || []);
        setRecentModelIds(prefsRes.recent_model_ids || []);
        setPricing(pricingRes || []);
        setManualModelId(activeModels[0]?.model_id || '');

        const draft = await workspaceService.getLatestDraft().catch(() => null);
        if (!draft || !mounted) return;

        if (draft.model_id === 'AUTO') {
          setSelectionMode('AUTO');
        } else if (draft.model_id && activeModels.some((m) => m.model_id === draft.model_id)) {
          setSelectionMode('MANUAL');
          setManualModelId(draft.model_id);
        }

        setPrompt(draft.prompt || '');
        setNegativePrompt(draft.negative_prompt || '');
        const draftRefs = draft.references || [];
        setReferences(draftRefs);

        const start = draftRefs.find((r) => ['START_FRAME', 'INITIAL_FRAME'].includes(String(r.role || '').toUpperCase()));
        const end = draftRefs.find((r) => String(r.role || '').toUpperCase() === 'END_FRAME');
        if (start?.asset) setInitialImage(start.asset);
        if (end?.asset) setEndImage(end.asset);
        if (!start?.asset && draft.mode === 'IMAGE_TO_VIDEO') {
          const firstImage = draftRefs.find((r) => r.asset?.type === 'IMAGE');
          if (firstImage?.asset) setInitialImage(firstImage.asset);
        }

        if (draft.settings) {
          setDurationSeconds(draft.settings.duration_seconds || 5);
          setResolution(draft.settings.resolution || '720p');
          setAspectRatio(draft.settings.aspect_ratio || '16:9');
          setNumberOfOutputs(draft.settings.number_of_outputs || 1);
          setSeed(draft.settings.seed ?? '');
          setMotionStrength(draft.settings.motion_strength ?? 5);
        }
      } catch (err) {
        console.error('[CreateView] Erro ao carregar workspace:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const manualModel = useMemo(
    () => models.find((m) => m.model_id === manualModelId) || models[0] || null,
    [models, manualModelId]
  );

  const autoCapabilities = useMemo(() => mergeModelCapabilities(models), [models]);

  const inferredIntent = useMemo(
    () =>
      generationIntentResolver.resolveMode({
        model: selectionMode === 'MANUAL' ? manualModel : undefined,
        prompt,
        references,
        initialAsset: initialImage,
        endAsset: endImage,
      }),
    [selectionMode, manualModel, prompt, references, initialImage, endImage]
  );
  const mode = inferredIntent.mode;

  const counts = useMemo(() => {
    const result = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
    for (const ref of references) {
      const type = ref.asset?.type || 'IMAGE';
      result[type] += 1;
    }
    return result;
  }, [references]);

  const estimateModelPrice = useCallback(
    (modelId: string) => {
      const rows = pricing.filter(
        (p) =>
          p.active &&
          p.model_id === modelId &&
          (!p.resolution || p.resolution === 'ANY' || p.resolution.toLowerCase() === resolution.toLowerCase()) &&
          (!p.mode || p.mode === mode)
      );
      const fallback = rows.length
        ? rows
        : pricing.filter(
            (p) =>
              p.active &&
              p.model_id === modelId &&
              (!p.resolution || p.resolution === 'ANY' || p.resolution.toLowerCase() === resolution.toLowerCase())
          );
      if (!fallback.length) return null;
      return Math.min(
        ...fallback.map((p) =>
          Math.ceil(
            p.customer_price_cents *
              (durationSeconds / Math.max(1, p.duration_seconds || 1)) *
              Math.max(1, numberOfOutputs)
          )
        )
      );
    },
    [pricing, resolution, mode, durationSeconds, numberOfOutputs]
  );

  const autoCompatibleModels = useMemo(
    () =>
      findCompatibleModels(models, {
        mode,
        imageCount: counts.IMAGE,
        videoCount: counts.VIDEO,
        audioCount: counts.AUDIO,
        hasStartImage: Boolean(initialImage),
        hasEndImage: Boolean(endImage),
        desiredResolution: resolution,
        desiredDuration: durationSeconds,
        desiredAspectRatio: aspectRatio,
        promptLength: prompt.length,
        usesNegativePrompt: Boolean(negativePrompt.trim()),
      }),
    [models, mode, counts, initialImage, endImage, resolution, durationSeconds, aspectRatio, prompt.length, negativePrompt]
  );

  const autoResolvedModel = useMemo(() => {
    if (!autoCompatibleModels.length) return null;
    const withCost = autoCompatibleModels
      .map((model) => ({ model, price: estimateModelPrice(model.model_id) }))
      .sort((a, b) => {
        const ap = a.price ?? Number.MAX_SAFE_INTEGER;
        const bp = b.price ?? Number.MAX_SAFE_INTEGER;
        return ap - bp || a.model.name.localeCompare(b.model.name);
      });
    return withCost[0]?.model || null;
  }, [autoCompatibleModels, estimateModelPrice]);

  const activeModel = selectionMode === 'AUTO' ? autoResolvedModel : manualModel;
  const uiCapabilities = selectionMode === 'AUTO' ? autoCapabilities : getModelCapabilities(activeModel);
  const activeModelId = activeModel?.model_id || manualModel?.model_id || '';

  useEffect(() => {
    if (loading || selectionMode !== 'MANUAL' || !manualModel) return;
    const caps = getModelCapabilities(manualModel);
    if (!caps.supported_durations.includes(durationSeconds)) setDurationSeconds(caps.supported_durations[0] || 5);
    if (!caps.supported_resolutions.includes(resolution)) setResolution(caps.supported_resolutions[0] || '720p');
    if (!caps.supported_aspect_ratios.includes(aspectRatio)) {
      setAspectRatio(
        (manualModel.recommended_aspect_ratio && caps.supported_aspect_ratios.includes(manualModel.recommended_aspect_ratio)
          ? manualModel.recommended_aspect_ratio
          : caps.supported_aspect_ratios[0]) || '16:9'
      );
    }
  }, [loading, selectionMode, manualModel, durationSeconds, resolution, aspectRatio]);

  useEffect(() => {
    if (!uiCapabilities.supports_negative_prompt && negativePrompt) setNegativePrompt('');
    if (!uiCapabilities.supports_seed && seed !== '') setSeed('');
  }, [uiCapabilities.supports_negative_prompt, uiCapabilities.supports_seed]);

  useEffect(() => {
    if (loading) return;
    if (selectionMode === 'AUTO' && !autoResolvedModel) {
      setValidationErrors([
        'Nenhuma IA disponível atende esta combinação de mídia, duração, resolução e proporção. Ajuste um dos inputs para continuar.',
      ]);
      setValidationWarnings([]);
      return;
    }
    if (!activeModel) return;

    const validation = validateConfiguration(activeModel, {
      mode,
      duration_seconds: durationSeconds,
      resolution,
      aspect_ratio: aspectRatio,
      references,
      negative_prompt: negativePrompt || undefined,
      promptText: prompt,
      has_start_image: Boolean(initialImage),
      has_end_image: Boolean(endImage),
    });
    setValidationErrors(unique([...validation.errors, ...inferredIntent.errors]));
    setValidationWarnings(unique([...validation.warnings, ...inferredIntent.warnings]));
  }, [
    loading,
    selectionMode,
    autoResolvedModel,
    activeModel,
    mode,
    durationSeconds,
    resolution,
    aspectRatio,
    references,
    negativePrompt,
    prompt,
    initialImage,
    endImage,
    inferredIntent,
  ]);

  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await workspaceService.saveDraft({
          model_id: selectionMode === 'AUTO' ? 'AUTO' : manualModelId,
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
            motion_strength: uiCapabilities.supports_motion_strength ? motionStrength : undefined,
          },
        });
        setLastSavedTime(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch {
        // Draft autosave must never block creation.
      }
    }, 1200);
  }, [
    selectionMode,
    manualModelId,
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
    uiCapabilities.supports_motion_strength,
  ]);

  useEffect(() => {
    if (!loading && (prompt || references.length > 0)) triggerAutosave();
  }, [
    loading,
    prompt,
    negativePrompt,
    references,
    selectionMode,
    manualModelId,
    durationSeconds,
    resolution,
    aspectRatio,
    numberOfOutputs,
    triggerAutosave,
  ]);

  const totalEstimatedCostCents = activeModel ? estimateModelPrice(activeModel.model_id) : null;
  const unitPriceCents =
    totalEstimatedCostCents == null ? null : Math.ceil(totalEstimatedCostCents / Math.max(1, numberOfOutputs));
  const availableBalanceCents = wallet?.available_balance_cents || 0;
  const hasSufficientFunds =
    totalEstimatedCostCents == null ? true : availableBalanceCents >= totalEstimatedCostCents;

  const addOrUpdateReference = (asset: Asset, role: 'GENERAL' | 'START_FRAME' | 'END_FRAME' = 'GENERAL') => {
    setReferences((prev) => {
      const existing = prev.find((r) => r.asset_id === asset.asset_id);
      if (existing) {
        if (role === 'GENERAL') return prev;
        return prev.map((r) => (r.asset_id === asset.asset_id ? { ...r, role, asset } : r));
      }

      const categoryKey = (asset.category || 'GENERIC') as keyof typeof DEFAULT_PRESERVATION_RULES;
      const defaults = DEFAULT_PRESERVATION_RULES[categoryKey] || DEFAULT_PRESERVATION_RULES.GENERIC;
      const newRef: WorkspaceReference = {
        asset_id: asset.asset_id,
        alias_snapshot: localAliasFor(asset, prev),
        role,
        priority: 'HIGH',
        preservation_rules: defaults.preserve,
        flexible_rules: defaults.flexible,
        asset,
      };
      return [...prev, newRef];
    });
  };

  const handleUpdateReference = (updated: WorkspaceReference) => {
    setReferences((prev) => prev.map((r) => (r.asset_id === updated.asset_id ? updated : r)));
  };

  const handleRemoveReference = (assetId: string) => {
    const existing = references.find((r) => r.asset_id === assetId);
    setReferences((prev) => prev.filter((r) => r.asset_id !== assetId));
    if (initialImage?.asset_id === assetId) setInitialImage(null);
    if (endImage?.asset_id === assetId) setEndImage(null);
    if (existing?.alias_snapshot) {
      const token = new RegExp(`@${escapeRegex(existing.alias_snapshot)}\\b\\s*`, 'g');
      setPrompt((prev) => prev.replace(token, '').replace(/[ \t]{2,}/g, ' '));
    }
  };

  const handleRemoveSlot = (slot: 'INITIAL' | 'END') => {
    const asset = slot === 'INITIAL' ? initialImage : endImage;
    if (asset) handleRemoveReference(asset.asset_id);
    else if (slot === 'INITIAL') setInitialImage(null);
    else setEndImage(null);
  };

  const handleOpenPicker = (targetSlot: 'INITIAL' | 'END' | 'GENERAL' = 'GENERAL') => {
    setPickerTargetSlot(targetSlot);
    setIsAssetPickerOpen(true);
  };

  const handleAssetPicked = (asset: Asset) => {
    if (pickerTargetSlot === 'INITIAL') {
      if (initialImage && initialImage.asset_id !== asset.asset_id) handleRemoveReference(initialImage.asset_id);
      setInitialImage(asset);
      addOrUpdateReference(asset, 'START_FRAME');
    } else if (pickerTargetSlot === 'END') {
      if (endImage && endImage.asset_id !== asset.asset_id) handleRemoveReference(endImage.asset_id);
      setEndImage(asset);
      addOrUpdateReference(asset, 'END_FRAME');
    } else {
      addOrUpdateReference(asset, 'GENERAL');
    }
  };

  const handleSelectModel = (model: ModelRegistryItem) => {
    setSelectionMode('MANUAL');
    setManualModelId(model.model_id);
    workspaceService.trackRecentModel(model.model_id, mode).then((prefs) => {
      setRecentModelIds(prefs.recent_model_ids || []);
    });
  };

  const handleSelectAuto = () => setSelectionMode('AUTO');

  const handleToggleFavorite = async (modelId: string) => {
    const updated = await workspaceService.toggleFavoriteModel(modelId);
    setFavoriteModelIds(updated.favorite_model_ids || []);
  };

  const handleApplyPreset = (preset: WorkspacePreset, applyMode: 'REPLACE' | 'MERGE' = 'REPLACE') => {
    setPrompt((prev) =>
      applyMode === 'REPLACE' ? preset.prompt_template : prev ? `${prev}\n${preset.prompt_template}` : preset.prompt_template
    );
    if (applyMode === 'REPLACE') setNegativePrompt(preset.negative_prompt_template || '');
    if (preset.generation_settings?.model_id && models.some((m) => m.model_id === preset.generation_settings.model_id)) {
      setSelectionMode('MANUAL');
      setManualModelId(preset.generation_settings.model_id);
    }
    if (preset.generation_settings?.duration_seconds) setDurationSeconds(preset.generation_settings.duration_seconds);
    if (preset.generation_settings?.resolution) setResolution(preset.generation_settings.resolution);
    if (preset.generation_settings?.aspect_ratio) setAspectRatio(preset.generation_settings.aspect_ratio);
  };

  const handleSaveCurrentAsPreset = async (presetData: { name: string; description: string; category: string }) => {
    const created = await workspaceService.createPreset({
      ...presetData,
      prompt_template: prompt,
      negative_prompt_template: negativePrompt || undefined,
      generation_settings: {
        model_id: selectionMode === 'MANUAL' ? manualModelId : undefined,
        mode,
        duration_seconds: durationSeconds,
        resolution,
        aspect_ratio: aspectRatio,
      },
      included_asset_ids: references.map((r) => r.asset_id),
    });
    setPresets((prev) => [created, ...prev]);
  };

  const handleDeletePreset = async (presetId: string) => {
    await workspaceService.deletePreset(presetId);
    setPresets((prev) => prev.filter((p) => p.preset_id !== presetId));
  };

  const handleTriggerGenerate = async () => {
    if (!prompt.trim()) {
      setValidationErrors(['Descreva o vídeo antes de gerar.']);
      return;
    }
    if (!activeModel) {
      setValidationErrors(['O modo Auto não encontrou uma IA compatível com esta combinação.']);
      return;
    }
    if (validationErrors.length > 0) return;

    setValidating(true);
    try {
      const res = await workspaceService.validateAndPreview({
        model_id: activeModel.model_id,
        mode,
        prompt,
        negative_prompt: uiCapabilities.supports_negative_prompt ? negativePrompt || undefined : undefined,
        references,
        settings: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          number_of_outputs: numberOfOutputs,
          seed: uiCapabilities.supports_seed && typeof seed === 'number' ? seed : null,
          motion_strength: uiCapabilities.supports_motion_strength ? motionStrength : undefined,
        },
      });
      setPreviewData(res.request_draft);
      setPreviewNotice(
        selectionMode === 'AUTO'
          ? `Auto selecionou ${activeModel.name} para este pedido. ${res.notice}`
          : res.notice
      );
      setIsPreviewModalOpen(true);
      await refreshWallet();
    } catch (err: any) {
      setValidationErrors([err.message || 'Falha ao validar os parâmetros da geração.']);
    } finally {
      setValidating(false);
    }
  };

  const allowedPickerTypes: AssetType[] = useMemo(() => {
    if (pickerTargetSlot !== 'GENERAL') return ['IMAGE'];
    const types: AssetType[] = [];
    if (uiCapabilities.supports_image_reference) types.push('IMAGE');
    if (uiCapabilities.supports_video_reference) types.push('VIDEO');
    if (uiCapabilities.supports_audio_reference) types.push('AUDIO');
    return types;
  }, [pickerTargetSlot, uiCapabilities]);

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-[#F7F7F8] text-zinc-500">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparando o estúdio...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col md:flex-row overflow-hidden bg-[#F7F7F8]">
      <CreatorPanel
        models={models}
        pricing={pricing}
        selectionMode={selectionMode}
        selectedModelId={activeModelId}
        autoResolvedModel={autoResolvedModel}
        onSelectAuto={handleSelectAuto}
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
        onConfigureReference={setSelectedRefForRules}
        resolvedMode={mode}
        modeExplanation={inferredIntent.explanation}
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
        capabilities={uiCapabilities}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        seed={seed}
        onChangeSeed={setSeed}
        motionStrength={motionStrength}
        onChangeMotionStrength={setMotionStrength}
        totalEstimatedCostCents={totalEstimatedCostCents}
        unitPriceCents={unitPriceCents}
        availableBalanceCents={availableBalanceCents}
        hasSufficientFunds={hasSufficientFunds}
        onNavigateToWallet={() => {
          window.location.hash = '#wallet';
        }}
        onGenerate={handleTriggerGenerate}
        validating={validating}
        validationErrors={validationErrors}
      />

      <ResultsCanvas
        lastSavedTime={lastSavedTime}
        validating={validating}
        validationErrors={validationErrors}
        validationWarnings={validationWarnings}
        onOpenPresets={() => setIsPresetModalOpen(true)}
        presets={presets}
        onApplyPreset={(preset) => handleApplyPreset(preset, 'REPLACE')}
        prompt={prompt}
        hasReferences={references.length > 0}
      />

      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        availableAssets={availableAssets}
        onSelectAsset={handleAssetPicked}
        onAssetUploaded={(newAsset) => setAvailableAssets((prev) => [newAsset, ...prev])}
        attachedAssetIds={pickerTargetSlot === 'GENERAL' ? references.map((r) => r.asset_id) : []}
        allowedTypes={allowedPickerTypes}
        defaultTab="UPLOAD"
        title={
          pickerTargetSlot === 'INITIAL'
            ? 'Adicionar imagem inicial'
            : pickerTargetSlot === 'END'
              ? 'Adicionar imagem final'
              : 'Adicionar mídia ao vídeo'
        }
        subtitle={
          pickerTargetSlot === 'GENERAL'
            ? 'O arquivo entra neste vídeo imediatamente e depois fica disponível pelo @ no prompt.'
            : 'Envie uma nova imagem ou escolha uma existente na sua Biblioteca de Assets.'
        }
      />

      <ImprovePromptModal
        isOpen={isImproveModalOpen}
        onClose={() => setIsImproveModalOpen(false)}
        originalPrompt={prompt}
        onApplyImproved={setPrompt}
        modelName={selectionMode === 'AUTO' ? 'Auto' : activeModel?.name}
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
