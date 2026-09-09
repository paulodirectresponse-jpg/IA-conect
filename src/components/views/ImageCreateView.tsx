import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Download, ExternalLink, Image as ImageIcon, Layers3, Plus, RefreshCw, Sparkles, Video, X } from 'lucide-react';
import { Asset, ModelRegistryItem, PricingEntry, WorkspaceReference, Generation, GenerationRequestDraft } from '../../types/index.js';
import { workspaceService } from '../../services/workspaceService.js';
import { assetService } from '../../services/assetService.js';
import { generationClient } from '../../services/generationClient.js';
import { getModelCapabilities } from '../../services/modelCapabilities.js';
import { DEFAULT_PRESERVATION_RULES } from '../../config/constants.js';
import { STUDIO_FALLBACK_MODELS, STUDIO_FALLBACK_PRICING } from '../../config/studioCatalog.js';
import { useAuth } from '../../context/AuthContext.js';
import { PromptComposer } from '../workspace/PromptComposer.js';
import { AssetPickerModal } from '../workspace/AssetPickerModal.js';
import { CompactModelPicker } from '../workspace/CompactModelPicker.js';

interface Props { onUseImageForVideo?: (asset: Asset) => void; }
type SelectionMode = 'AUTO' | 'MANUAL';
const terminal = (status: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status);
const money = (cents?: number | null) => cents == null ? 'Preço indisponível' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const FALLBACK_IMAGE_MODELS = STUDIO_FALLBACK_MODELS.filter((m) => m.category === 'IMAGE' && m.status !== 'INACTIVE');
const resolutionRank = (value: string) => ({'1K':1,'1.5K':1.5,'2K':2,'4K':4}[value.toUpperCase()] || 0);

function localAlias(refs: WorkspaceReference[]) { const used=new Set(refs.map(r=>r.alias_snapshot.toLowerCase())); let i=1; while(used.has(`img${i}`))i++; return `img${i}`; }
function referenceFor(asset: Asset, refs: WorkspaceReference[]): WorkspaceReference { const d=DEFAULT_PRESERVATION_RULES.GENERIC; return {asset_id:asset.asset_id,alias_snapshot:localAlias(refs),role:'GENERAL',priority:'HIGH',preservation_rules:d.preserve,flexible_rules:d.flexible,asset}; }

