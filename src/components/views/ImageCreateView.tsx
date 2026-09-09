import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Image as ImageIcon, Layers3, Plus, Sparkles, X } from 'lucide-react';
import { Asset, Generation, GenerationRequestDraft, ModelRegistryItem, PricingEntry, WorkspaceReference } from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { generationClient } from '../../services/generationClient.js';
import { getModelCapabilities } from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { STUDIO_FALLBACK_MODELS, STUDIO_FALLBACK_PRICING } from '../../config/studioCatalog.js';
import { useAuth } from '../../context/AuthContext.js';
import { PromptComposer } from '../workspace/PromptComposer.js';
import { AssetPickerContentView, AssetPickerModal } from '../workspace/AssetPickerModal.js';
import { CompactModelPicker } from '../workspace/CompactModelPicker.js';
import { CreationGallery } from '../workspace/CreationGallery.js';

interface Props { onUseImageForVideo?: (asset: Asset) => void; }
type SelectionMode = 'AUTO' | 'MANUAL';
const terminal = (status: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status);
const money = (cents?: number | null) => cents == null ? 'Preço indisponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const FALLBACK_IMAGE_MODELS = STUDIO_FALLBACK_MODELS.filter((model) => model.category === 'IMAGE' && model.status !== 'INACTIVE');
const resolutionRank = (value: string) => ({ '1K': 1, '1.5K': 1.5, '2K': 2, '4K': 4 }[value.toUpperCase()] || 0);

function localAlias(refs: WorkspaceReference[]) {
  const used = new Set(refs.map((ref) => ref.alias_snapshot.toLowerCase()));
  let index = 1;
  while (used.has(`img${index}`)) index += 1;
  return `img${index}`;
}

function referenceFor(asset: Asset, refs: WorkspaceReference[], alias?: string): WorkspaceReference {
  const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
  return {
    asset_id: asset.asset_id,
    alias_snapshot: alias || localAlias(refs),
    role: 'GENERAL',
    priority: 'HIGH',
    preservation_rules: defaults.preserve,
    flexible_rules: defaults.flexible,
    asset,
  };
}

function ratioFromAsset(asset: Asset) {
  if (!asset.width || !asset.height) return '1:1';
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(asset.width, asset.height);
  return `${Math.round(asset.width / divisor)}:${Math.round(asset.height / divisor)}`;
}

