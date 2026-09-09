import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Download, Image as ImageIcon, Layers3, Plus, Sparkles, Video, X } from 'lucide-react';
import { Asset, ModelRegistryItem, PricingEntry, WorkspaceReference, Generation, GenerationRequestDraft } from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { generationClient } from '../../services/generationClient.js';
import { getModelCapabilities } from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { STUDIO_FALLBACK_MODELS, STUDIO_FALLBACK_PRICING } from '../../config/studioCatalog.js';
import { useAuth } from '../../context/AuthContext.js';
import { PromptComposer } from '../workspace/PromptComposer.js';
import { AssetPickerModal, AssetPickerContentView } from '../workspace/AssetPickerModal.js';
import { CompactModelPicker } from '../workspace/CompactModelPicker.js';
import { downloadMediaDirect, safeDownloadName } from '../../utils/mediaDownload.js';

interface Props { onUseImageForVideo?: (asset: Asset) => void; }
type SelectionMode = 'AUTO' | 'MANUAL';
type GalleryFilter = 'IMAGE' | 'ALL';
type MediaGroup = { id: string; assets: Asset[]; generation: Generation | null; ratio: string; kind: 'IMAGE' | 'VIDEO'; createdAt: string };

const terminal = (status: string) => ['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(status);
const money = (cents?: number | null) => cents == null ? 'Preço indisponível' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents / 100);
const FALLBACK_IMAGE_MODELS = STUDIO_FALLBACK_MODELS.filter((m) => m.category === 'IMAGE' && m.status !== 'INACTIVE');
const resolutionRank = (value: string) => ({'1K':1,'1.5K':1.5,'2K':2,'4K':4}[value.toUpperCase()] || 0);
const cssRatio = (ratio: string) => ratio.replace(':',' / ');
const ratioValue = (ratio: string) => { const [w,h] = ratio.split(':').map(Number); return w > 0 && h > 0 ? w / h : 1; };
const cardWidth = (ratio: string) => { const value = ratioValue(ratio); if (value < .8) return 'w-[168px] md:w-[188px]'; if (value < 1.2) return 'w-[210px] md:w-[228px]'; if (value < 1.6) return 'w-[250px] md:w-[275px]'; return 'w-[292px] md:w-[320px]'; };

function localAlias(refs: WorkspaceReference[]) {
  const used = new Set(refs.map((r) => r.alias_snapshot.toLowerCase()));
  let i = 1;
  while (used.has(`img${i}`)) i += 1;
  return `img${i}`;
}

function referenceFor(asset: Asset, refs: WorkspaceReference[]): WorkspaceReference {
  const d = DEFAULT_PRESERVATION_RULES.GENERIC;
  return { asset_id: asset.asset_id, alias_snapshot: localAlias(refs), role: 'GENERAL', priority: 'HIGH', preservation_rules: d.preserve, flexible_rules: d.flexible, asset };
}

function generatedMedia(asset: Asset) {
  const raw = asset as any;
  return !asset.deleted_at && ['IMAGE','VIDEO'].includes(asset.type) && Boolean(raw.source_generation_id || String(raw.origin || '').toUpperCase() === 'GENERATED');
}

function ratioFromAsset(asset: Asset) {
  if (!asset.width || !asset.height) return asset.type === 'VIDEO' ? '16:9' : '1:1';
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(asset.width, asset.height);
  const w = Math.round(asset.width / divisor);
  const h = Math.round(asset.height / divisor);
  return `${w}:${h}`;
}

