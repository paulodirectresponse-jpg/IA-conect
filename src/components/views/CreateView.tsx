import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceDraft,
  WorkspaceReference,
  Asset,
  GenerationMode,
  PricingEntry,
  GenerationRequestDraft,
} from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { useAuth } from '../../context/AuthContext.js';
import { getModelCapabilities, validateConfiguration } from '../../services/modelCapabilities.js';
import { formatCentsToBRL, DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';

// Workspace subcomponents
import { PromptEditor } from '../workspace/PromptEditor.js';
import { WorkspaceReferencesList } from '../workspace/WorkspaceReferencesList.js';
import { ModelSelector } from '../workspace/ModelSelector.js';
import { ImprovePromptModal } from '../workspace/ImprovePromptModal.js';
import { PresetModal } from '../workspace/PresetModal.js';
import { AssetPickerModal } from '../workspace/AssetPickerModal.js';
import { GenerationRequestPreviewModal } from '../workspace/GenerationRequestPreviewModal.js';

import {
  Sparkles,
  Sliders,
  Bookmark,
  RefreshCw,
  Zap,
  Shield,
  Film,
  Wallet,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const CreateView: React.FC = () => {
  const { wallet, refreshWallet } = useAuth();

  // Core State
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('wan-2-1-video');
  const [mode, setMode] = useState<GenerationMode>('TEXT_TO_VIDEO');

  // Prompt & References
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [references, setReferences] = useState<WorkspaceReference[]>([]);

  // Generation Settings (Simple by default)
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [resolution, setResolution] = useState<string>('720p');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [numberOfOutputs, setNumberOfOutputs] = useState<number>(1);

  // Advanced Settings (On Demand)
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Validation & Draft Preview State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string>('');

  // Autosave State
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autosaveTimerRef = useRef<any>(null);

  // 1. Initial Load: Models, Pricing, Preferences, Assets, Presets, Latest Draft
  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        setLoading(true);
        const [modelsRes, presetsRes, assetsRes, prefsRes] = await Promise.all([
          workspaceService.listModels(),
          workspaceService.listPresets(),
          assetService.listAssets(),
          workspaceService.getUserPreferences(),
        ]);

        if (!isMounted) return;

        setModels(modelsRes);
        setPresets(presetsRes);
        setAvailableAssets(assetsRes);
        setFavoriteModelIds(prefsRes.favorite_model_ids || []);
        setRecentModelIds(prefsRes.recent_model_ids || []);

        // Try restoring latest draft
        const draft = await workspaceService.getLatestDraft().catch(() => null);
        if (draft && isMounted) {
          if (draft.model_id) setSelectedModelId(draft.model_id);
          if (draft.mode) setMode(draft.mode);
          if (draft.prompt) setPrompt(draft.prompt);
          if (draft.negative_prompt) setNegativePrompt(draft.negative_prompt);
          if (draft.references) setReferences(draft.references);
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

  // 2. Autosave Draft Handler (debounced)
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
        // Non-blocking autosave error
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

  // Current Model & Capabilities
  const selectedModel = models.find((m) => m.model_id === selectedModelId) || models[0];
  const capabilities = selectedModel ? getModelCapabilities(selectedModel) : null;

  // Real-time Capability Validation
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

    setValidationErrors(validation.errors);
    setValidationWarnings(validation.warnings);

    // Auto-correct duration or resolution if not supported
    if (capabilities) {
      if (!capabilities.supported_durations.includes(durationSeconds)) {
        setDurationSeconds(capabilities.supported_durations[0] || 5);
      }
      if (!capabilities.supported_resolutions.includes(resolution)) {
        setResolution(capabilities.supported_resolutions[0] || '720p');
      }
    }
  }, [selectedModel, mode, durationSeconds, resolution, aspectRatio, references, negativePrompt, prompt]);

  // Pricing Calculation (BRL cents)
  const matchingPricing = pricing.filter(
    (p) => p.active && p.model_id === selectedModelId && p.resolution === resolution
  );
  let unitPriceCents = 75; // R$ 0,75 default
  if (matchingPricing.length > 0) {
    unitPriceCents = Math.min(...matchingPricing.map((p) => p.customer_price_cents));
  }
  const totalEstimatedCostCents = unitPriceCents * numberOfOutputs;
  const availableBalanceCents = wallet?.available_balance_cents || 0;
  const hasSufficientFunds = availableBalanceCents >= totalEstimatedCostCents;

  // Handlers for References
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

    setReferences([...references, newRef]);
  };

  const handleUpdateReference = (updated: WorkspaceReference) => {
    setReferences(references.map((r) => (r.asset_id === updated.asset_id ? updated : r)));
  };

  const handleRemoveReference = (assetId: string) => {
    setReferences(references.filter((r) => r.asset_id !== assetId));
  };

  // Handler for Model Selection
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

  // Presets Handlers
  const handleApplyPreset = (preset: WorkspacePreset, applyMode: 'REPLACE' | 'MERGE') => {
    if (applyMode === 'REPLACE') {
      setPrompt(preset.prompt_template);
      if (preset.negative_prompt_template) setNegativePrompt(preset.negative_prompt_template);
    } else {
      // Merge: append template if prompt already exists
      setPrompt((prev) => (prev ? `${prev}\n${preset.prompt_template}` : preset.prompt_template));
    }

    if (preset.generation_settings) {
      if (preset.generation_settings.mode) setMode(preset.generation_settings.mode);
      if (preset.generation_settings.duration_seconds) setDurationSeconds(preset.generation_settings.duration_seconds);
      if (preset.generation_settings.resolution) setResolution(preset.generation_settings.resolution);
      if (preset.generation_settings.aspect_ratio) setAspectRatio(preset.generation_settings.aspect_ratio);
    }
  };

  const handleSaveCurrentAsPreset = async (presetData: { name: string; description: string; category: string }) => {
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

  // Trigger Validation and Preview (Etapa 2 Validation & Compilation)
  const handleTriggerGenerate = async () => {
    if (!prompt.trim()) {
      setValidationErrors(['O prompt descritivo da cena é obrigatório.']);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
        <p className="text-xs">Carregando Creative Workspace e Modelos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Bar: Title, Mode Tabs, Presets, Autosave Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Creative Workspace</span>
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Etapa 2 Ativa
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Criação cinematográfica orientada a prompts com referências estruturadas (@)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastSavedTime && (
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Salvo {lastSavedTime}</span>
            </span>
          )}

          <button
            type="button"
            id="btn-open-presets"
            onClick={() => setIsPresetModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>Presets ({presets.length})</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs (Text to Video, Image to Video, etc.) */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 w-fit text-xs">
        {(
          [
            { id: 'TEXT_TO_VIDEO', label: 'Texto para Vídeo' },
            { id: 'IMAGE_TO_VIDEO', label: 'Imagem para Vídeo' },
            { id: 'VIDEO_TO_VIDEO', label: 'Vídeo para Vídeo' },
            { id: 'AUDIO_TO_VIDEO', label: 'Áudio para Vídeo' },
          ] as Array<{ id: GenerationMode; label: string }>
        ).map((tab) => {
          const isSelected = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              id={`tab-mode-${tab.id.toLowerCase()}`}
              onClick={() => setMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left (Editor + References) | Right (Model + Specs + Cost) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Prompt Editor & Attached References */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prompt Editor */}
          <PromptEditor
            prompt={prompt}
            onChangePrompt={setPrompt}
            negativePrompt={negativePrompt}
            onChangeNegativePrompt={setNegativePrompt}
            supportsNegativePrompt={capabilities?.supports_negative_prompt ?? true}
            availableAssets={availableAssets}
            attachedReferences={references}
            onAddReference={handleAddReference}
            onOpenQuickUpload={() => setIsAssetPickerOpen(true)}
            onOpenImproveModal={() => setIsImproveModalOpen(true)}
            onTriggerGenerate={handleTriggerGenerate}
            onSaveDraft={triggerAutosave}
          />

          {/* Attached References with Preservation Rules */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
            <WorkspaceReferencesList
              references={references}
              onUpdateReference={handleUpdateReference}
              onRemoveReference={handleRemoveReference}
              onOpenAssetPicker={() => setIsAssetPickerOpen(true)}
              maxReferences={capabilities?.max_reference_images || 4}
            />
          </div>

          {/* Validation Errors & Warnings Alert */}
          {(validationErrors.length > 0 || validationWarnings.length > 0) && (
            <div className="space-y-2 text-xs">
              {validationErrors.map((err, i) => (
                <div
                  key={`err-${i}`}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
              {validationWarnings.map((warn, i) => (
                <div
                  key={`warn-${i}`}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Model Selector, Generation Specs & Financial Summary */}
        <div className="lg:col-span-5 space-y-4">
          {/* Model Selector Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={handleSelectModel}
              favoriteModelIds={favoriteModelIds}
              onToggleFavorite={handleToggleFavorite}
              recentModelIds={recentModelIds}
            />
          </div>

          {/* Technical Specs: Duration, Resolution, Aspect Ratio, Outputs */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Parâmetros de Produção</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Diretos & Otimizados</span>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Duração do Vídeo</label>
              <div className="grid grid-cols-2 gap-2">
                {(capabilities?.supported_durations || [5, 10]).map((dur) => {
                  const isSelected = durationSeconds === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDurationSeconds(dur)}
                      className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {dur} segundos
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resolution Selector */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Resolução de Renderização</label>
              <div className="grid grid-cols-2 gap-2">
                {(capabilities?.supported_resolutions || ['720p', '1080p']).map((res) => {
                  const isSelected = resolution === res;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {res} {res === '1080p' ? '(FHD Pro)' : '(HD Padrão)'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Formato / Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {(capabilities?.supported_aspect_ratios || ['16:9', '9:16', '1:1']).map((ar) => {
                  const isSelected = aspectRatio === ar;
                  const labelMap: Record<string, string> = {
                    '16:9': '16:9 (Landscape)',
                    '9:16': '9:16 (Reels/TikTok)',
                    '1:1': '1:1 (Quadrado)',
                  };
                  return (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setAspectRatio(ar)}
                      className={`py-2 px-2 rounded-xl border text-center font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-bold">{ar}</span>
                      <span className="text-[9px] text-zinc-500 block truncate">
                        {ar === '16:9' ? 'Horizontal' : ar === '9:16' ? 'Vertical' : 'Feed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Number of Outputs */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-zinc-400 font-medium">Variações Simultâneas</label>
                <span className="font-semibold text-white font-mono">{numberOfOutputs} saída(s)</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumberOfOutputs(num)}
                    className={`py-1.5 rounded-lg border text-center font-medium transition-colors ${
                      numberOfOutputs === num
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced On-Demand Drawer Toggle */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                id="btn-toggle-advanced-settings"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-zinc-400 hover:text-zinc-200 py-1"
              >
                <span>Avançado Sob Demanda (Seed & Física)</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pt-2 border-t border-zinc-800/60 animate-in fade-in">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">
                      Seed de Reprodução (opcional)
                    </label>
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="Aleatório se vazio"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-zinc-400 font-medium">Intensidade de Movimento (Motion)</label>
                      <span className="text-zinc-300 font-mono">{motionStrength}/10</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={motionStrength}
                      onChange={(e) => setMotionStrength(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary & Action Button */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-zinc-200">Investimento Previsto</span>
              </div>
              <span className="text-lg font-bold text-white tabular-nums">
                {formatCentsToBRL(totalEstimatedCostCents)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Seu saldo em carteira:</span>
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatCentsToBRL(availableBalanceCents)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Saldo após produção:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    hasSufficientFunds ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatCentsToBRL(availableBalanceCents - totalEstimatedCostCents)}
                </span>
              </div>
            </div>

            {!hasSufficientFunds && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2 text-[11px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>Saldo insuficiente para cobrir o valor estimado.</span>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              id="btn-generate-video-action"
              onClick={handleTriggerGenerate}
              disabled={validating || !prompt.trim() || validationErrors.length > 0}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 text-sm"
            >
              {validating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Compilando Requisição...</span>
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  <span>Validar e Preparar Geração</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-zinc-500 text-center leading-tight">
              A compilação de prompt e regras de preservação são executadas de forma segura. O roteador e execução real de provedores serão ativados na Etapa 3.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ImprovePromptModal
        isOpen={isImproveModalOpen}
        onClose={() => setIsImproveModalOpen(false)}
        originalPrompt={prompt}
        onApplyImproved={(imp) => setPrompt(imp)}
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
        currentHasContent={Boolean(prompt.trim())}
      />

      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        availableAssets={availableAssets}
        attachedAssetIds={references.map((r) => r.asset_id)}
        onSelectAsset={handleAddReference}
        onAssetUploaded={(newAsset) => {
          setAvailableAssets([newAsset, ...availableAssets]);
        }}
      />

      <GenerationRequestPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        draftData={previewData}
        notice={previewNotice}
      />
    </div>
  );
};