export const ImageCreateView: React.FC<Props> = ({ onUseImageForVideo }) => {
  const { wallet, refreshWallet } = useAuth();
  const [models,setModels]=useState<ModelRegistryItem[]>(FALLBACK_IMAGE_MODELS);
  const [pricing,setPricing]=useState<PricingEntry[]>(STUDIO_FALLBACK_PRICING);
  const [assets,setAssets]=useState<Asset[]>([]);
  const [favoriteModelIds,setFavoriteModelIds]=useState<string[]>([]);
  const [recentModelIds,setRecentModelIds]=useState<string[]>([]);
  const [selectionMode,setSelectionMode]=useState<SelectionMode>('AUTO');
  const [manualModelId,setManualModelId]=useState(FALLBACK_IMAGE_MODELS[0]?.model_id||'');
  const [prompt,setPrompt]=useState('');
  const [references,setReferences]=useState<WorkspaceReference[]>([]);
  const [aspectRatio,setAspectRatio]=useState('1:1');
  const [resolution,setResolution]=useState('1K');
  const [numberOfOutputs,setNumberOfOutputs]=useState(1);
  const [seed,setSeed]=useState<number|''>('');
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [generation,setGeneration]=useState<Generation|null>(null);
  const [resultAssets,setResultAssets]=useState<Asset[]>([]);
  const [error,setError]=useState('');
  const pollRef=useRef<any>(null);

  useEffect(()=>{let mounted=true;
    workspaceService.listModels().then((rows)=>{if(!mounted)return;const imageModels=rows.filter(m=>m.category==='IMAGE'&&m.status!=='INACTIVE');if(imageModels.length){setModels(imageModels);setManualModelId((current)=>imageModels.some(m=>m.model_id===current)?current:imageModels[0].model_id);}}).catch(()=>{});
    workspaceService.listPricing().then((rows)=>{if(mounted&&rows?.length)setPricing(rows);}).catch(()=>{});
    assetService.listAssets().then((rows)=>{if(mounted)setAssets(rows||[]);}).catch(()=>{});
    workspaceService.getUserPreferences().then((prefs)=>{if(!mounted)return;setFavoriteModelIds(prefs.favorite_model_ids||[]);setRecentModelIds(prefs.recent_model_ids||[]);}).catch(()=>{});
    return()=>{mounted=false;if(pollRef.current)clearTimeout(pollRef.current);};
  },[]);

  const mode=references.length?'IMAGE_TO_IMAGE':'TEXT_TO_IMAGE';
  const baseCompatibleModels=useMemo(()=>models.filter(model=>{if(!model.supported_modes.includes(mode))return false;if(!model.supported_aspect_ratios.includes(aspectRatio))return false;if(references.length){const c=getModelCapabilities(model);if(!c.supports_image_reference||references.length>c.max_reference_images)return false;}return true;}),[models,mode,aspectRatio,references.length]);
  const manualModel=models.find(m=>m.model_id===manualModelId)||models[0]||null;
  const availableResolutions=useMemo(()=>{
    const values=selectionMode==='MANUAL'&&manualModel ? manualModel.supported_resolutions : Array.from(new Set(baseCompatibleModels.flatMap(m=>m.supported_resolutions||[])));
    return [...values].sort((a,b)=>resolutionRank(a)-resolutionRank(b));
  },[selectionMode,manualModel,baseCompatibleModels]);
  useEffect(()=>{if(!availableResolutions.length)return;if(!availableResolutions.includes(resolution)){setResolution(availableResolutions.includes('1K')?'1K':availableResolutions[0]);}},[availableResolutions,resolution]);

  const compatibleModels=useMemo(()=>baseCompatibleModels.filter(model=>model.supported_resolutions.includes(resolution)),[baseCompatibleModels,resolution]);
  const priceFor=(modelId:string,targetResolution=resolution)=>{const rows=pricing.filter(r=>r.active&&r.model_id===modelId&&(!r.resolution||r.resolution===targetResolution||r.resolution==='ANY'));return rows.length?Math.min(...rows.map(r=>r.customer_price_cents)):null;};
  const autoModel=useMemo(()=>[...compatibleModels].sort((a,b)=>(priceFor(a.model_id)??Number.MAX_SAFE_INTEGER)-(priceFor(b.model_id)??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name))[0]||null,[compatibleModels,pricing,resolution]);
  const activeModel=selectionMode==='AUTO'?autoModel:manualModel;
  const activeCaps=activeModel?getModelCapabilities(activeModel):null;
  const selectedCompatible=Boolean(activeModel&&compatibleModels.some(m=>m.model_id===activeModel.model_id));
  const unitPrice=activeModel?priceFor(activeModel.model_id):null;
  const estimatedPrice=unitPrice==null?null:unitPrice*numberOfOutputs;
  const balance=wallet?.available_balance_cents||0;
  const hasBalance=estimatedPrice==null||balance>=estimatedPrice;
  const canAttach=selectionMode==='AUTO'?models.some(m=>getModelCapabilities(m).supports_image_reference):Boolean(activeCaps?.supports_image_reference);
  const maxReferences=selectionMode==='AUTO'?Math.max(0,...models.map(m=>getModelCapabilities(m).max_reference_images)):activeCaps?.max_reference_images||0;

  const selectModel=async(model:ModelRegistryItem)=>{setSelectionMode('MANUAL');setManualModelId(model.model_id);const prefs=await workspaceService.trackRecentModel(model.model_id,mode).catch(()=>null);if(prefs)setRecentModelIds(prefs.recent_model_ids||[]);};
  const toggleFavorite=async(id:string)=>{const prefs=await workspaceService.toggleFavoriteModel(id).catch(()=>null);if(prefs)setFavoriteModelIds(prefs.favorite_model_ids||[]);};
  const addReference=(asset:Asset)=>setReferences(prev=>prev.some(r=>r.asset_id===asset.asset_id)||prev.length>=maxReferences?prev:[...prev,referenceFor(asset,prev)]);
  const removeReference=(assetId:string)=>{const ref=references.find(r=>r.asset_id===assetId);setReferences(prev=>prev.filter(r=>r.asset_id!==assetId));if(ref?.alias_snapshot){const escaped=ref.alias_snapshot.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');setPrompt(v=>v.replace(new RegExp(`@${escaped}\\b\\s*`,'g'),'').replace(/[ \t]{2,}/g,' '));}};
  const refreshGeneratedAssets=async(id:string)=>{const rows=await assetService.listAssets();setAssets(rows);const generated=rows.filter(a=>(a as any).source_generation_id===id);setResultAssets(generated);return generated;};
  const poll=(id:string)=>{pollRef.current=setTimeout(async()=>{try{const next=await generationClient.get(id);setGeneration(next);if(next.status==='SUCCEEDED'){await refreshGeneratedAssets(next.generation_id);await refreshWallet();setGenerating(false);return;}if(terminal(next.status)){setGenerating(false);if(next.status==='FAILED')setError(next.error_message||'A geração falhou.');return;}poll(id);}catch(err:any){setGenerating(false);setError(err?.message||'Falha ao consultar a geração.');}},2500);};

  const generate=async()=>{setError('');setResultAssets([]);if(!prompt.trim())return setError('Descreva a imagem que deseja criar.');if(!activeModel||!selectedCompatible)return setError('Escolha uma IA compatível ou use Auto para encontrar uma rota válida.');if(!activeModel.supported_resolutions.includes(resolution))return setError(`${activeModel.name} não suporta ${resolution}.`);if(estimatedPrice==null)return setError('Este modelo ainda não possui preço configurado para esta qualidade.');if(!hasBalance)return setError('Saldo insuficiente para esta geração.');const now=Date.now();const draft={request_id:`img_req_${now}_${Math.random().toString(36).slice(2,7)}`,user_id:'',model_id:activeModel.model_id,model_name:activeModel.name,mode,prompt:prompt.trim(),compiled_prompt:prompt.trim(),prompt_compiler_version:'image-workspace-1.1',references,settings:{duration_seconds:1,resolution,aspect_ratio:aspectRatio,number_of_outputs:numberOfOutputs,seed:typeof seed==='number'?seed:null},estimated_cost_cents:estimatedPrice,customer_balance_available_cents:balance,balance_after_generation_cents:balance-estimatedPrice,has_sufficient_funds:hasBalance,created_at:new Date().toISOString()} as unknown as GenerationRequestDraft;try{setGenerating(true);const started=await generationClient.create(draft);setGeneration(started);if(terminal(started.status)){setGenerating(false);if(started.status==='SUCCEEDED')await refreshGeneratedAssets(started.generation_id);else setError(started.error_message||'A geração não pôde ser concluída.');}else poll(started.generation_id);}catch(err:any){setGenerating(false);setError(err?.message||'Não foi possível iniciar a geração.');}};

  const useForVideo=async(asset:Asset)=>{try{const d=DEFAULT_PRESERVATION_RULES.GENERIC;await workspaceService.saveDraft({model_id:'AUTO',mode:'IMAGE_TO_VIDEO',prompt:'',references:[{asset_id:asset.asset_id,alias_snapshot:'img1',role:'START_FRAME',priority:'HIGH',preservation_rules:d.preserve,flexible_rules:d.flexible,asset}],settings:{duration_seconds:5,resolution:'720p',aspect_ratio:aspectRatio,number_of_outputs:1}});onUseImageForVideo?.(asset);}catch(err:any){setError(err?.message||'Não foi possível preparar esta imagem para vídeo.');}};

  return <div className="flex h-full min-h-0 bg-[#0b0e13]">
    <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <CompactModelPicker models={models} pricing={pricing} selectionMode={selectionMode} selectedModelId={manualModelId} autoResolvedModel={autoModel} onSelectAuto={()=>setSelectionMode('AUTO')} onSelectModel={selectModel} favoriteModelIds={favoriteModelIds} recentModelIds={recentModelIds} onToggleFavorite={toggleFavorite} currentResolution={resolution} currentDuration={1} currentOutputs={numberOfOutputs}/>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700">Upload rápido ou Biblioteca</p></div><button disabled={!canAttach||references.length>=maxReferences} onClick={()=>setPickerOpen(true)} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 disabled:opacity-30"><Plus className="w-3.5 h-3.5"/></button></div>{references.length>0&&<div className="mt-2 flex gap-1.5 overflow-x-auto">{references.map(ref=>{const selected=prompt.toLowerCase().includes(`@${ref.alias_snapshot.toLowerCase()}`);return <div key={ref.asset_id} className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selected?'border-cyan-300 ring-2 ring-cyan-300/10 shadow-[0_0_18px_rgba(103,232,249,.12)]':'border-white/[0.07]'}`}>{ref.asset?.public_url?<img src={ref.asset.thumbnail_url||ref.asset.public_url} className="w-full h-full object-cover" alt=""/>:<ImageIcon className="absolute inset-0 m-auto w-4 h-4 text-zinc-700"/>}<button onClick={()=>removeReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5"/></button><span className={`absolute left-1 bottom-1 px-1 py-0.5 rounded text-[7px] font-mono ${selected?'bg-cyan-300 text-[#071015] font-bold':'bg-black/70 text-white'}`}>@{ref.alias_snapshot}</span></div>;})}</div>}</section>

        <PromptComposer prompt={prompt} onChangePrompt={setPrompt} negativePrompt="" onChangeNegativePrompt={()=>{}} onOpenImproveModal={()=>{}} references={references} onRequestAddMedia={()=>setPickerOpen(true)} supportsNegativePrompt={false} maxChars={activeCaps?.max_prompt_length||10000}/>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><p className="text-[9px] font-semibold text-zinc-400 mb-2">Proporção</p><div className="flex flex-wrap gap-1.5">{(activeModel?.supported_aspect_ratios?.length?activeModel.supported_aspect_ratios:['1:1','16:9','9:16','4:3','3:4']).map(r=><button key={r} onClick={()=>setAspectRatio(r)} className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${aspectRatio===r?'border-cyan-300/35 bg-cyan-300/10 text-cyan-200':'border-white/[0.06] text-zinc-500'}`}>{r}</button>)}</div></section>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div><p className="text-[9px] font-semibold text-zinc-400">Qualidade</p><p className="text-[7px] text-zinc-700">Opções disponíveis para {activeModel?.name||'a IA selecionada'}</p></div><span className="text-[9px] font-black text-cyan-300">{resolution}</span></div><div className={`grid gap-1.5 ${availableResolutions.length>=4?'grid-cols-4':availableResolutions.length===3?'grid-cols-3':availableResolutions.length===2?'grid-cols-2':'grid-cols-1'}`}>{availableResolutions.map(value=><button key={value} type="button" onClick={()=>setResolution(value)} className={`h-8 rounded-lg border text-[9px] font-bold transition-all ${resolution===value?'border-cyan-300/40 bg-cyan-300/10 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,.06)]':'border-white/[0.06] bg-white/[0.01] text-zinc-600 hover:text-white hover:border-white/[0.12]'}`}>{value}</button>)}</div>{unitPrice!=null&&<p className="mt-2 text-[7px] text-zinc-700">{money(unitPrice)} por imagem nesta qualidade</p>}</section>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Layers3 className="w-3.5 h-3.5 text-zinc-600"/><p className="text-[9px] font-semibold text-zinc-400">Quantidade</p></div><span className="text-[8px] text-zinc-700">gera de uma vez</span></div><div className="grid grid-cols-4 gap-1.5">{[1,2,3,4].map(n=><button key={n} onClick={()=>setNumberOfOutputs(n)} className={`h-8 rounded-lg border text-[10px] font-black ${numberOfOutputs===n?'border-cyan-300/35 bg-cyan-300/10 text-cyan-200':'border-white/[0.06] text-zinc-600 hover:text-white'}`}>{n}</button>)}</div></section>
        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={()=>setShowAdvanced(v=>!v)} className="w-full h-10 px-3 flex items-center text-[10px] font-semibold text-zinc-400">Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${showAdvanced?'rotate-180':''}`}/></button>{showAdvanced&&<div className="px-3 pb-3"><label className="text-[8px] text-zinc-600">Seed<input type="number" value={seed} onChange={(e)=>setSeed(e.target.value===''?'':Number(e.target.value))} placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label></div>}</section>
        {!selectedCompatible&&activeModel&&<div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2 text-[9px] text-amber-300">{activeModel.name} não atende a combinação atual. Ajuste qualidade/referências ou use Auto.</div>}
        {error&&<div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300 flex gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0"/>{error}</div>}
      </div>
      <div className="p-3 border-t border-white/[0.06] bg-[#080b0f]"><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] text-zinc-700">Estimativa · {numberOfOutputs} imagem(ns) · {resolution}</p><p className="text-[11px] font-bold text-white">{money(estimatedPrice)}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className={`text-[10px] font-semibold ${hasBalance?'text-zinc-400':'text-rose-400'}`}>{money(balance)}</p></div></div><button onClick={generate} disabled={generating||!prompt.trim()||!activeModel||!selectedCompatible||estimatedPrice==null||!hasBalance} className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 text-[#071015] text-[11px] font-black flex items-center justify-center gap-2 disabled:opacity-35 disabled:grayscale hover:brightness-110"><Sparkles className="w-4 h-4"/>{generating?'Gerando...':`Gerar ${numberOfOutputs>1?`${numberOfOutputs} imagens`:'imagem'}`}</button></div>
    </aside>

    <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[#0b0e13]">
      <div className="px-5 lg:px-6 pt-5 pb-3 border-b border-white/[0.055]"><div className="flex items-center justify-between"><div><h2 className="text-[20px] font-bold tracking-tight text-white">Minhas imagens</h2><p className="mt-0.5 text-[10px] text-zinc-600">Resultados são salvos automaticamente na Biblioteca.</p></div>{generation&&!terminal(generation.status)&&<span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><RefreshCw className="w-3 h-3 animate-spin"/>{generation.status}</span>}</div></div>
      {!generation&&!resultAssets.length?<div className="h-[calc(100%-78px)] min-h-[420px] flex flex-col items-center justify-center text-center px-6"><div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] grid place-items-center"><ImageIcon className="w-6 h-6 text-zinc-700"/></div><h3 className="mt-4 text-sm font-semibold text-zinc-300">Sua próxima imagem aparece aqui</h3><p className="mt-1 text-[10px] text-zinc-600 max-w-md">Crie do zero ou use referências. Em Auto, o sistema escolhe uma rota compatível com a qualidade selecionada.</p></div>:null}
      {generating&&!resultAssets.length&&<div className="h-[calc(100%-78px)] min-h-[420px] grid place-items-center"><div className="text-center"><RefreshCw className="w-6 h-6 animate-spin text-cyan-300 mx-auto"/><h3 className="mt-3 text-sm font-semibold text-zinc-300">Criando {numberOfOutputs>1?`${numberOfOutputs} imagens`:'sua imagem'} em {resolution}</h3><p className="mt-1 text-[10px] text-zinc-600">Os resultados serão salvos na Biblioteca quando terminarem.</p></div></div>}
      {generation?.status==='FAILED'&&<div className="m-5 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-4 text-rose-300"><p className="text-xs font-semibold">A geração falhou</p><p className="text-[10px] mt-1">{generation.error_message||'Tente novamente ou escolha outra IA.'}</p></div>}
      {resultAssets.length>0&&<div className="p-5 lg:p-6 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">{resultAssets.map(asset=><article key={asset.asset_id} className="group rounded-2xl overflow-hidden border border-white/[0.07] bg-[#11151c]"><div className="relative aspect-square bg-[#0b0e13] flex items-center justify-center"><img src={asset.public_url} alt={asset.name} className="w-full h-full object-contain"/><span className="absolute left-3 top-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-300 text-[#071015] text-[8px] font-black"><Check className="w-2.5 h-2.5"/> GERADO</span><div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all flex justify-center"><div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-1 flex gap-1"><button onClick={()=>addReference(asset)} title="Usar como referência" className="w-9 h-9 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><ImageIcon className="w-4 h-4"/></button><button onClick={()=>useForVideo(asset)} title="Criar vídeo" className="w-9 h-9 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><Video className="w-4 h-4"/></button><a href={asset.public_url} target="_blank" rel="noreferrer" title="Abrir" className="w-9 h-9 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><ExternalLink className="w-4 h-4"/></a><a href={asset.public_url} download title="Baixar" className="w-9 h-9 rounded-lg hover:bg-white/10 grid place-items-center text-zinc-300"><Download className="w-4 h-4"/></a></div></div></div><div className="p-3"><p className="text-[11px] font-semibold text-zinc-200 truncate">{asset.name}</p><div className="mt-0.5 flex items-center justify-between gap-2"><p className="text-[8px] font-mono text-zinc-700">@{asset.alias}</p><span className="text-[8px] font-bold text-cyan-300">{resolution}</span></div></div></article>)}</div>}
    </main>

    <AssetPickerModal isOpen={pickerOpen} onClose={()=>setPickerOpen(false)} availableAssets={assets} onSelectAsset={addReference} onAssetUploaded={(asset)=>setAssets(prev=>[asset,...prev.filter(a=>a.asset_id!==asset.asset_id)])} attachedAssetIds={references.map(r=>r.asset_id)} title="Adicionar referência à imagem" subtitle="Envie agora ou reutilize uma imagem da sua Biblioteca." defaultTab="LIBRARY" allowedTypes={['IMAGE']}/>
  </div>;
};