export const ImageCreateView: React.FC<Props> = ({ onUseImageForVideo }) => {
  const { wallet, refreshWallet } = useAuth();
  const [models, setModels] = useState<ModelRegistryItem[]>(FALLBACK_IMAGE_MODELS);
  const [pricing, setPricing] = useState<PricingEntry[]>(STUDIO_FALLBACK_PRICING);
  const [assets, setAssets] = useState<Asset[]>([]);
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
  const [error, setError] = useState('');
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
      workspaceService.getUserPreferences().catch(() => ({ favorite_model_ids: [], recent_model_ids: [] } as any)),
    ]).then(([modelRows, pricingRows, assetRows, prefs]) => {
      if (!mounted) return;
      const imageModels = modelRows.filter((model) => model.category === 'IMAGE' && model.status !== 'INACTIVE');
      if (imageModels.length) {
        setModels(imageModels);
        setManualModelId((current) => imageModels.some((model) => model.model_id === current) ? current : imageModels[0].model_id);
      }
      if (pricingRows.length) setPricing(pricingRows);
      setAssets(assetRows || []);
      setFavoriteModelIds(prefs.favorite_model_ids || []);
      setRecentModelIds(prefs.recent_model_ids || []);
    });
    return () => { mounted = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  const mode = references.length ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
  const baseCompatibleModels = useMemo(() => models.filter((model) => {
    const caps = getModelCapabilities(model);
    return model.supported_modes.includes(mode) && model.supported_aspect_ratios.includes(aspectRatio) && (!references.length || (caps.supports_image_reference && references.length <= caps.max_reference_images));
  }), [models, mode, aspectRatio, references.length]);
  const manualModel = models.find((model) => model.model_id === manualModelId) || models[0] || null;
  const availableResolutions = useMemo(() => {
    const values = selectionMode === 'MANUAL' && manualModel ? manualModel.supported_resolutions : Array.from(new Set(baseCompatibleModels.flatMap((model) => model.supported_resolutions || [])));
    return [...values].sort((a, b) => resolutionRank(a) - resolutionRank(b));
  }, [selectionMode, manualModel, baseCompatibleModels]);

  useEffect(() => {
    if (availableResolutions.length && !availableResolutions.includes(resolution)) setResolution(availableResolutions.includes('1K') ? '1K' : availableResolutions[0]);
  }, [availableResolutions, resolution]);

  const compatibleModels = useMemo(() => baseCompatibleModels.filter((model) => model.supported_resolutions.includes(resolution)), [baseCompatibleModels, resolution]);
  const autoModel = useMemo(() => [...compatibleModels].sort((a, b) => (livePricesByModelId[a.model_id] ?? Number.MAX_SAFE_INTEGER) - (livePricesByModelId[b.model_id] ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))[0] || null, [compatibleModels, livePricesByModelId]);
  const activeModel = selectionMode === 'AUTO' ? autoModel : manualModel;
  const activeCaps = activeModel ? getModelCapabilities(activeModel) : null;
  const selectedCompatible = Boolean(activeModel && compatibleModels.some((model) => model.model_id === activeModel.model_id));
  const canAttach = selectionMode === 'AUTO' ? models.some((model) => getModelCapabilities(model).supports_image_reference) : Boolean(activeCaps?.supports_image_reference);
  const maxReferences = selectionMode === 'AUTO' ? Math.max(0, ...models.map((model) => getModelCapabilities(model).max_reference_images)) : activeCaps?.max_reference_images || 0;
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
    const compatibleIds = new Set(compatibleModels.map((model) => model.model_id));
    const baseline: Record<string, number | null> = {};
    models.forEach((model) => { baseline[model.model_id] = compatibleIds.has(model.model_id) ? (livePricesByModelId[model.model_id] ?? null) : null; });
    setLivePricesByModelId(baseline);
    setPriceLoadingModelIds(compatibleModels.map((model) => model.model_id));
    const timer = window.setTimeout(async () => {
      const next = { ...baseline };
      await Promise.all(compatibleModels.map(async (model) => {
        const key = `${model.model_id}|${mode}|${resolution}|${aspectRatio}|${numberOfOutputs}|${references.length}|${typeof seed === 'number' ? seed : ''}`;
        const cached = quoteCache.current.get(key);
        if (cached) { next[model.model_id] = cached.price; return; }
        try {
          const quote = await quoteModel(model);
          quoteCache.current.set(key, quote);
          next[model.model_id] = quote.price;
        } catch { next[model.model_id] = null; }
      }));
      if (seq !== quoteSeq.current) return;
      setLivePricesByModelId(next);
      setPriceLoadingModelIds([]);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [models, compatibleModels, mode, resolution, aspectRatio, numberOfOutputs, references.length, typeof seed === 'number' ? seed : '']);

  const selectModel = async (model: ModelRegistryItem) => {
    setSelectionMode('MANUAL');
    setManualModelId(model.model_id);
    const prefs = await workspaceService.trackRecentModel(model.model_id, mode).catch(() => null);
    if (prefs) setRecentModelIds(prefs.recent_model_ids || []);
  };
  const toggleFavorite = async (id: string) => {
    const prefs = await workspaceService.toggleFavoriteModel(id).catch(() => null);
    if (prefs) setFavoriteModelIds(prefs.favorite_model_ids || []);
  };
  const addReference = (asset: Asset) => setReferences((prev) => prev.some((ref) => ref.asset_id === asset.asset_id) || prev.length >= maxReferences ? prev : [...prev, referenceFor(asset, prev)]);
  const removeReference = (assetId: string) => setReferences((prev) => prev.filter((ref) => ref.asset_id !== assetId));
  const openPicker = (view: AssetPickerContentView = 'ASSETS') => { setPickerView(view); setPickerOpen(true); };

  const restoreGeneration = (saved: Generation) => {
    setError('');
    setSelectionMode('MANUAL');
    setManualModelId(saved.model_id);
    setPrompt(saved.original_prompt || '');
    setAspectRatio(saved.aspect_ratio || '1:1');
    setResolution(saved.resolution || '1K');
    setNumberOfOutputs(saved.number_of_outputs || 1);
    setSeed(saved.seed ?? '');
    const snapshots = saved.references || [];
    const restored: WorkspaceReference[] = [];
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      const asset = assets.find((item) => item.asset_id === snapshot.asset_id);
      if (!asset) continue;
      restored.push(referenceFor(asset, restored, snapshot.alias || `img${index + 1}`));
    }
    setReferences(restored);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editImage = (asset: Asset) => {
    setError('');
    setSelectionMode('AUTO');
    setPrompt('');
    setReferences([referenceFor(asset, [])]);
    setAspectRatio(ratioFromAsset(asset));
    setNumberOfOutputs(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshAssets = async () => {
    const rows = await assetService.listAssets().catch(() => []);
    if (rows.length) setAssets(rows);
  };

  const poll = (id: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const next = await generationClient.get(id);
        setGeneration(next);
        window.dispatchEvent(new CustomEvent('generation:updated', { detail: next }));
        if (next.status === 'SUCCEEDED') {
          await Promise.all([refreshAssets(), refreshWallet()]);
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
        return setError(`A cotação subiu de ${money(estimatedPrice)} para ${money(fresh.price)}. Nada foi cobrado. Aguarde a atualização do preço.`);
      }
      setGenerating(true);
      const draft = {
        request_id: `img_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: '', model_id: activeModel.model_id, model_name: activeModel.name, mode,
        prompt: prompt.trim(), compiled_prompt: prompt.trim(), prompt_compiler_version: 'image-workspace-2.0',
        references,
        settings: { duration_seconds: 1, resolution, aspect_ratio: aspectRatio, number_of_outputs: numberOfOutputs, seed: typeof seed === 'number' ? seed : null },
        estimated_cost_cents: authorizedPrice, customer_balance_available_cents: balance,
        created_at: new Date().toISOString(),
      } as unknown as GenerationRequestDraft;
      const started = await generationClient.create(draft);
      setGeneration(started);
      window.dispatchEvent(new CustomEvent('generation:updated', { detail: started }));
      if (terminal(started.status)) {
        setGenerating(false);
        if (started.status === 'SUCCEEDED') await Promise.all([refreshAssets(), refreshWallet()]);
        else setError(started.error_message || 'A geração não pôde ser concluída.');
      } else poll(started.generation_id);
    } catch (err: any) {
      setGenerating(false);
      setError(err?.message || 'Não foi possível iniciar a geração.');
    }
  };

  const useForVideo = async (asset: Asset) => {
    try {
      const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
      await workspaceService.saveDraft({
        model_id: 'AUTO', mode: 'IMAGE_TO_VIDEO', prompt: '',
        references: [{ asset_id: asset.asset_id, alias_snapshot: 'img1', role: 'START_FRAME', priority: 'HIGH', preservation_rules: defaults.preserve, flexible_rules: defaults.flexible, asset }],
        settings: { duration_seconds: 5, resolution: '720p', aspect_ratio: ratioFromAsset(asset), number_of_outputs: 1 },
      });
      onUseImageForVideo?.(asset);
    } catch (err: any) { setError(err?.message || 'Não foi possível preparar esta imagem para vídeo.'); }
  };

  return <div className="flex h-full min-h-0 bg-[#0b0e13]">
    <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <CompactModelPicker models={models} pricing={pricing} selectionMode={selectionMode} selectedModelId={manualModelId} autoResolvedModel={autoModel} onSelectAuto={() => setSelectionMode('AUTO')} onSelectModel={selectModel} favoriteModelIds={favoriteModelIds} recentModelIds={recentModelIds} onToggleFavorite={toggleFavorite} currentResolution={resolution} currentDuration={1} currentOutputs={numberOfOutputs} livePricesByModelId={livePricesByModelId} priceLoadingModelIds={priceLoadingModelIds} />

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700">Anexe uma vez e mencione com @</p></div><button disabled={!canAttach || references.length >= maxReferences} onClick={() => openPicker('ASSETS')} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button></div>
          {references.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto">{references.map((ref) => <div key={ref.asset_id} className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-white/[0.08]">{ref.asset?.public_url ? <img src={ref.asset.thumbnail_url || ref.asset.public_url} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="absolute inset-0 m-auto w-4 h-4 text-zinc-700" />}<button onClick={() => removeReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5" /></button><span className="absolute left-1 bottom-1 px-1 py-0.5 rounded text-[7px] font-mono bg-black/70 text-white">@{ref.alias_snapshot}</span></div>)}</div>}
        </section>

        <PromptComposer prompt={prompt} onChangePrompt={setPrompt} negativePrompt="" onChangeNegativePrompt={() => {}} onOpenImproveModal={() => {}} references={references} onRequestAddMedia={openPicker} supportsNegativePrompt={false} maxChars={activeCaps?.max_prompt_length || 10000} />

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><p className="text-[9px] font-semibold text-zinc-400 mb-2">Proporção</p><div className="flex flex-wrap gap-1.5">{(activeModel?.supported_aspect_ratios?.length ? activeModel.supported_aspect_ratios : ['1:1', '16:9', '9:16', '4:3', '3:4']).map((ratio) => <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${aspectRatio === ratio ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-500'}`}>{ratio}</button>)}</div></section>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div><p className="text-[9px] font-semibold text-zinc-400">Qualidade</p><p className="text-[7px] text-zinc-700">Opções disponíveis para {activeModel?.name || 'a IA selecionada'}</p></div><span className="text-[9px] font-black text-cyan-300">{resolution}</span></div><div className={`grid gap-1.5 ${availableResolutions.length >= 4 ? 'grid-cols-4' : availableResolutions.length === 3 ? 'grid-cols-3' : availableResolutions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{availableResolutions.map((value) => <button key={value} onClick={() => setResolution(value)} className={`h-8 rounded-lg border text-[9px] font-bold ${resolution === value ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>{value}</button>)}</div>{unitPrice != null && <p className="mt-2 text-[7px] text-zinc-700">{money(unitPrice)} por imagem · cotação atual</p>}</section>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Layers3 className="w-3.5 h-3.5 text-zinc-600" /><p className="text-[9px] font-semibold text-zinc-400">Quantidade</p></div><span className="text-[8px] text-zinc-700">gera de uma vez</span></div><div className="grid grid-cols-4 gap-1.5">{[1, 2, 3, 4].map((number) => <button key={number} onClick={() => setNumberOfOutputs(number)} className={`h-8 rounded-lg border text-[10px] font-black ${numberOfOutputs === number ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.06] text-zinc-600'}`}>{number}</button>)}</div></section>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={() => setShowAdvanced((value) => !value)} className="w-full h-10 px-3 flex items-center text-[10px] font-semibold text-zinc-400">Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} /></button>{showAdvanced && <div className="px-3 pb-3"><label className="text-[8px] text-zinc-600">Seed<input type="number" value={seed} onChange={(event) => setSeed(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none" /></label></div>}</section>

        {error && <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300 flex gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
      </div>

      <div className="p-3 border-t border-white/[0.06] bg-[#080b0f]"><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] text-zinc-700">Preço final · {numberOfOutputs} imagem(ns) · {resolution}</p><p className="text-[11px] font-bold text-white">{quoteLoading ? 'Calculando...' : money(estimatedPrice)}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className="text-[10px] font-semibold text-zinc-400">{money(balance)}</p></div></div><button onClick={generate} disabled={generating || quoteLoading || !prompt.trim() || !activeModel || !selectedCompatible || estimatedPrice == null || !hasBalance} className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 text-[#071015] text-[11px] font-black flex items-center justify-center gap-2 disabled:opacity-35 disabled:grayscale"><Sparkles className="w-4 h-4" />{generating ? 'Gerando...' : `Gerar ${numberOfOutputs > 1 ? `${numberOfOutputs} imagens` : 'imagem'}`}</button></div>
    </aside>

    <CreationGallery
      defaultFilter="IMAGE"
      title="Minhas criações"
      subtitle="Imagens, vídeos e histórico do seu studio."
      liveGeneration={generation}
      onRestoreGeneration={restoreGeneration}
      onUseImageAsReference={addReference}
      onEditImage={editImage}
      onCreateVideoFromImage={useForVideo}
    />

    <AssetPickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} availableAssets={assets} onSelectAsset={addReference} onAssetUploaded={(asset) => setAssets((prev) => [asset, ...prev.filter((item) => item.asset_id !== asset.asset_id)])} attachedAssetIds={references.map((ref) => ref.asset_id)} title="Adicionar referência à imagem" subtitle="Escolha mídia, personagem, produto ou estilo sem repetir etapas." defaultTab="LIBRARY" defaultContentView={pickerView} allowedTypes={['IMAGE']} />
  </div>;
};