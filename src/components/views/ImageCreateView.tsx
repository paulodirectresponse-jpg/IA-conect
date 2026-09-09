import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from 'lucide-react';
import { Asset, ModelRegistryItem, PricingEntry, WorkspaceReference, Generation, GenerationRequestDraft } from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { generationClient } from '../../services/generationClient.js';
import { getModelCapabilities } from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { useAuth } from '../../context/AuthContext.js';
import { PromptComposer } from '../workspace/PromptComposer.js';
import { AssetPickerModal } from '../workspace/AssetPickerModal.js';

interface Props {
  onUseImageForVideo?: (asset: Asset) => void;
}

type SelectionMode = 'AUTO' | 'MANUAL';

const terminal = (status: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status);
const money = (cents?: number | null) => cents == null
  ? 'Preço indisponível'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function localAlias(refs: WorkspaceReference[]) {
  const used = new Set(refs.map((ref) => ref.alias_snapshot.toLowerCase()));
  let index = 1;
  while (used.has(`img${index}`)) index += 1;
  return `img${index}`;
}

function referenceFor(asset: Asset, refs: WorkspaceReference[]): WorkspaceReference {
  const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
  return {
    asset_id: asset.asset_id,
    alias_snapshot: localAlias(refs),
    role: 'GENERAL',
    priority: 'HIGH',
    preservation_rules: defaults.preserve,
    flexible_rules: defaults.flexible,
    asset,
  };
}

