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

        const activeModels = modelsRes.filter((m) => m.status !== 'INACTIVE' && m.category === 'VIDEO');
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
    return [...autoCompatibleModels].sort((a, b) => {
      const aPrice = estimateModelPrice(a.model_id) ?? Number.MAX_SAFE_INTEGER;
      const bPrice = estimateModelPrice(b.model_id) ?? Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice || a.name.localeCompare(b.name);
    })[0] || null;
  }, [autoCompatibleModels, estimateModelPrice]);

  const selectedModel = selectionMode === 'AUTO' ? autoResolvedModel : manualModel;
  const activeCapabilities = useMemo(
    () => selectionMode === 'AUTO' ? (autoResolvedModel ? getModelCapabilities(autoResolvedModel) : autoCapabilities) : getModelCapabilities(manualModel),
    [selectionMode, autoResolvedModel, autoCapabilities, manualModel]
  );

  useEffect(() => {
    const durations = activeCapabilities.supported_durations;
    if (durations.length && !durations.includes(durationSeconds)) setDurationSeconds(durations[0]);
    const resolutions = activeCapabilities.supported_resolutions;
    if (resolutions.length && !resolutions.includes(resolution)) setResolution(resolutions[0]);
    const ratios = activeCapabilities.supported_aspect_ratios;
    if (ratios.length && !ratios.includes(aspectRatio)) setAspectRatio(ratios[0]);
  }, [activeCapabilities, durationSeconds, resolution, aspectRatio]);

  const refsWithFrames = useMemo(() => {
    const output = references.filter((r) => !['START_FRAME', 'INITIAL_FRAME', 'END_FRAME'].includes(String(r.role || '').toUpperCase()));
    const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
    if (initialImage) output.unshift({ asset_id: initialImage.asset_id, alias_snapshot: 'start_frame', role: 'START_FRAME', priority: 'HIGH', preservation_rules: defaults.preserve, flexible_rules: defaults.flexible, asset: initialImage });
    if (endImage) output.unshift({ asset_id: endImage.asset_id, alias_snapshot: 'end_frame', role: 'END_FRAME', priority: 'HIGH', preservation_rules: defaults.preserve, flexible_rules: defaults.flexible, asset: endImage });
    return output;
  }, [references, initialImage, endImage]);

  const compatibility = useMemo(
    () => validateConfiguration(selectedModel, {
      mode,
      duration_seconds: durationSeconds,
      resolution,
      aspect_ratio: aspectRatio,
      references: refsWithFrames,
      negative_prompt: negativePrompt,
      promptText: prompt,
      has_start_image: Boolean(initialImage),
      has_end_image: Boolean(endImage),
    }),
    [selectedModel, mode, durationSeconds, resolution, aspectRatio, refsWithFrames, negativePrompt, prompt, initialImage, endImage]
  );

  useEffect(() => {
    setValidationErrors(compatibility.errors);
    setValidationWarnings(compatibility.warnings);
  }, [compatibility]);

  const totalEstimatedCostCents = selectedModel ? estimateModelPrice(selectedModel.model_id) : null;
  const availableBalanceCents = wallet?.available_balance_cents || 0;
  const hasSufficientFunds = totalEstimatedCostCents == null ? true : availableBalanceCents >= totalEstimatedCostCents;

  const removeAliasFromPrompt = (alias?: string) => {
    if (!alias) return;
    const pattern = new RegExp(`@${escapeRegex(alias)}\\b\\s*`, 'g');
    setPrompt((prev) => prev.replace(pattern, '').replace(/[ \t]{2,}/g, ' '));
  };

  const addGeneralAsset = (asset: Asset) => {
    setReferences((prev) => {
      if (prev.some((r) => r.asset_id === asset.asset_id)) return prev;
      const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
      const alias = localAliasFor(asset, prev);
      return [...prev, {
        asset_id: asset.asset_id,
        alias_snapshot: alias,
        role: 'GENERAL',
        priority: 'HIGH',
        preservation_rules: defaults.preserve,
        flexible_rules: defaults.flexible,
        asset,
      }];
    });
  };

  const handleAssetPicked = (asset: Asset) => {
    if (pickerTargetSlot === 'INITIAL') {
      setInitialImage(asset);
      if (endImage?.asset_id === asset.asset_id) setEndImage(null);
    } else if (pickerTargetSlot === 'END') {
      setEndImage(asset);
      if (initialImage?.asset_id === asset.asset_id) setInitialImage(null);
    } else {
      addGeneralAsset(asset);
    }
  };

  const handleRemoveReference = (assetId: string) => {
    const ref = references.find((r) => r.asset_id === assetId);
    if (ref) removeAliasFromPrompt(ref.alias_snapshot);
    setReferences((prev) => prev.filter((r) => r.asset_id !== assetId));
  };

  const openPicker = (slot: 'INITIAL' | 'END' | 'GENERAL') => {
    setPickerTargetSlot(slot);
    setIsAssetPickerOpen(true);
  };

  const filteredPickerAssets = useMemo(() => {
    const targetType: AssetType | undefined = pickerTargetSlot === 'INITIAL' || pickerTargetSlot === 'END' ? 'IMAGE' : undefined;
    return targetType ? availableAssets.filter((a) => a.type === targetType) : availableAssets;
  }, [availableAssets, pickerTargetSlot]);

  const allowedPickerTypes = useMemo<AssetType[]>(() => {
    if (pickerTargetSlot === 'INITIAL' || pickerTargetSlot === 'END') return ['IMAGE'];
    const allowed: AssetType[] = [];
    if (activeCapabilities.supports_image_reference) allowed.push('IMAGE');
    if (activeCapabilities.supports_video_reference) allowed.push('VIDEO');
    if (activeCapabilities.supports_audio_reference) allowed.push('AUDIO');
    return allowed.length ? allowed : ['IMAGE'];
  }, [pickerTargetSlot, activeCapabilities]);

  const handleToggleFavorite = async (id: string) => {
    const prefs = await workspaceService.toggleFavoriteModel(id);
    setFavoriteModelIds(prefs.favorite_model_ids || []);
  };

  const handleSelectModel = async (model: ModelRegistryItem) => {
    setSelectionMode('MANUAL');
    setManualModelId(model.model_id);
    const prefs = await workspaceService.trackRecentModel(model.model_id, mode).catch(() => null);
    if (prefs) setRecentModelIds(prefs.recent_model_ids || []);
  };

  const persistDraft = useCallback(async () => {
    try {
      await workspaceService.saveDraft({
        model_id: selectionMode === 'AUTO' ? 'AUTO' : manualModelId,
        mode,
        prompt,
        negative_prompt: negativePrompt,
        references: refsWithFrames,
        settings: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          number_of_outputs: numberOfOutputs,
          seed: seed === '' ? null : seed,
          motion_strength: motionStrength,
        },
      });
      setLastSavedTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {}
  }, [selectionMode, manualModelId, mode, prompt, negativePrompt, refsWithFrames, durationSeconds, resolution, aspectRatio, numberOfOutputs, seed, motionStrength]);

  useEffect(() => {
    if (loading) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(persistDraft, 700);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [loading, persistDraft]);

  const handlePreview = async () => {
    if (!selectedModel || validationErrors.length) return;
    setValidating(true);
    try {
      const result = await workspaceService.validateAndPreview({
        model_id: selectedModel.model_id,
        mode,
        prompt,
        negative_prompt: negativePrompt,
        references: refsWithFrames,
        settings: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          number_of_outputs: numberOfOutputs,
          seed: seed === '' ? null : seed,
          motion_strength: motionStrength,
        },
      });
      setPreviewData(result.request_draft);
      setPreviewNotice(result.notice);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      setValidationErrors([err?.message || 'Não foi possível validar esta geração.']);
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return <div className="flex-1 h-full grid place-items-center bg-[#0b0e13]"><div className="flex items-center gap-2 text-[10px] text-zinc-600"><Loader2 className="w-4 h-4 animate-spin text-violet-400"/> Preparando studio...</div></div>;
  }

  return (
    <div className="flex h-full min-h-0 bg-[#0b0e13]">
      <CreatorPanel
        models={models}
        pricing={pricing}
        selectionMode={selectionMode}
        selectedModelId={selectionMode === 'AUTO' ? autoResolvedModel?.model_id || '' : manualModelId}
        autoResolvedModel={autoResolvedModel}
        onSelectAuto={() => setSelectionMode('AUTO')}
        onSelectModel={handleSelectModel}
        favoriteModelIds={favoriteModelIds}
        recentModelIds={recentModelIds}
        onToggleFavorite={handleToggleFavorite}
        initialImage={initialImage}
        endImage={endImage}
        references={references}
        onOpenPicker={openPicker}
        onRemoveSlot={(slot) => slot === 'INITIAL' ? setInitialImage(null) : setEndImage(null)}
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
        capabilities={activeCapabilities}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        seed={seed}
        onChangeSeed={setSeed}
        motionStrength={motionStrength}
        onChangeMotionStrength={setMotionStrength}
        totalEstimatedCostCents={totalEstimatedCostCents}
        unitPriceCents={numberOfOutputs > 0 && totalEstimatedCostCents != null ? Math.ceil(totalEstimatedCostCents / numberOfOutputs) : null}
        availableBalanceCents={availableBalanceCents}
        hasSufficientFunds={hasSufficientFunds}
        onGenerate={handlePreview}
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
        onApplyPreset={() => {}}
        prompt={prompt}
        hasReferences={Boolean(refsWithFrames.length)}
      />

      <ImprovePromptModal
        isOpen={isImproveModalOpen}
        onClose={() => setIsImproveModalOpen(false)}
        prompt={prompt}
        references={references}
        modelName={selectedModel?.name}
        onApply={setPrompt}
      />
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onApply={(preset) => {
          setPrompt(preset.prompt_template || '');
          setNegativePrompt(preset.negative_prompt_template || '');
          if (preset.generation_settings) {
            setDurationSeconds(preset.generation_settings.duration_seconds || durationSeconds);
            setResolution(preset.generation_settings.resolution || resolution);
            setAspectRatio(preset.generation_settings.aspect_ratio || aspectRatio);
          }
          setIsPresetModalOpen(false);
        }}
        onDelete={async (id) => { await workspaceService.deletePreset(id); setPresets((prev) => prev.filter((p) => p.preset_id !== id)); }}
      />
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        availableAssets={filteredPickerAssets}
        onSelectAsset={handleAssetPicked}
        onAssetUploaded={(asset) => setAvailableAssets((prev) => [asset, ...prev.filter((item) => item.asset_id !== asset.asset_id)])}
        attachedAssetIds={refsWithFrames.map((r) => r.asset_id)}
        title={pickerTargetSlot === 'INITIAL' ? 'Selecionar imagem inicial' : pickerTargetSlot === 'END' ? 'Selecionar imagem final' : 'Adicionar mídia ao vídeo'}
        subtitle={pickerTargetSlot === 'GENERAL' ? 'Upload rápido ou Biblioteca. Depois use @ no prompt para citar as referências.' : 'Escolha uma imagem da Biblioteca ou envie uma nova.'}
        defaultTab="LIBRARY"
        allowedTypes={allowedPickerTypes}
      />
      <GenerationRequestPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        requestDraft={previewData}
        notice={previewNotice}
        onConfirmed={async () => { setIsPreviewModalOpen(false); await refreshWallet(); }}
      />
      <ReferenceRulesModal isOpen={Boolean(selectedRefForRules)} onClose={() => setSelectedRefForRules(null)} reference={selectedRefForRules} onApply={(next) => setReferences((prev) => prev.map((r) => r.asset_id === next.asset_id ? next : r))} />
    </div>
  );
};
