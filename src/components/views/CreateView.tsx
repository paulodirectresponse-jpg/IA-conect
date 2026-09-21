import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ModelRegistryItem,
  WorkspacePreset,
  WorkspaceReference,
  Asset,
  AssetType,
  Generation,
  GenerationRequestDraft,
} from "../../types/index.js";
import { workspaceService } from "../../services/workspaceService.js";
import { generationClient } from "../../services/generationClient.js";
import { assetService } from "../../services/assetService.js";
import { useAuth } from "../../context/AuthContext.js";
import {
  adaptConfigurationToModel,
  findCompatibleModels,
  getModelCapabilities,
  mergeModelCapabilities,
  validateConfiguration,
} from "../../services/modelCapabilities.js";
import { DEFAULT_PRESERVATION_RULES } from "../../config/constants.js";
import { generationIntentResolver } from "../../services/generationIntentResolver.js";
import { pricingReferenceCacheKey } from "../../utils/generationReferenceMode.js";
import { CreatorPanel } from "../workspace/CreatorPanel.js";
import { CreationGallery } from "../workspace/CreationGallery.js";
import { ImprovePromptModal } from "../workspace/ImprovePromptModal.js";
import { PresetModal } from "../workspace/PresetModal.js";
import { AssetPickerModal } from "../workspace/AssetPickerModal.js";
import { ReferenceRulesModal } from "../workspace/ReferenceRulesModal.js";
import { upsertGeneration } from "../../utils/generationCollection.js";
import { MobileStudioLayout } from "../workspace/MobileStudioLayout.js";