export const ImageCreateView: React.FC<Props> = ({ onUseImageForVideo }) => {
  const { wallet, refreshWallet } = useAuth();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('AUTO');
  const [manualModelId, setManualModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<WorkspaceReference[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [seed, setSeed] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [resultAssets, setResultAssets] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const pollRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [modelRows, priceRows, assetRows] = await Promise.all([
          workspaceService.listModels(),
          workspaceService.listPricing(),
          assetService.listAssets(),
        ]);
        if (!mounted) return;
        const imageModels = modelRows.filter((model) => model.category === 'IMAGE' && model.status !== 'INACTIVE');
        setModels(imageModels);
        setPricing(priceRows || []);
        setAssets(assetRows || []);
        setManualModelId(imageModels[0]?.model_id || '');
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Não foi possível preparar o gerador de imagens.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const mode = references.length ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
  const compatibleModels = useMemo(() => models.filter((model) => {
    if (!model.supported_modes.includes(mode)) return false;
    if (!model.supported_aspect_ratios.includes(aspectRatio)) return false;
    if (references.length) {
      const caps = getModelCapabilities(model);
      if (!caps.supports_image_reference || references.length > caps.max_reference_images) return false;
    }
    return true;
  }), [models, mode, aspectRatio, references.length]);

  const priceFor = (modelId: string) => {
    const rows = pricing.filter((row) => row.active && row.model_id === modelId && (!row.resolution || row.resolution === '1K' || row.resolution === 'ANY'));
    if (!rows.length) return null;
    return Math.min(...rows.map((row) => row.customer_price_cents));
  };

  const autoModel = useMemo(() => {
    return [...compatibleModels].sort((a, b) => {
      const aPrice = priceFor(a.model_id) ?? Number.MAX_SAFE_INTEGER;
      const bPrice = priceFor(b.model_id) ?? Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice || a.name.localeCompare(b.name);
    })[0] || null;
  }, [compatibleModels, pricing]);

  const manualModel = models.find((model) => model.model_id === manualModelId) || null;
  const activeModel = selectionMode === 'AUTO' ? autoModel : manualModel;
  const activeCaps = activeModel ? getModelCapabilities(activeModel) : null;
  const selectedCompatible = Boolean(activeModel && compatibleModels.some((model) => model.model_id === activeModel.model_id));
  const estimatedPrice = activeModel ? priceFor(activeModel.model_id) : null;
  const balance = wallet?.available_balance_cents || 0;
  const hasBalance = estimatedPrice == null || balance >= estimatedPrice;
  const canAttach = selectionMode === 'AUTO'
    ? models.some((model) => getModelCapabilities(model).supports_image_reference)
    : Boolean(activeCaps?.supports_image_reference);
  const maxReferences = selectionMode === 'AUTO'
    ? Math.max(0, ...models.map((model) => getModelCapabilities(model).max_reference_images))
    : activeCaps?.max_reference_images || 0;

  const addReference = (asset: Asset) => {
    setReferences((prev) => {
      if (prev.some((ref) => ref.asset_id === asset.asset_id)) return prev;
      if (prev.length >= maxReferences) return prev;
      return [...prev, referenceFor(asset, prev)];
    });
  };

  const removeReference = (assetId: string) => {
    const ref = references.find((item) => item.asset_id === assetId);
    setReferences((prev) => prev.filter((item) => item.asset_id !== assetId));
    if (ref?.alias_snapshot) {
      const escaped = ref.alias_snapshot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setPrompt((value) => value.replace(new RegExp(`@${escaped}\\b\\s*`, 'g'), '').replace(/[ \t]{2,}/g, ' '));
    }
  };

  const refreshGeneratedAssets = async (generationId: string) => {
    const rows = await assetService.listAssets();
    setAssets(rows);
    const generated = rows.filter((asset) => (asset as any).source_generation_id === generationId);
    setResultAssets(generated);
    return generated;
  };

  const poll = (id: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const next = await generationClient.get(id);
        setGeneration(next);
        if (next.status === 'SUCCEEDED') {
          await refreshGeneratedAssets(next.generation_id);
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
    }, 2500);
  };

  const generate = async () => {
    setError('');
    setResultAssets([]);
    if (!prompt.trim()) {
      setError('Descreva a imagem que deseja criar.');
      return;
    }
    if (!activeModel || !selectedCompatible) {
      setError('Escolha uma IA compatível ou use Auto para encontrar uma rota válida.');
      return;
    }
    if (estimatedPrice == null) {
      setError('Este modelo ainda não possui preço configurado para geração.');
      return;
    }
    if (!hasBalance) {
      setError('Saldo insuficiente para esta geração.');
      return;
    }

    const now = Date.now();
    const draft = {
      request_id: `img_req_${now}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: '',
      model_id: activeModel.model_id,
      model_name: activeModel.name,
      mode,
      prompt: prompt.trim(),
      compiled_prompt: prompt.trim(),
      prompt_compiler_version: 'image-workspace-1.0',
      references,
      settings: {
        duration_seconds: 1,
        resolution: '1K',
        aspect_ratio: aspectRatio,
        number_of_outputs: 1,
        seed: typeof seed === 'number' ? seed : null,
      },
      estimated_cost_cents: estimatedPrice,
      customer_balance_available_cents: balance,
      balance_after_generation_cents: balance - estimatedPrice,
      has_sufficient_funds: hasBalance,
      created_at: new Date().toISOString(),
    } as unknown as GenerationRequestDraft;

    try {
      setGenerating(true);
      const started = await generationClient.create(draft);
      setGeneration(started);
      if (terminal(started.status)) {
        setGenerating(false);
        if (started.status === 'SUCCEEDED') await refreshGeneratedAssets(started.generation_id);
        else setError(started.error_message || 'A geração não pôde ser concluída.');
      } else {
        poll(started.generation_id);
      }
    } catch (err: any) {
      setGenerating(false);
      setError(err?.message || 'Não foi possível iniciar a geração.');
    }
  };

  const useForVideo = async (asset: Asset) => {
    try {
      const defaults = DEFAULT_PRESERVATION_RULES.GENERIC;
      await workspaceService.saveDraft({
        model_id: 'AUTO',
        mode: 'IMAGE_TO_VIDEO',
        prompt: '',
        references: [{
          asset_id: asset.asset_id,
          alias_snapshot: 'img1',
          role: 'START_FRAME',
          priority: 'HIGH',
          preservation_rules: defaults.preserve,
          flexible_rules: defaults.flexible,
          asset,
        }],
        settings: {
          duration_seconds: 5,
          resolution: '720p',
          aspect_ratio: aspectRatio,
          number_of_outputs: 1,
        },
      });
      onUseImageForVideo?.(asset);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível preparar esta imagem para vídeo.');
    }
  };

  if (loading) {
    return <div className="flex-1 h-full flex items-center justify-center bg-[#F7F7F8] text-zinc-500"><Loader2 className="w-5 h-5 animate-spin mr-2"/><span className="text-xs font-medium">Preparando gerador de imagens...</span></div>;
  }

  return (
    <div className="flex-1 h-full min-h-0 bg-[#F7F7F8] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] gap-5">
        <aside className="bg-white border border-zinc-200 rounded-2xl shadow-xs p-4 h-fit lg:sticky lg:top-4 space-y-4">
          <div>
            <div className="flex items-center gap-2"><WandSparkles className="w-4 h-4 text-emerald-600"/><h2 className="text-sm font-bold text-zinc-900">Gerar imagem</h2></div>
            <p className="text-[11px] text-zinc-500 mt-1">Crie do zero ou anexe imagens para editar e manter referências.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-700">IA</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSelectionMode('AUTO')} className={`rounded-xl border p-2.5 text-left transition-all ${selectionMode === 'AUTO' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : 'border-zinc-200 hover:border-zinc-300'}`}>
                <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-600"/><span className="text-xs font-semibold">Auto</span></div>
                <p className="text-[9px] text-zinc-500 mt-1 truncate">{autoModel ? `${autoModel.name} · ${money(priceFor(autoModel.model_id))}` : 'Nenhuma rota compatível'}</p>
              </button>
              <div className={`rounded-xl border p-2.5 ${selectionMode === 'MANUAL' ? 'border-zinc-900 ring-1 ring-zinc-200' : 'border-zinc-200'}`}>
                <button type="button" onClick={() => setSelectionMode('MANUAL')} className="w-full text-left"><span className="text-xs font-semibold">Escolher IA</span></button>
                <select value={manualModelId} onFocus={() => setSelectionMode('MANUAL')} onChange={(e) => { setSelectionMode('MANUAL'); setManualModelId(e.target.value); }} className="w-full mt-1 text-[9px] bg-transparent outline-none text-zinc-500">
                  {models.map((model) => <option key={model.model_id} value={model.model_id}>{model.name}</option>)}
                </select>
              </div>
            </div>
            {activeModel && <p className="text-[9px] text-zinc-400">{activeModel.best_for}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div><p className="text-[11px] font-semibold text-zinc-700">Referências deste job</p><p className="text-[9px] text-zinc-400">Anexe e depois mencione com @ no prompt.</p></div>
              <button type="button" disabled={!canAttach || references.length >= maxReferences} onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold disabled:opacity-30"><Plus className="w-3 h-3"/> Adicionar</button>
            </div>
            {references.length ? <div className="flex gap-2 overflow-x-auto pb-1">
              {references.map((ref) => {
                const asset = ref.asset;
                const selected = prompt.includes(`@${ref.alias_snapshot}`);
                return <div key={ref.asset_id} className={`relative w-20 shrink-0 rounded-xl border-2 overflow-hidden bg-zinc-100 transition-all ${selected ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50' : 'border-zinc-200'}`}>
                  <div className="h-16 relative">{asset?.public_url ? <img src={asset.thumbnail_url || asset.public_url} className="w-full h-full object-cover" alt=""/> : <ImageIcon className="w-5 h-5 absolute inset-0 m-auto text-zinc-400"/>}<button type="button" onClick={() => removeReference(ref.asset_id)} className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white"><X className="w-3 h-3"/></button></div>
                  <div className={`px-1.5 py-1 text-[9px] font-mono font-semibold truncate ${selected ? 'text-emerald-800 bg-emerald-50' : 'text-zinc-600 bg-white'}`}>@{ref.alias_snapshot}</div>
                </div>;
              })}
            </div> : <button type="button" disabled={!canAttach} onClick={() => setPickerOpen(true)} className="w-full rounded-xl border border-dashed border-zinc-200 py-4 text-[10px] text-zinc-500 hover:border-emerald-400 hover:bg-emerald-50/30 disabled:opacity-40">+ Upload rápido ou Biblioteca de Assets</button>}
            {!selectedCompatible && activeModel && <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{activeModel.name} não atende a combinação atual. Remova referências ou use Auto.</p>}
          </div>

          <PromptComposer prompt={prompt} onChangePrompt={setPrompt} negativePrompt="" onChangeNegativePrompt={() => {}} onOpenImproveModal={() => {}} references={references} onRequestAddMedia={() => setPickerOpen(true)} supportsNegativePrompt={false} maxChars={activeCaps?.max_prompt_length || 10000}/>

          <div>
            <label className="text-[11px] font-semibold text-zinc-700">Proporção</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {['1:1','16:9','9:16','4:3','3:4'].map((ratio) => <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className={`px-1 py-1.5 rounded-lg border text-[10px] font-medium ${aspectRatio === ratio ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}>{ratio}</button>)}
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex items-center justify-between w-full text-[11px] font-semibold text-zinc-600"><span>Avançado</span><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}/></button>
            {showAdvanced && <div className="mt-2"><label className="text-[10px] text-zinc-500">Seed</label><input type="number" value={seed} onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Aleatório" className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs outline-none focus:border-zinc-400"/></div>}
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between">
            <div><p className="text-[9px] text-zinc-400">Estimativa</p><p className="text-sm font-bold text-zinc-900">{money(estimatedPrice)}</p></div>
            <div className="text-right"><p className="text-[9px] text-zinc-400">Saldo</p><p className={`text-xs font-semibold ${hasBalance ? 'text-zinc-700' : 'text-red-600'}`}>{money(balance)}</p></div>
          </div>

          <button type="button" onClick={generate} disabled={generating || !prompt.trim() || !activeModel || !selectedCompatible || estimatedPrice == null || !hasBalance} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin"/> Gerando...</> : <><Sparkles className="w-4 h-4"/> Gerar imagem {estimatedPrice != null ? `· ${money(estimatedPrice)}` : ''}</>}
          </button>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-[10px] text-red-700 flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>{error}</div>}
        </aside>

        <main className="min-h-[620px] bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between"><div><h3 className="text-xs font-bold text-zinc-900">Criações</h3><p className="text-[9px] text-zinc-400">Resultados são salvos automaticamente na Biblioteca de Assets.</p></div>{generation && !terminal(generation.status) && <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><RefreshCw className="w-3 h-3 animate-spin"/>{generation.status} {generation.progress_percent ? `· ${generation.progress_percent}%` : ''}</span>}</div>

          {!generation && !resultAssets.length ? <div className="h-[560px] flex flex-col items-center justify-center text-center px-6"><div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center"><ImageIcon className="w-7 h-7 text-zinc-400"/></div><h3 className="mt-4 text-sm font-semibold text-zinc-800">Sua próxima imagem aparece aqui</h3><p className="mt-1 text-xs text-zinc-500 max-w-md leading-relaxed">Comece com texto ou anexe imagens. Em Auto, o sistema escolhe uma rota compatível e econômica para o trabalho.</p></div> : null}

          {generating && !resultAssets.length && <div className="h-[560px] flex flex-col items-center justify-center text-center px-6"><div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin"/></div><h3 className="mt-4 text-sm font-semibold">Criando sua imagem</h3><p className="mt-1 text-[11px] text-zinc-500">Você pode continuar no sistema. O resultado será salvo em Assets quando terminar.</p></div>}

          {generation?.status === 'FAILED' && <div className="m-5 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"><p className="font-semibold">A geração falhou</p><p className="text-xs mt-1">{generation.error_message || 'Tente novamente ou escolha outra IA.'}</p></div>}

          {resultAssets.length > 0 && <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">{resultAssets.map((asset) => <div key={asset.asset_id} className="group rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50 shadow-xs"><div className="relative bg-zinc-100 min-h-[320px] flex items-center justify-center"><img src={asset.public_url} alt={asset.name} className="w-full max-h-[650px] object-contain"/><span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-sm"><Check className="w-2.5 h-2.5"/> GERADO</span></div><div className="p-3 bg-white"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-zinc-900 truncate">{asset.name}</p><p className="text-[9px] text-zinc-400 font-mono mt-0.5">@{asset.alias}</p></div><div className="flex items-center gap-1"><a href={asset.public_url} target="_blank" rel="noreferrer" title="Abrir imagem" className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900"><ExternalLink className="w-3.5 h-3.5"/></a><a href={asset.public_url} download title="Baixar" className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900"><Download className="w-3.5 h-3.5"/></a></div></div><div className="grid grid-cols-2 gap-2 mt-3"><button type="button" onClick={() => addReference(asset)} className="py-2 rounded-xl border border-zinc-200 text-[10px] font-semibold text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50">Usar como referência</button><button type="button" onClick={() => useForVideo(asset)} className="py-2 rounded-xl bg-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-800"><Video className="w-3 h-3"/> Criar vídeo</button></div></div></div>)}</div>}
        </main>
      </div>

      <AssetPickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} availableAssets={assets} onSelectAsset={addReference} onAssetUploaded={(asset) => setAssets((prev) => [asset, ...prev])} attachedAssetIds={references.map((ref) => ref.asset_id)} title="Adicionar referência à imagem" subtitle="Envie agora ou reutilize uma imagem da sua Biblioteca de Assets." defaultTab="LIBRARY" allowedTypes={['IMAGE']}/>
    </div>
  );
};