export const ImageCreateView: React.FC<Props> = ({ onUseImageForVideo }) => {
  const { wallet, refreshWallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>(FALLBACK_IMAGE_MODELS);
  const [pricing, setPricing] = useState<PricingEntry[]>(STUDIO_FALLBACK_PRICING);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('AUTO');
  const [manualModelId, setManualModelId] = useState(FALLBACK_IMAGE_MODELS[0]?.model_id || '');
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<WorkspaceReference[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  const [numberOfOutputs, setNumberOfOutputs] = useState(1);
  const [seed, setSeed] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<AssetPickerContentView>('ASSETS');
  const [generating, setGenerating] = useState(false);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [error, setError] = useState('');
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('IMAGE');
  const [livePricesByModelId, setLivePricesByModelId] = useState<Record<string, number | null>>({});
  const [priceLoadingModelIds, setPriceLoadingModelIds] = useState<string[]>([]);
  const pollRef = useRef<any>(null);
  const quoteSeq = useRef(0);
  const quoteCache = useRef(new Map<string, { price: number; providerId: string | null }>());

  useEffect(() => {
    let mounted = true;
    Promise.all([
      workspaceService.listModels().catch(() => []),
      workspaceService.listPricing().catch(() => []),
      assetService.listAssets().catch(() => []),
      generationClient.list(100).catch(() => []),
      workspaceService.getUserPreferences().catch(() => ({ favorite_model_ids: [], recent_model_ids: [] } as any)),
    ]).then(([modelRows, pricingRows, assetRows, generationRows, prefs]) => {
      if (!mounted) return;
      const imageModels = modelRows.filter((m) => m.category === 'IMAGE' && m.status !== 'INACTIVE');
      if (imageModels.length) {
        setModels(imageModels);
        setManualModelId((current) => imageModels.some((m) => m.model_id === current) ? current : imageModels[0].model_id);
      }
      if (pricingRows.length) setPricing(pricingRows);
      setAssets(assetRows || []);
      setGenerations(generationRows || []);
      setFavoriteModelIds(prefs.favorite_model_ids || []);
      setRecentModelIds(prefs.recent_model_ids || []);
    });
    return () => { mounted = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  const mode = references.length ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
  const baseCompatibleModels = useMemo(() => models.filter((model) => model.supported_modes.includes(mode) && model.supported_aspect_ratios.includes(aspectRatio) && (!references.length || ((caps) => caps.supports_image_reference && references.length <= caps.max_reference_images)(getModelCapabilities(model)))), [models, mode, aspectRatio, references.length]);
  const manualModel = models.find((m) => m.model_id === manualModelId) || models[0] || null;
  const availableResolutions = useMemo(() => {
    const values = selectionMode === 'MANUAL' && manualModel ? manualModel.supported_resolutions : Array.from(new Set(baseCompatibleModels.flatMap((m) => m.supported_resolutions || [])));
    return [...values].sort((a,b) => resolutionRank(a) - resolutionRank(b));
  }, [selectionMode, manualModel, baseCompatibleModels]);

  useEffect(() => {
    if (availableResolutions.length && !availableResolutions.includes(resolution)) setResolution(availableResolutions.includes('1K') ? '1K' : availableResolutions[0]);
  }, [availableResolutions, resolution]);

  const compatibleModels = useMemo(() => baseCompatibleModels.filter((model) => model.supported_resolutions.includes(resolution)), [baseCompatibleModels, resolution]);
  const staticPriceFor = (modelId: string) => {
    const rows = pricing.filter((row) => row.active && row.model_id === modelId && (!row.resolution || row.resolution === resolution || row.resolution === 'ANY'));
    return rows.length ? Math.min(...rows.map((row) => row.customer_price_cents)) : null;
  };

  const autoModel = useMemo(() => [...compatibleModels].sort((a,b) => {
    const aLive = livePricesByModelId[a.model_id];
    const bLive = livePricesByModelId[b.model_id];
    const aPrice = aLive != null ? aLive : (staticPriceFor(a.model_id) ?? Number.MAX_SAFE_INTEGER);
    const bPrice = bLive != null ? bLive : (staticPriceFor(b.model_id) ?? Number.MAX_SAFE_INTEGER);
    return aPrice - bPrice || a.name.localeCompare(b.name);
  })[0] || null, [compatibleModels, pricing, resolution, livePricesByModelId]);

  const activeModel = selectionMode === 'AUTO' ? autoModel : manualModel;
  const activeCaps = activeModel ? getModelCapabilities(activeModel) : null;
  const selectedCompatible = Boolean(activeModel && compatibleModels.some((m) => m.model_id === activeModel.model_id));
  const canAttach = selectionMode === 'AUTO' ? models.some((m) => getModelCapabilities(m).supports_image_reference) : Boolean(activeCaps?.supports_image_reference);
  const maxReferences = selectionMode === 'AUTO' ? Math.max(0, ...models.map((m) => getModelCapabilities(m).max_reference_images)) : activeCaps?.max_reference_images || 0;
  const estimatedPrice = activeModel && Object.prototype.hasOwnProperty.call(livePricesByModelId, activeModel.model_id) ? livePricesByModelId[activeModel.model_id] : null;
  const quoteLoading = Boolean(activeModel && priceLoadingModelIds.includes(activeModel.model_id));
  const unitPrice = estimatedPrice == null ? null : Math.ceil(estimatedPrice / Math.max(1, numberOfOutputs));
  const balance = wallet?.available_balance_cents || 0;
  const hasBalance = estimatedPrice != null && balance >= estimatedPrice;

  const quoteModel = async (model: ModelRegistryItem) => {
    const preview = await workspaceService.validateAndPreview({
      model_id: model.model_id,
      mode,
      prompt: prompt.trim() || 'pricing preview',
      references,
      settings: { duration_seconds: 1, resolution, aspect_ratio: aspectRatio, number_of_outputs: numberOfOutputs, seed: typeof seed === 'number' ? seed : null },
    });
    const price = preview.request_draft.estimated_cost_cents;
    if (price == null) throw new Error('Cotação indisponível.');
    return { price, providerId: String((preview.request_draft as any).provider_id || '') || null };
  };

  useEffect(() => {
    const seq = ++quoteSeq.current;
    const compatibleIds = new Set(compatibleModels.map((m) => m.model_id));
    const baseline: Record<string, number | null> = {};
    models.forEach((m) => { baseline[m.model_id] = compatibleIds.has(m.model_id) ? (livePricesByModelId[m.model_id] ?? null) : null; });
    setLivePricesByModelId(baseline);
    const ids = compatibleModels.map((m) => m.model_id);
    setPriceLoadingModelIds(ids);
    const timer = window.setTimeout(async () => {
      const next: Record<string, number | null> = { ...baseline };
      await Promise.all(compatibleModels.map(async (model) => {
        const key = `${model.model_id}|${mode}|${resolution}|${aspectRatio}|${numberOfOutputs}|${references.length}`;
        const cached = quoteCache.current.get(key);
        if (cached) { next[model.model_id] = cached.price; return; }
        try {
          const quote = await quoteModel(model);
          quoteCache.current.set(key, quote);
          next[model.model_id] = quote.price;
        } catch {
          next[model.model_id] = null;
        }
      }));
      if (seq !== quoteSeq.current) return;
      setLivePricesByModelId(next);
      setPriceLoadingModelIds([]);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [models, compatibleModels, mode, resolution, aspectRatio, numberOfOutputs, references.length, typeof seed === 'number' ? seed : '']);

  useEffect(() => {
    if (!generating) return;
    setDisplayProgress((p) => Math.max(4, p));
    const timer = window.setInterval(() => setDisplayProgress((p) => p >= 92 ? p : Math.min(92, p + Math.max(1, Math.ceil((92 - p) * .08)))), 850);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    const reported = Number(generation?.progress_percent || 0);
    if (generating && reported > 0) setDisplayProgress((p) => Math.max(p, Math.min(92, reported)));
    if (generation?.status === 'SUCCEEDED') setDisplayProgress(100);
  }, [generation?.progress_percent, generation?.status, generating]);

  const selectModel = async (model: ModelRegistryItem) => {
    setSelectionMode('MANUAL');
    setManualModelId(model.model_id);
    const prefs = await workspaceService.trackRecentModel(model.model_id, mode).catch(() => null);
    if (prefs) setRecentModelIds(prefs.recent_model_ids || []);
  };
  const toggleFavorite = async (id: string) => { const prefs = await workspaceService.toggleFavoriteModel(id).catch(() => null); if (prefs) setFavoriteModelIds(prefs.favorite_model_ids || []); };
  const addReference = (asset: Asset) => setReferences((prev) => prev.some((r) => r.asset_id === asset.asset_id) || prev.length >= maxReferences ? prev : [...prev, referenceFor(asset, prev)]);
  const removeReference = (assetId: string) => {
    const ref = references.find((r) => r.asset_id === assetId);
    setReferences((prev) => prev.filter((r) => r.asset_id !== assetId));
    if (ref?.alias_snapshot) {
      const escaped = ref.alias_snapshot.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      setPrompt((value) => value.replace(new RegExp(`@${escaped}\\b\\s*`,'g'),'').replace(/[ \t]{2,}/g,' '));
    }
  };
  const openPicker = (view: AssetPickerContentView = 'ASSETS') => { setPickerView(view); setPickerOpen(true); };

  const refreshHistory = async (generationId?: string) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [assetRows, generationRows] = await Promise.all([assetService.listAssets(), generationClient.list(100)]);
      setAssets(assetRows || []);
      setGenerations(generationRows || []);
      if (!generationId || assetRows.some((asset) => String((asset as any).source_generation_id || '') === generationId)) return;
      await new Promise((resolve) => setTimeout(resolve, 300 + attempt * 220));
    }
  };

  const poll = (id: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const next = await generationClient.get(id);
        setGeneration(next);
        if (next.status === 'SUCCEEDED') {
          setDisplayProgress(100);
          await refreshHistory(next.generation_id);
          await refreshWallet();
          setGenerating(false);
          return;
        }
        if (terminal(next.status)) {
          setGenerating(false);
          if (next.status === 'FAILED') setError(next.error_message || 'A geração falhou.');
          return;
        }
        poll(id);
      } catch (err: any) {
        setGenerating(false);
        setError(err?.message || 'Falha ao consultar a geração.');
      }
    }, 2200);
  };

  const generate = async () => {
    setError('');
    if (!prompt.trim()) return setError('Descreva a imagem que deseja criar.');
    if (!activeModel || !selectedCompatible) return setError('Escolha uma IA compatível ou use Auto para encontrar uma rota válida.');
    if (!activeModel.supported_resolutions.includes(resolution)) return setError(`${activeModel.name} não suporta ${resolution}.`);
    if (quoteLoading || estimatedPrice == null) return setError('Aguarde a cotação antes de gerar.');
    if (!hasBalance) return setError('Saldo insuficiente para esta geração.');
    try {
      setPriceLoadingModelIds((prev) => Array.from(new Set([...prev, activeModel.model_id])));
      const fresh = await quoteModel(activeModel);
      setPriceLoadingModelIds((prev) => prev.filter((id) => id !== activeModel.model_id));
      let authorizedPrice = estimatedPrice;
      if (fresh.price < estimatedPrice) {
        authorizedPrice = fresh.price;
        setLivePricesByModelId((prev) => ({ ...prev, [activeModel.model_id]: fresh.price }));
      } else if (fresh.price > estimatedPrice) {
        return setError(`A cotação atual subiu de ${money(estimatedPrice)} para ${money(fresh.price)}. Nada foi cobrado. Aguarde a atualização do preço antes de gerar.`);
      }
      if (balance < authorizedPrice) return setError('Saldo insuficiente para esta geração.');
      setGeneration(null);
      setDisplayProgress(4);
      setGenerating(true);
      const now = Date.now();
      const draft = {
        request_id: `img_req_${now}_${Math.random().toString(36).slice(2,7)}`,
        user_id: '',
        model_id: activeModel.model_id,
        model_name: activeModel.name,
        mode,
        prompt: prompt.trim(),
        compiled_prompt: prompt.trim(),
        prompt_compiler_version: 'image-workspace-1.4',
        references,
        settings: { duration_seconds: 1, resolution, aspect_ratio: aspectRatio, number_of_outputs: numberOfOutputs, seed: typeof seed === 'number' ? seed : null },
        estimated_cost_cents: authorizedPrice,
        customer_balance_available_cents: balance,
        balance_after_generation_cents: balance - authorizedPrice,
        has_sufficient_funds: balance >= authorizedPrice,
        provider_id: fresh.providerId,
        created_at: new Date().toISOString(),
      } as unknown as GenerationRequestDraft;
      const started = await generationClient.create(draft);
      setGeneration(started);
      setGenerations((prev) => [started, ...prev.filter((g) => g.generation_id !== started.generation_id)]);
      if (terminal(started.status)) {
        setGenerating(false);
        if (started.status === 'SUCCEEDED') {
          setDisplayProgress(100);
          await refreshHistory(started.generation_id);
          await refreshWallet();
        } else setError(started.error_message || 'A geração não pôde ser concluída.');
      } else poll(started.generation_id);
    } catch (err: any) {
      setPriceLoadingModelIds((prev) => activeModel ? prev.filter((id) => id !== activeModel.model_id) : prev);
      setGenerating(false);
      setError(err?.message || 'Não foi possível iniciar a geração.');
    }
  };

  const useForVideo = async (asset: Asset) => {
    try {
      const d = DEFAULT_PRESERVATION_RULES.GENERIC;
      await workspaceService.saveDraft({ model_id: 'AUTO', mode: 'IMAGE_TO_VIDEO', prompt: '', references: [{ asset_id: asset.asset_id, alias_snapshot: 'img1', role: 'START_FRAME', priority: 'HIGH', preservation_rules: d.preserve, flexible_rules: d.flexible, asset }], settings: { duration_seconds: 5, resolution: '720p', aspect_ratio: ratioFromAsset(asset), number_of_outputs: 1 } });
      onUseImageForVideo?.(asset);
    } catch (err: any) { setError(err?.message || 'Não foi possível preparar esta imagem para vídeo.'); }
  };

  const generationMap = useMemo(() => new Map(generations.map((g) => [g.generation_id, g])), [generations]);
  const groups = useMemo<MediaGroup[]>(() => {
    const grouped = new Map<string, Asset[]>();
    for (const asset of assets.filter(generatedMedia)) {
      const generationId = String((asset as any).source_generation_id || '');
      if (!generationId) continue;
      const bucket = grouped.get(generationId) || [];
      const key = asset.public_url || asset.asset_id;
      if (!bucket.some((item) => (item.public_url || item.asset_id) === key)) bucket.push(asset);
      grouped.set(generationId, bucket);
    }

    if (generation?.status === 'SUCCEEDED') {
      const raw = generation as any;
      const urls = Array.from(new Set([...(Array.isArray(raw.result_urls) ? raw.result_urls : []), raw.result_url].filter(Boolean).map(String)));
      const existing = new Set((grouped.get(generation.generation_id) || []).map((asset) => asset.public_url));
      const runtime = urls.filter((url) => !existing.has(url)).map((url, index) => ({
        asset_id: `runtime-${generation.generation_id}-${index}`,
        owner_user_id: generation.user_id || '',
        type: 'IMAGE', category: 'GENERIC', name: `Imagem gerada ${index + 1}`, alias: `resultado_${index + 1}`, storage_path: '', public_url: url, thumbnail_url: url, mime_type: 'image/png', size_bytes: 0, status: 'READY', created_at: generation.completed_at || generation.created_at, updated_at: new Date().toISOString(), deleted_at: null,
      } as Asset));
      if (runtime.length) grouped.set(generation.generation_id, [...(grouped.get(generation.generation_id) || []), ...runtime]);
    }

    return Array.from(grouped.entries()).map(([id, groupAssets]) => {
      const g = generationMap.get(id) || (generation?.generation_id === id ? generation : null);
      const first = groupAssets[0];
      return { id, assets: groupAssets, generation: g, ratio: g?.aspect_ratio || ratioFromAsset(first), kind: first.type === 'VIDEO' ? 'VIDEO' : 'IMAGE', createdAt: g?.created_at || first.created_at };
    }).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [assets, generationMap, generation]);

  const visibleGroups = useMemo(() => groups.filter((group) => galleryFilter === 'ALL' || group.kind === 'IMAGE'), [groups, galleryFilter]);
  const handleDownload = async (asset: Asset) => {
    if (!asset.public_url) return;
    try { await downloadMediaDirect(asset.public_url, safeDownloadName(asset.name, asset.type === 'VIDEO' ? 'VIDEO' : 'IMAGE')); }
    catch (err: any) { setError(err?.message || 'Não foi possível baixar este arquivo.'); }
  };

  return <div className="flex h-full min-h-0 bg-[#0b0e13]">
    <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <CompactModelPicker models={models} pricing={pricing} selectionMode={selectionMode} selectedModelId={manualModelId} autoResolvedModel={autoModel} onSelectAuto={() => setSelectionMode('AUTO')} onSelectModel={selectModel} favoriteModelIds={favoriteModelIds} recentModelIds={recentModelIds} onToggleFavorite={toggleFavorite} currentResolution={resolution} currentDuration={1} currentOutputs={numberOfOutputs} livePricesByModelId={livePricesByModelId} priceLoadingModelIds={priceLoadingModelIds}/>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700">Anexe uma vez e mencione com @</p></div><button disabled={!canAttach || references.length >= maxReferences} onClick={() => openPicker('ASSETS')} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 disabled:opacity-30"><Plus className="w-3.5 h-3.5"/></button></div>{references.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto">{references.map((ref) => { const selected = prompt.toLowerCase().includes(`@${ref.alias_snapshot.toLowerCase()}`); return <div key={ref.asset_id} className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-cyan-300 ring-2 ring-cyan-300/10' : 'border-white/[0.07]'}`}>{ref.asset?.public_url ? <img src={ref.asset.thumbnail_url || ref.asset.public_url} className="w-full h-full object-cover" alt=""/> : <ImageIcon className="absolute inset-0 m-auto w-4 h-4 text-zinc-700"/>}<button onClick={() => removeReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5"/></button><span className={`absolute left-1 bottom-1 px-1 py-0.5 rounded text-[7px] font-mono ${selected ? 'bg-cyan-300 text-[#071015] font-bold' : 'bg-black/70 text-white'}`}>@{ref.alias_snapshot}</span></div>; })}</div>}</section>
        <PromptComposer prompt={prompt} onChangePrompt={setPrompt} negativePrompt="" onChangeNegativePrompt={() => {}} onOpenImproveModal={() => {}} references={references} onRequestAddMedia={openPicker} supportsNegativePrompt={false} maxChars={activeCaps?.max_prompt_length || 10000}/>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><p className="text-[9px] font-semibold text-zinc-400 mb-2">Proporção</p><div className="flex flex-wrap gap-1.5">{(activeModel?.supported_aspect_ratios?.length ? activeModel.supported_aspect_ratios : ['1:1','16:9','9:16','4:3','3:4']).map((r) => <button key={r} onClick={() => setAspectRatio(r)} className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${aspectRatio === r ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-500'}`}>{r}</button>)}</div></section>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div><p className="text-[9px] font-semibold text-zinc-400">Qualidade</p><p className="text-[7px] text-zinc-700">Opções disponíveis para {activeModel?.name || 'a IA selecionada'}</p></div><span className="text-[9px] font-black text-cyan-300">{resolution}</span></div><div className={`grid gap-1.5 ${availableResolutions.length >= 4 ? 'grid-cols-4' : availableResolutions.length === 3 ? 'grid-cols-3' : availableResolutions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{availableResolutions.map((value) => <button key={value} onClick={() => setResolution(value)} className={`h-8 rounded-lg border text-[9px] font-bold ${resolution === value ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>{value}</button>)}</div>{unitPrice != null && <p className="mt-2 text-[7px] text-zinc-700">{money(unitPrice)} por imagem · cotação atual</p>}</section>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Layers3 className="w-3.5 h-3.5 text-zinc-600"/><p className="text-[9px] font-semibold text-zinc-400">Quantidade</p></div><span className="text-[8px] text-zinc-700">gera de uma vez</span></div><div className="grid grid-cols-4 gap-1.5">{[1,2,3,4].map((n) => <button key={n} onClick={() => setNumberOfOutputs(n)} className={`h-8 rounded-lg border text-[10px] font-black ${numberOfOutputs === n ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>{n}</button>)}</div></section>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={() => setShowAdvanced((v) => !v)} className="w-full h-10 px-3 flex items-center text-[10px] font-semibold text-zinc-400">Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}/></button>{showAdvanced && <div className="px-3 pb-3"><label className="text-[8px] text-zinc-600">Seed<input type="number" value={seed} onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label></div>}</section>
        {!selectedCompatible && activeModel && <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2 text-[9px] text-amber-300">{activeModel.name} não atende a combinação atual. Ajuste qualidade/referências ou use Auto.</div>}
        {error && <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300 flex gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0"/>{error}</div>}
      </div>
      <div className="p-3 border-t border-white/[0.06] bg-[#080b0f]"><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] text-zinc-700">Preço final · {numberOfOutputs} imagem(ns) · {resolution}</p><p className="text-[11px] font-bold text-white">{quoteLoading ? 'Calculando...' : money(estimatedPrice)}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className={`text-[10px] font-semibold ${hasBalance || estimatedPrice == null ? 'text-zinc-400' : 'text-rose-400'}`}>{money(balance)}</p></div></div><button onClick={generate} disabled={generating || quoteLoading || !prompt.trim() || !activeModel || !selectedCompatible || estimatedPrice == null || !hasBalance} className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 text-[#071015] text-[11px] font-black flex items-center justify-center gap-2 disabled:opacity-35 disabled:grayscale"><Sparkles className="w-4 h-4"/>{generating ? 'Gerando...' : `Gerar ${numberOfOutputs > 1 ? `${numberOfOutputs} imagens` : 'imagem'}`}</button></div>
    </aside>

    <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[#0b0e13]">
      <div className="px-5 lg:px-6 pt-5 pb-3 border-b border-white/[0.055] flex flex-col md:flex-row md:items-end md:justify-between gap-3"><div><h2 className="text-[20px] font-bold tracking-tight text-white">Minhas imagens</h2><p className="mt-0.5 text-[10px] text-zinc-600">Cada geração ocupa uma linha e mantém sua proporção original.</p></div><div className="flex gap-2"><button onClick={() => setGalleryFilter('IMAGE')} className={`px-3 py-1.5 rounded-lg border text-[9px] font-semibold ${galleryFilter === 'IMAGE' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>Imagens</button><button onClick={() => setGalleryFilter('ALL')} className={`px-3 py-1.5 rounded-lg border text-[9px] font-semibold ${galleryFilter === 'ALL' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>Todos</button></div></div>

      {!generating && !visibleGroups.length ? <div className="h-[calc(100%-78px)] min-h-[420px] flex flex-col items-center justify-center text-center px-6"><div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] grid place-items-center"><ImageIcon className="w-6 h-6 text-zinc-700"/></div><h3 className="mt-4 text-sm font-semibold text-zinc-300">Sua próxima imagem aparece aqui</h3><p className="mt-1 text-[10px] text-zinc-600 max-w-md">As imagens concluídas permanecem nesta tela e também na Biblioteca.</p></div> : <div className="p-5 lg:p-6 space-y-7">
        {generating && <section><div className="mb-2 text-[8px] text-zinc-600 uppercase tracking-wider">Gerando agora · {activeModel?.name} · {aspectRatio}</div><div className="flex gap-3 overflow-x-auto pb-2">{Array.from({ length: numberOfOutputs }).map((_, index) => <article key={`loading-${index}`} className={`relative shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#10151c] shadow-[0_0_35px_rgba(34,211,238,0.08)] ${cardWidth(aspectRatio)}`} style={{ aspectRatio: cssRatio(aspectRatio) }}><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.10),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.025),rgba(255,255,255,0))] animate-pulse"/><div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><Sparkles className="w-4 h-4 text-cyan-200/80 mx-auto"/><p className="mt-2 text-[9px] font-semibold text-zinc-300">Gerando</p><p className="mt-1 text-[8px] text-zinc-600">{resolution} · {aspectRatio}</p></div></div><div className="absolute left-3 right-3 bottom-3"><div className="h-[2px] rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${displayProgress}%` }}/></div><div className="mt-1.5 flex justify-end"><span className="text-[8px] tabular-nums font-semibold text-zinc-500">{displayProgress}%</span></div></div></article>)}</div></section>}

        {visibleGroups.map((group) => <section key={group.id}><div className="mb-2.5 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold text-zinc-300 truncate">{group.generation?.original_prompt || group.assets[0]?.name || 'Geração'}</p><p className="mt-0.5 text-[8px] text-zinc-600">{group.generation?.model_id || 'IA Connect'} · {group.ratio} · {group.generation?.resolution || '-'}</p></div><span className="text-[8px] uppercase tracking-wider text-zinc-700">{group.assets.length} resultado{group.assets.length === 1 ? '' : 's'}</span></div><div className="flex gap-3 overflow-x-auto pb-2 items-start">{group.assets.map((asset) => <article key={asset.asset_id} className={`group/card shrink-0 rounded-2xl overflow-hidden border border-white/[0.07] bg-[#11151c] ${cardWidth(group.ratio)}`}><div className="relative bg-[#0b0e13]" style={{ aspectRatio: cssRatio(group.ratio) }}>{asset.type === 'VIDEO' ? <video src={asset.public_url} muted controls preload="metadata" className="w-full h-full object-cover"/> : <img src={asset.public_url} alt={asset.name} className="w-full h-full object-cover"/>}<span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-300 text-[#071015] text-[7px] font-black"><Check className="w-2.5 h-2.5"/> GERADO</span><button onClick={() => handleDownload(asset)} title="Baixar" className="absolute right-2.5 top-2.5 w-8 h-8 rounded-xl bg-black/75 backdrop-blur border border-white/10 grid place-items-center text-white"><Download className="w-3.5 h-3.5"/></button>{asset.type === 'IMAGE' && <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all flex justify-center"><div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-1 flex gap-1"><button onClick={() => addReference(asset)} title="Usar como referência" className="w-8 h-8 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><ImageIcon className="w-3.5 h-3.5"/></button><button onClick={() => useForVideo(asset)} title="Criar vídeo" className="w-8 h-8 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><Video className="w-3.5 h-3.5"/></button></div></div>}</div><div className="p-2.5"><p className="text-[10px] font-semibold text-zinc-200 truncate">{asset.name}</p><p className="mt-0.5 text-[7px] font-mono text-zinc-700 truncate">@{asset.alias}</p></div></article>)}</div></section>)}
      </div>}
      {generation?.status === 'FAILED' && <div className="m-5 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-4 text-rose-300"><p className="text-xs font-semibold">A geração falhou</p><p className="text-[10px] mt-1">{generation.error_message || 'Tente novamente ou escolha outra IA.'}</p></div>}
    </main>

    <AssetPickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} availableAssets={assets} onSelectAsset={addReference} onAssetUploaded={(asset) => setAssets((prev) => [asset, ...prev.filter((a) => a.asset_id !== asset.asset_id)])} attachedAssetIds={references.map((r) => r.asset_id)} title="Adicionar referência à imagem" subtitle="Escolha mídia, personagem, produto ou estilo sem repetir etapas." defaultTab="LIBRARY" defaultContentView={pickerView} allowedTypes={['IMAGE']}/>
  </div>;
};