function localAliasFor(a: Asset, refs: WorkspaceReference[]) {
  const p = a.type === "VIDEO" ? "video" : a.type === "AUDIO" ? "audio" : "img",
    used = new Set(refs.map((r) => r.alias_snapshot.toLowerCase()));
  let i = 1;
  while (used.has(`${p}${i}`)) i++;
  return `${p}${i}`;
}
function ratioFromAsset(asset: Asset) {
  if (!asset.width || !asset.height) return null;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a),
    d = gcd(asset.width, asset.height);
  return `${Math.round(asset.width / d)}:${Math.round(asset.height / d)}`;
}
function baseDurationFor(model: ModelRegistryItem) {
  const values = (model.supported_durations || [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0);
  return Math.min(...values);
}
const terminal = (status: string) =>
  ["SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"].includes(status);
interface Props {
  initialAsset?: Asset | null;
  onEditImage?: (asset: Asset) => void;
}

export const CreateView: React.FC<Props> = ({ initialAsset, onEditImage }) => {
  const { wallet, refreshWallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>([]),
    [selectionMode, setSelectionMode] = useState<"AUTO" | "MANUAL">("AUTO"),
    [manualModelId, setManualModelId] = useState(""),
    [initialImage, setInitialImage] = useState<Asset | null>(null),
    [endImage, setEndImage] = useState<Asset | null>(null),
    [prompt, setPrompt] = useState(""),
    [negativePrompt, setNegativePrompt] = useState(""),
    [references, setReferences] = useState<WorkspaceReference[]>([]),
    [durationSeconds, setDurationSeconds] = useState(5),
    [resolution, setResolution] = useState("720p"),
    [aspectRatio, setAspectRatio] = useState("16:9"),
    [numberOfOutputs, setNumberOfOutputs] = useState(1),
    [showAdvanced, setShowAdvanced] = useState(false),
    [seed, setSeed] = useState<number | "">(""),
    [motionStrength, setMotionStrength] = useState(5),
    [availableAssets, setAvailableAssets] = useState<Asset[]>([]),
    [presets, setPresets] = useState<WorkspacePreset[]>([]),
    [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]),
    [recentModelIds, setRecentModelIds] = useState<string[]>([]),
    [isImproveModalOpen, setIsImproveModalOpen] = useState(false),
    [isPresetModalOpen, setIsPresetModalOpen] = useState(false),
    [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false),
    [pickerTargetSlot, setPickerTargetSlot] = useState<
      "INITIAL" | "END" | "GENERAL"
    >("GENERAL"),
    [selectedRefForRules, setSelectedRefForRules] =
      useState<WorkspaceReference | null>(null),
    [validationErrors, setValidationErrors] = useState<string[]>([]),
    [generationError, setGenerationError] = useState(""),
    [modelAdjustmentNotice, setModelAdjustmentNotice] = useState(""),
    [validating, setValidating] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [liveGenerations, setLiveGenerations] = useState<Generation[]>([]),
    [unitPricesByModelId, setUnitPricesByModelId] = useState<
      Record<string, number | null>
    >({}),
    [priceLoadingModelIds, setPriceLoadingModelIds] = useState<string[]>([]),
    [uploadBusy, setUploadBusy] = useState(false);
  const autosaveTimerRef = useRef<any>(null),
    quoteSeqRef = useRef(0),
    unitQuoteCacheRef = useRef(new Map<string, number>());
  const [mobileActiveCount, setMobileActiveCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      workspaceService.listModels(),
      workspaceService.listModelRoutes("text-to-video"),
    ])
      .then(([rows, routes]) => {
        if (!mounted) return;
        const safeIds = new Set(routes.map((route) => route.model_id));
        const active = rows.filter(
          (m) =>
            m.status !== "INACTIVE" &&
            m.category === "VIDEO" &&
            safeIds.has(m.model_id) &&
            (m.supported_durations || []).some((duration) => Number.isFinite(Number(duration)) && Number(duration) > 0) &&
            ((m.supported_modes || []).includes("TEXT_TO_VIDEO") ||
              (m.supported_modes || []).includes("IMAGE_TO_VIDEO")),
        );
        setModels(active);
        setManualModelId((c) =>
          active.some((m) => m.model_id === c) ? c : active[0]?.model_id || "",
        );
      })
      .catch(() => {
        if (mounted) {
          setModels([]);
          setManualModelId("");
        }
      });
    workspaceService
      .listPresets()
      .then((r) => mounted && setPresets(r))
      .catch(() => {});
    assetService
      .listAssets()
      .then((r) => mounted && setAvailableAssets(r))
      .catch(() => {});
    workspaceService
      .getUserPreferences()
      .then((p) => {
        if (mounted) {
          setFavoriteModelIds(p.favorite_model_ids || []);
          setRecentModelIds(p.recent_model_ids || []);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (initialAsset?.type === "IMAGE") {
      setInitialImage(initialAsset);
      const r = ratioFromAsset(initialAsset);
      if (r) setAspectRatio(r);
    }
  }, [initialAsset?.asset_id]);
  useEffect(() => {
    const complete = (event: Event) => {
      const detail = (
        event as CustomEvent<{ local_asset_id: string; asset: Asset }>
      ).detail;
      if (!detail?.asset) return;
      const localId = detail.local_asset_id,
        real = detail.asset;
      setAvailableAssets((prev) => [
        real,
        ...prev.filter(
          (x) => x.asset_id !== localId && x.asset_id !== real.asset_id,
        ),
      ]);
      setInitialImage((prev) => (prev?.asset_id === localId ? real : prev));
      setEndImage((prev) => (prev?.asset_id === localId ? real : prev));
      setReferences((prev) =>
        prev.map((ref) =>
          ref.asset_id === localId
            ? {
                ...ref,
                asset_id: real.asset_id,
                alias_snapshot: real.alias || ref.alias_snapshot,
                asset: real,
              }
            : ref,
        ),
      );
    };
    const failed = (event: Event) => {
      const detail = (
        event as CustomEvent<{ local_asset_id: string; error: any }>
      ).detail;
      if (!detail?.local_asset_id) return;
      const localId = detail.local_asset_id;
      setAvailableAssets((prev) => prev.filter((x) => x.asset_id !== localId));
      setInitialImage((prev) => (prev?.asset_id === localId ? null : prev));
      setEndImage((prev) => (prev?.asset_id === localId ? null : prev));
      setReferences((prev) => prev.filter((ref) => ref.asset_id !== localId));
    };
    window.addEventListener("ia:asset-upload-complete", complete);
    window.addEventListener("ia:asset-upload-failed", failed);
    return () => {
      window.removeEventListener("ia:asset-upload-complete", complete);
      window.removeEventListener("ia:asset-upload-failed", failed);
    };
  }, []);

  const manualModel = useMemo(
      () =>
        models.find((m) => m.model_id === manualModelId) || models[0] || null,
      [models, manualModelId],
    ),
    autoCapabilities = useMemo(() => mergeModelCapabilities(models), [models]);
  const inferredIntent = useMemo(
      () =>
        generationIntentResolver.resolveMode({
          model: selectionMode === "MANUAL" ? manualModel : undefined,
          prompt,
          references,
          initialAsset: initialImage,
          endAsset: endImage,
        }),
      [selectionMode, manualModel, prompt, references, initialImage, endImage],
    ),
    mode = inferredIntent.mode;
  const counts = useMemo(() => {
    const r = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
    references.forEach((x) => {
      r[x.asset?.type || "IMAGE"]++;
    });
    return r;
  }, [references]);
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
    [
      models,
      mode,
      counts,
      initialImage,
      endImage,
      resolution,
      durationSeconds,
      aspectRatio,
      prompt.length,
      negativePrompt,
    ],
  );
  const refsWithFrames = useMemo(() => {
    const out = references.filter(
        (r) =>
          !["START_FRAME", "INITIAL_FRAME", "END_FRAME"].includes(
            String(r.role || "").toUpperCase(),
          ),
      ),
      d = DEFAULT_PRESERVATION_RULES.GENERIC;
    if (initialImage)
      out.unshift({
        asset_id: initialImage.asset_id,
        alias_snapshot: "start_frame",
        role: "START_FRAME",
        priority: "HIGH",
        preservation_rules: d.preserve,
        flexible_rules: d.flexible,
        asset: initialImage,
      });
    if (endImage)
      out.unshift({
        asset_id: endImage.asset_id,
        alias_snapshot: "end_frame",
        role: "END_FRAME",
        priority: "HIGH",
        preservation_rules: d.preserve,
        flexible_rules: d.flexible,
        asset: endImage,
      });
    return out;
  }, [references, initialImage, endImage]);
  const livePricesByModelId = useMemo(() => {
    const out: Record<string, number | null> = {};
    models.forEach((m) => {
      const unit = unitPricesByModelId[m.model_id];
      out[m.model_id] =
        unit == null
          ? null
          : unit * Math.max(1, durationSeconds) * Math.max(1, numberOfOutputs);
    });
    return out;
  }, [models, unitPricesByModelId, durationSeconds, numberOfOutputs]);
  const autoResolvedModel = useMemo(
    () =>
      [...autoCompatibleModels].sort(
        (a, b) =>
          (livePricesByModelId[a.model_id] ?? 99999999) -
          (livePricesByModelId[b.model_id] ?? 99999999),
      )[0] || null,
    [autoCompatibleModels, livePricesByModelId],
  );
  const selectedModel =
      selectionMode === "AUTO" ? autoResolvedModel : manualModel,
    activeCapabilities = useMemo(
      () =>
        selectionMode === "AUTO"
          ? autoResolvedModel
            ? getModelCapabilities(autoResolvedModel)
            : autoCapabilities
          : getModelCapabilities(manualModel),
      [selectionMode, autoResolvedModel, autoCapabilities, manualModel],
    );
  useEffect(() => {
    const seq = ++quoteSeqRef.current,
      compatibleIds = new Set(autoCompatibleModels.map((m) => m.model_id)),
      baseline: Record<string, number | null> = {},
      missing: ModelRegistryItem[] = [];
    models.forEach((m) => {
      if (!compatibleIds.has(m.model_id)) {
        baseline[m.model_id] = null;
        return;
      }
      const key = `${m.model_id}|${mode}|${resolution}|${aspectRatio}|${pricingReferenceCacheKey(refsWithFrames)}`,
        cached = unitQuoteCacheRef.current.get(key);
      if (cached != null) baseline[m.model_id] = cached;
      else {
        baseline[m.model_id] = unitPricesByModelId[m.model_id] ?? null;
        missing.push(m);
      }
    });
    setUnitPricesByModelId(baseline);
    setPriceLoadingModelIds(missing.map((m) => m.model_id));
    if (!missing.length) return;
    const t = setTimeout(async () => {
      const next = { ...baseline };
      let pricedReferences: WorkspaceReference[];
      try {
        pricedReferences =
          await assetService.resolveWorkspaceReferences(refsWithFrames);
      } catch {
        if (seq === quoteSeqRef.current) setPriceLoadingModelIds([]);
        return;
      }
      const refKey = pricingReferenceCacheKey(pricedReferences),
        requests = missing.map((m) => ({
          key: m.model_id,
          model_id: m.model_id,
          mode,
          prompt: prompt.trim() || "pricing preview",
          negative_prompt: negativePrompt,
          references: pricedReferences,
          settings: {
            duration_seconds: baseDurationFor(m),
            resolution,
            aspect_ratio: aspectRatio,
            number_of_outputs: 1,
            seed: m.supports_seed && seed !== "" ? seed : null,
            motion_strength: m.supports_motion_strength ? motionStrength : undefined,
          },
        }));
      try {
        const batch = await generationClient.quoteBatch(requests);
        for (const item of batch.items) {
          const m = missing.find((model) => model.model_id === item.key),
            d: any = item.pricing;
          if (!m || !item.ok || !d) {
            next[item.key] = null;
            continue;
          }
          const base = baseDurationFor(m),
            total = Number(d.retail_credit_price),
            unit = Number(d.unit_credit_price ?? Math.ceil(total / base));
          if (!Number.isFinite(unit) || unit <= 0) {
            next[m.model_id] = null;
            continue;
          }
          const key = `${m.model_id}|${mode}|${resolution}|${aspectRatio}|${refKey}`;
          unitQuoteCacheRef.current.set(key, unit);
          next[m.model_id] = unit;
        }
      } catch {
        missing.forEach((m) => {
          next[m.model_id] = null;
        });
      }
      if (seq === quoteSeqRef.current) {
        setUnitPricesByModelId(next);
        setPriceLoadingModelIds([]);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [
    models,
    autoCompatibleModels,
    mode,
    resolution,
    aspectRatio,
    refsWithFrames.length,
  ]);
  const compatibility = useMemo(
    () =>
      validateConfiguration(selectedModel, {
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
    [
      selectedModel,
      mode,
      durationSeconds,
      resolution,
      aspectRatio,
      refsWithFrames,
      negativePrompt,
      prompt,
      initialImage,
      endImage,
    ],
  );
  useEffect(() => {
    setValidationErrors(compatibility.errors);
    setGenerationError("");
  }, [compatibility]);
  const unitPriceCents = selectedModel
      ? (unitPricesByModelId[selectedModel.model_id] ?? null)
      : null,
    totalEstimatedCostCents =
      unitPriceCents == null
        ? null
        : unitPriceCents *
          Math.max(1, durationSeconds) *
          Math.max(1, numberOfOutputs),
    availableBalanceCents = wallet?.available_credits ?? 0,
    hasSufficientFunds =
      totalEstimatedCostCents != null &&
      availableBalanceCents >= totalEstimatedCostCents;
  const hasPendingReferences = refsWithFrames.some(
    (ref) =>
      ref.asset?.status === "UPLOADING" || ref.asset_id.startsWith("local_"),
  );

  const addGeneralAsset = (a: Asset) =>
    setReferences((p) =>
      p.some((r) => r.asset_id === a.asset_id)
        ? p
        : [
            ...p,
            {
              asset_id: a.asset_id,
              alias_snapshot: localAliasFor(a, p),
              role: "GENERAL",
              priority: "HIGH",
              preservation_rules: DEFAULT_PRESERVATION_RULES.GENERIC.preserve,
              flexible_rules: DEFAULT_PRESERVATION_RULES.GENERIC.flexible,
              asset: a,
            },
          ],
    );
  const handleAssetPicked = (a: Asset) =>
    pickerTargetSlot === "INITIAL"
      ? setInitialImage(a)
      : pickerTargetSlot === "END"
        ? setEndImage(a)
        : addGeneralAsset(a);
  const openPicker = (s: "INITIAL" | "END" | "GENERAL") => {
    setPickerTargetSlot(s);
    setIsAssetPickerOpen(true);
  };
  const filteredPickerAssets =
    pickerTargetSlot === "GENERAL"
      ? availableAssets
      : availableAssets.filter((a) => a.type === "IMAGE");
  const allowedPickerTypes: AssetType[] =
    pickerTargetSlot === "GENERAL" &&
    activeCapabilities.supported_modes.includes("REFERENCE_TO_VIDEO")
      ? (["IMAGE", "VIDEO", "AUDIO"].filter((t) =>
          t === "IMAGE"
            ? activeCapabilities.supports_image_reference
            : t === "VIDEO"
              ? activeCapabilities.supports_video_reference
              : activeCapabilities.supports_audio_reference,
        ) as AssetType[])
      : pickerTargetSlot === "GENERAL"
        ? []
        : ["IMAGE"];
  const quickUpload = useCallback(
    (target: "INITIAL" | "END" | "GENERAL", files: File[]) => {
      const referenceMode =
        activeCapabilities.supported_modes.includes("REFERENCE_TO_VIDEO");
      const usable = files.filter((f) => {
        if (target !== "GENERAL") return f.type.startsWith("image/");
        if (!referenceMode) return false;
        if (f.type.startsWith("image/"))
          return activeCapabilities.supports_image_reference;
        if (f.type.startsWith("video/"))
          return activeCapabilities.supports_video_reference;
        if (f.type.startsWith("audio/"))
          return activeCapabilities.supports_audio_reference;
        return false;
      });
      if (!usable.length) return;
      setUploadBusy(true);
      const imageFiles = usable.filter((f) => f.type.startsWith("image/")),
        otherFiles = usable.filter((f) => !f.type.startsWith("image/")),
        optimisticFiles =
          target === "GENERAL" ? imageFiles : imageFiles.slice(0, 1),
        handles = assetService.startOptimisticImageUploads(
          optimisticFiles,
          { category: "GENERIC" },
          3,
        ),
        pending: Promise<unknown>[] = [];
      const addGeneral = (asset: Asset) =>
        setReferences((prev) =>
          prev.some((r) => r.asset_id === asset.asset_id)
            ? prev
            : [
                ...prev,
                {
                  asset_id: asset.asset_id,
                  alias_snapshot: localAliasFor(asset, prev),
                  role: "GENERAL",
                  priority: "HIGH",
                  preservation_rules:
                    DEFAULT_PRESERVATION_RULES.GENERIC.preserve,
                  flexible_rules: DEFAULT_PRESERVATION_RULES.GENERIC.flexible,
                  asset,
                },
              ],
        );
      for (const handle of handles) {
        const local = handle.asset;
        setAvailableAssets((prev) => [
          local,
          ...prev.filter((x) => x.asset_id !== local.asset_id),
        ]);
        if (target === "INITIAL") setInitialImage(local);
        else if (target === "END") setEndImage(local);
        else addGeneral(local);
        pending.push(
          handle.ready.then(
            (real) => {
              setAvailableAssets((prev) => [
                real,
                ...prev.filter(
                  (x) =>
                    x.asset_id !== local.asset_id &&
                    x.asset_id !== real.asset_id,
                ),
              ]);
              setInitialImage((prev) =>
                prev?.asset_id === local.asset_id ? real : prev,
              );
              setEndImage((prev) =>
                prev?.asset_id === local.asset_id ? real : prev,
              );
              setReferences((prev) =>
                prev.map((ref) =>
                  ref.asset_id === local.asset_id
                    ? {
                        ...ref,
                        asset_id: real.asset_id,
                        alias_snapshot: real.alias || ref.alias_snapshot,
                        asset: real,
                      }
                    : ref,
                ),
              );
            },
            (e: any) => {
              setAvailableAssets((prev) =>
                prev.filter((x) => x.asset_id !== local.asset_id),
              );
              setInitialImage((prev) =>
                prev?.asset_id === local.asset_id ? null : prev,
              );
              setEndImage((prev) =>
                prev?.asset_id === local.asset_id ? null : prev,
              );
              setReferences((prev) =>
                prev.filter((ref) => ref.asset_id !== local.asset_id),
              );
              setGenerationError(
                e?.message || "Não foi possível enviar a imagem.",
              );
            },
          ),
        );
      }
      if (target === "GENERAL" && otherFiles.length) {
        pending.push(
          Promise.all(
            otherFiles.map((file) =>
              assetService.uploadAsset({ file, category: "GENERIC" }),
            ),
          )
            .then((rows) => {
              rows.forEach((asset) => {
                setAvailableAssets((prev) => [
                  asset,
                  ...prev.filter((x) => x.asset_id !== asset.asset_id),
                ]);
                addGeneral(asset);
              });
            })
            .catch((e: any) =>
              setGenerationError(
                e?.message || "Não foi possível enviar a mídia.",
              ),
            ),
        );
      }
      void Promise.allSettled(pending).then(() => setUploadBusy(false));
    },
    [activeCapabilities],
  );
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []).filter(
        (f) =>
          f.type.startsWith("image/") ||
          f.type.startsWith("video/") ||
          f.type.startsWith("audio/"),
      );
      if (!files.length) return;
      void quickUpload(
        !initialImage && files[0].type.startsWith("image/")
          ? "INITIAL"
          : "GENERAL",
        files,
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [quickUpload, initialImage]);

  const restoreGeneration = (g: Generation) => {
    setPrompt(g.original_prompt || "");
    setNegativePrompt(g.negative_prompt || "");
    setSelectionMode("MANUAL");
    setManualModelId(g.model_id);
    setDurationSeconds(g.duration_seconds || 5);
    setResolution(g.resolution || "720p");
    setAspectRatio(g.aspect_ratio || "16:9");
    setNumberOfOutputs(1);
    setSeed(g.seed ?? "");
    setMotionStrength(g.motion_strength ?? 5);
    const snaps = g.references || [],
      d = DEFAULT_PRESERVATION_RULES.GENERIC;
    const resolved = snaps
      .map((r, i) => {
        const a = availableAssets.find((x) => x.asset_id === r.asset_id);
        return a
          ? {
              snap: r,
              asset: a,
              ref: {
                asset_id: a.asset_id,
                alias_snapshot: r.alias || `ref${i + 1}`,
                role:
                  r.slot_type === "INITIAL"
                    ? "START_FRAME"
                    : r.slot_type === "END"
                      ? "END_FRAME"
                      : "GENERAL",
                priority: "HIGH" as const,
                preservation_rules: d.preserve,
                flexible_rules: d.flexible,
                asset: a,
              },
            }
          : null;
      })
      .filter(Boolean) as any[];
    setInitialImage(
      resolved.find((x) => x.snap.slot_type === "INITIAL")?.asset || null,
    );
    setEndImage(
      resolved.find((x) => x.snap.slot_type === "END")?.asset || null,
    );
    setReferences(
      resolved
        .filter(
          (x) => !["INITIAL", "END"].includes(x.snap.slot_type || "GENERAL"),
        )
        .map((x) => x.ref),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const useImageForVideo = (asset: Asset) => {
    setInitialImage(asset);
    const r = ratioFromAsset(asset);
    if (r) setAspectRatio(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const persistDraft = useCallback(async () => {
    if (
      refsWithFrames.some(
        (ref) =>
          ref.asset?.status === "UPLOADING" ||
          ref.asset_id.startsWith("local_"),
      )
    )
      return;
    try {
      await workspaceService.saveDraft({
        model_id: selectionMode === "AUTO" ? "AUTO" : manualModelId,
        mode,
        prompt,
        negative_prompt: negativePrompt,
        references: refsWithFrames,
        settings: {
          duration_seconds: durationSeconds,
          resolution,
          aspect_ratio: aspectRatio,
          number_of_outputs: numberOfOutputs,
          seed: seed === "" ? null : seed,
          motion_strength: motionStrength,
        },
      });
    } catch {}
  }, [
    selectionMode,
    manualModelId,
    mode,
    prompt,
    negativePrompt,
    refsWithFrames,
    durationSeconds,
    resolution,
    aspectRatio,
    numberOfOutputs,
    seed,
    motionStrength,
  ]);
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(persistDraft, 700);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [persistDraft]);
  const refreshAssets = useCallback(async () => {
    const rows = await assetService.listAssets().catch(() => []);
    setAvailableAssets(rows || []);
  }, []);
  const handleGenerationSettled = useCallback(() => {
    void refreshAssets();
    void refreshWallet();
  }, [refreshAssets, refreshWallet]);
  const handleModelSelection = useCallback(
    (m: ModelRegistryItem) => {
      const next = adaptConfigurationToModel(m, {
        duration_seconds: durationSeconds,
        resolution,
        aspect_ratio: aspectRatio,
        negative_prompt: negativePrompt,
        references,
        has_start_image: Boolean(initialImage),
        has_end_image: Boolean(endImage),
      });
      setSelectionMode("MANUAL");
      setManualModelId(m.model_id);
      setDurationSeconds(next.duration_seconds);
      setResolution(next.resolution);
      setAspectRatio(next.aspect_ratio);
      setNegativePrompt(next.negative_prompt);
      setReferences(next.references);
      if (next.remove_end_image) setEndImage(null);
      if (next.clear_seed) setSeed("");
      if (next.reset_motion_strength) setMotionStrength(5);
      setNumberOfOutputs(1);
      setModelAdjustmentNotice(
        next.changes.length ? `${m.name}: ${next.changes.join(" · ")}.` : "",
      );
    },
    [
      durationSeconds,
      resolution,
      aspectRatio,
      negativePrompt,
      references,
      initialImage,
      endImage,
    ],
  );
  const handleGenerate = async () => {
    if (
      !selectedModel ||
      compatibility.errors.length ||
      validating ||
      submitting ||
      (!hasPendingReferences && totalEstimatedCostCents == null)
    )
      return;
    setGenerationError("");
    const submittedModel = selectedModel,
      submittedMode = mode,
      submittedPrompt = prompt,
      submittedNegativePrompt = negativePrompt,
      submittedReferences = [...refsWithFrames],
      submittedDuration = durationSeconds,
      submittedResolution = resolution,
      submittedAspectRatio = aspectRatio,
      submittedOutputs = numberOfOutputs,
      submittedSeed = seed === "" ? null : seed,
      submittedMotion = motionStrength;
    setValidating(true);
    try {
      const resolvedReferences =
        await assetService.resolveWorkspaceReferences(submittedReferences);
      const quoteSubmitted = () =>
        generationClient.quote({
          model_id:
            selectionMode === "AUTO" ? "AUTO" : submittedModel.model_id,
          mode: submittedMode,
          prompt: submittedPrompt,
          negative_prompt: submittedNegativePrompt,
          references: resolvedReferences,
          settings: {
            duration_seconds: submittedDuration,
            resolution: submittedResolution,
            aspect_ratio: submittedAspectRatio,
            number_of_outputs: submittedOutputs,
            seed: activeCapabilities.supports_seed ? submittedSeed : null,
            motion_strength: activeCapabilities.supports_motion_strength ? submittedMotion : undefined,
          },
        });
      let quoted = await quoteSubmitted(),
        draft: any = quoted.request_draft;
      if (!draft.has_sufficient_funds) {
        setGenerationError("Créditos insuficientes para esta geração.");
        return;
      }
      const unit = Number(draft.unit_credit_price);
      if (Number.isFinite(unit) && unit > 0)
        setUnitPricesByModelId((prev) => ({
          ...prev,
          [submittedModel.model_id]: unit,
        }));
      setValidating(false);
      setSubmitting(true);
      let started: Generation;
      try {
        started = await generationClient.create(
          draft as GenerationRequestDraft,
        );
      } catch (e: any) {
        if (e?.code !== "PRICE_CHANGED_REQUOTE_REQUIRED") throw e;
        quoted = await quoteSubmitted();
        draft = quoted.request_draft;
        if (!draft.has_sufficient_funds)
          throw Object.assign(
            new Error("Créditos insuficientes para esta geração."),
            { code: "CREDIT_INSUFFICIENT_FUNDS" },
          );
        const retryUnit = Number(draft.unit_credit_price);
        if (Number.isFinite(retryUnit) && retryUnit > 0)
          setUnitPricesByModelId((prev) => ({
            ...prev,
            [submittedModel.model_id]: retryUnit,
          }));
        started = await generationClient.create(
          draft as GenerationRequestDraft,
        );
      }
      setLiveGenerations((prev) => upsertGeneration(prev, started));
      window.dispatchEvent(
        new CustomEvent("generation:updated", { detail: started }),
      );
      void refreshWallet();
      if (terminal(started.status)) {
        if (started.status === "SUCCEEDED") handleGenerationSettled();
        else
          setGenerationError(
            started.error_message || "A geração não pôde ser concluída.",
          );
      }
    } catch (e: any) {
      setGenerationError(
        e?.message || "Não foi possível iniciar esta geração.",
      );
    } finally {
      setValidating(false);
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileStudioLayout
        activeCount={mobileActiveCount}
        creator={
          <CreatorPanel
            models={models}
            selectionMode={selectionMode}
            selectedModelId={
              selectionMode === "AUTO"
                ? autoResolvedModel?.model_id || ""
                : manualModelId
            }
            autoResolvedModel={autoResolvedModel}
            onSelectAuto={() => {
              setSelectionMode("AUTO");
              setModelAdjustmentNotice("");
            }}
            onSelectModel={handleModelSelection}
            favoriteModelIds={favoriteModelIds}
            recentModelIds={recentModelIds}
            onToggleFavorite={async (id) => {
              const p = await workspaceService.toggleFavoriteModel(id);
              setFavoriteModelIds(p.favorite_model_ids || []);
            }}
            initialImage={initialImage}
            endImage={endImage}
            references={references}
            onOpenPicker={openPicker}
            onRemoveSlot={(s) =>
              s === "INITIAL" ? setInitialImage(null) : setEndImage(null)
            }
            onRemoveReference={(id) =>
              setReferences((p) => p.filter((r) => r.asset_id !== id))
            }
            onConfigureReference={setSelectedRefForRules}
            onQuickUpload={quickUpload}
            uploadBusy={uploadBusy}
            hasPendingReferences={hasPendingReferences}
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
            unitPriceCents={unitPriceCents}
            availableBalanceCents={availableBalanceCents}
            hasSufficientFunds={hasSufficientFunds}
            onGenerate={handleGenerate}
            validating={validating}
            generating={submitting}
            validationErrors={validationErrors}
            generationError={generationError}
            modelAdjustmentNotice={modelAdjustmentNotice}
            unitPricesByModelId={unitPricesByModelId}
            priceLoadingModelIds={priceLoadingModelIds}
          />
        }
        gallery={
          <CreationGallery
            defaultFilter="VIDEO"
            title="Minhas criações"
            subtitle="Vídeos, imagens e histórico do seu studio."
            liveGenerations={liveGenerations}
            onGenerationSettled={handleGenerationSettled}
            onRestoreGeneration={restoreGeneration}
            onUseImageAsReference={addGeneralAsset}
            onEditImage={onEditImage}
            onCreateVideoFromImage={useImageForVideo}
            onActiveCountChange={setMobileActiveCount}
          />
        }
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
        onApply={(p) => {
          setPrompt(p.prompt_template || "");
          setNegativePrompt(p.negative_prompt_template || "");
          setIsPresetModalOpen(false);
        }}
        onDelete={async (id) => {
          await workspaceService.deletePreset(id);
          setPresets((p) => p.filter((x) => x.preset_id !== id));
        }}
      />
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        availableAssets={filteredPickerAssets}
        onSelectAsset={handleAssetPicked}
        onAssetUploaded={(a) =>
          setAvailableAssets((p) => [
            a,
            ...p.filter((x) => x.asset_id !== a.asset_id),
          ])
        }
        attachedAssetIds={refsWithFrames.map((r) => r.asset_id)}
        title="Adicionar mídia"
        defaultTab="LIBRARY"
        allowedTypes={
          allowedPickerTypes.length ? allowedPickerTypes : ["IMAGE"]
        }
      />
      <ReferenceRulesModal
        isOpen={Boolean(selectedRefForRules)}
        onClose={() => setSelectedRefForRules(null)}
        reference={selectedRefForRules}
        onApply={(n) =>
          setReferences((p) =>
            p.map((r) => (r.asset_id === n.asset_id ? n : r)),
          )
        }
      />
    </>
  );
};
