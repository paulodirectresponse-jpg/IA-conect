import React, { useMemo, useState } from 'react';
import { ChevronDown, Clock3, Image as ImageIcon, Layers3, Music, Plus, Ratio, Settings2, SlidersHorizontal, Video, X, UploadCloud } from 'lucide-react';
import { ModelRegistryItem, WorkspaceReference, Asset, GenerationMode, ModelCapabilities } from '../../types/index.js';
import { PromptComposer } from './PromptComposer.js';
import { UniversalModelPicker } from './UniversalModelPicker.js';
import { GeneratorDiscreteSlider,GeneratorFooter,GeneratorOptionGrid,GeneratorSettingRow,UniversalCreatorShell } from './GeneratorControls.js';
import { formatCredits } from '../../utils/creditFormat.js';
import { getVideoModelCover } from '../../config/videoModelCovers.js';

interface Props {
  models: ModelRegistryItem[]; selectionMode: 'AUTO' | 'MANUAL'; selectedModelId: string;
  autoResolvedModel?: ModelRegistryItem | null; onSelectAuto: () => void; onSelectModel: (m: ModelRegistryItem) => void;
  favoriteModelIds: string[]; recentModelIds: string[]; onToggleFavorite: (id: string) => void;
  initialImage: Asset | null; endImage: Asset | null; references: WorkspaceReference[];
  onOpenPicker: (s: 'INITIAL' | 'END' | 'GENERAL') => void; onRemoveSlot: (s: 'INITIAL' | 'END') => void;
  onRemoveReference: (id: string) => void; onConfigureReference: (r: WorkspaceReference) => void;
  onQuickUpload?: (target: 'INITIAL' | 'END' | 'GENERAL', files: File[]) => void; uploadBusy?: boolean; hasPendingReferences?: boolean;
  resolvedMode: GenerationMode; modeExplanation?: string; prompt: string; onChangePrompt: (t: string) => void;
  negativePrompt: string; onChangeNegativePrompt: (t: string) => void; onOpenImproveModal: () => void;
  aspectRatio: string; onChangeAspectRatio: (v: string) => void; durationSeconds: number; onChangeDuration: (v: number) => void;
  resolution: string; onChangeResolution: (v: string) => void; numberOfOutputs: number; onChangeNumberOfOutputs: (v: number) => void;
  capabilities: ModelCapabilities | null; showAdvanced: boolean; onToggleAdvanced: () => void; seed: number | '';
  onChangeSeed: (v: number | '') => void; motionStrength: number; onChangeMotionStrength: (v: number) => void;
  totalEstimatedCostCents: number | null; unitPriceCents: number | null; availableBalanceCents: number; hasSufficientFunds: boolean;
  onNavigateToWallet?: () => void; onGenerate: () => void; validating: boolean; generating?: boolean; validationErrors: string[]; generationError?: string;
  modelAdjustmentNotice?: string; unitPricesByModelId?: Record<string, number | null>; priceLoadingModelIds?: string[];
}
type OpenCard = 'duration' | 'ratio' | 'resolution' | null;
const filesFromDrop=(e:React.DragEvent)=>Array.from(e.dataTransfer.files||[]);

export const CreatorPanel: React.FC<Props> = (p) => {
  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const [dragTarget,setDragTarget]=useState<'INITIAL'|'END'|'GENERAL'|null>(null);
  const caps = p.capabilities;
  const selectedCoverUrl = p.selectionMode === 'MANUAL' ? getVideoModelCover(p.selectedModelId) : null;
  const canGenerate = p.models.length>0 && p.prompt.trim().length > 0 && (p.hasPendingReferences || p.hasSufficientFunds) && !p.validating && !p.generating && p.validationErrors.length === 0;
  const durations = [...(caps?.supported_durations||[])].sort((a,b)=>a-b);
  const ratios = caps?.supported_aspect_ratios||[];
  const resolutions = caps?.supported_resolutions||[];
  const showFrames = Boolean(caps?.supports_image_reference && caps?.supported_modes?.includes('IMAGE_TO_VIDEO'));
  const supportsGeneralReferences = Boolean(caps?.supported_modes?.includes('REFERENCE_TO_VIDEO') && (caps?.supports_image_reference || caps?.supports_video_reference || caps?.supports_audio_reference));
  const supportsSeed = Boolean(caps?.supports_seed);
  const supportsMotion = Boolean(caps?.supports_motion_strength);
  const hasAdvanced = supportsSeed || supportsMotion;
  const resolutionLabel = resolutions.every((value)=>/^(?:\d+(?:\.\d+)?p|\d+(?:\.\d+)?k)$/i.test(String(value))) ? 'Resolução' : 'Qualidade';
  const acceptedReferenceLabels=[caps?.supports_image_reference?'imagem':null,caps?.supports_video_reference?'vídeo':null,caps?.supports_audio_reference?'áudio':null].filter(Boolean).join(' · ');
  const generalRefs = p.references.filter((r) => !['START_FRAME','INITIAL_FRAME','END_FRAME'].includes(String(r.role || '').toUpperCase()));
  const activeAliases = useMemo(() => new Set(generalRefs.filter((r)=>p.prompt.toLowerCase().includes(`@${r.alias_snapshot.toLowerCase()}`)).map((r)=>r.asset_id)), [generalRefs, p.prompt]);
  const acceptDrop=(target:'INITIAL'|'END'|'GENERAL',e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();setDragTarget(null);const files=filesFromDrop(e);if(files.length)p.onQuickUpload?.(target,files)};
  const slot = (asset: Asset | null, label: string, target: 'INITIAL'|'END') => <button type="button" disabled={target==='END' && !caps?.supports_start_end_image} onClick={()=>p.onOpenPicker(target)} onDragEnter={(e)=>{e.preventDefault();setDragTarget(target)}} onDragOver={(e)=>e.preventDefault()} onDragLeave={()=>setDragTarget(v=>v===target?null:v)} onDrop={(e)=>acceptDrop(target,e)} className={`ia-frame-slot ${asset?'is-filled':'is-empty'} relative h-[68px] rounded-xl overflow-hidden border bg-white/[0.025] disabled:opacity-35 text-left transition-colors ${dragTarget===target?'border-cyan-300/60 bg-cyan-300/[0.08] ring-2 ring-cyan-300/10':'border-white/[0.07] hover:border-white/[0.12]'}`}>
    {asset?.public_url ? <img src={asset.thumbnail_url || asset.public_url} decoding="async" className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700"><ImageIcon className="w-4 h-4"/><span className="text-[9px]">{dragTarget===target?'Solte a imagem':label}</span><span className="text-[7px] text-zinc-700"><span className="ia-desktop-copy">clique ou arraste</span><span className="ia-mobile-copy">toque para adicionar</span></span></div>}
    {dragTarget===target&&<div className="absolute inset-0 bg-cyan-300/[0.08] grid place-items-center pointer-events-none"><UploadCloud className="w-5 h-5 text-cyan-200"/></div>}
    {asset && <><span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-semibold text-white">{asset.status==='UPLOADING'?'Enviando…':label}</span><span onClick={(e)=>{e.stopPropagation();p.onRemoveSlot(target);}} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/70 grid place-items-center text-zinc-300"><X className="w-3 h-3"/></span></>}
  </button>;
  return <UniversalCreatorShell
    ariaLabel="Gerador de vídeo"
    className="ia-generator-panel-video"
    modelPicker={<UniversalModelPicker
      models={p.models}
      selectedModelId={p.selectionMode==='AUTO'?'AUTO':p.selectedModelId}
      autoResolvedModel={p.autoResolvedModel}
      onSelect={(modelId)=>{if(modelId==='AUTO')p.onSelectAuto();else{const model=p.models.find(item=>item.model_id===modelId);if(model)p.onSelectModel(model)}}}
      favoriteModelIds={p.favoriteModelIds}
      recentModelIds={p.recentModelIds}
      onToggleFavorite={p.onToggleFavorite}
      unitPricesByModelId={p.unitPricesByModelId}
      priceLoadingModelIds={p.priceLoadingModelIds}
      selectedCoverUrl={selectedCoverUrl}
    />}
    footer={<GeneratorFooter
      error={p.validationErrors[0]||p.generationError}
      price={p.totalEstimatedCostCents}
      balance={p.availableBalanceCents}
      hasBalance={p.hasSufficientFunds}
      primaryLabel={p.hasPendingReferences?'Gerar assim que a imagem enviar':p.totalEstimatedCostCents==null?'Gerar vídeo':`Gerar • ${formatCredits(p.totalEstimatedCostCents)}`}
      busyLabel={p.validating?'Validando...':'Enviando...'}
      onPrimary={p.onGenerate}
      primaryDisabled={!canGenerate}
      primaryBusy={Boolean(p.generating||p.validating)}
    />}
  >
      {showFrames&&<><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Frames</span><span className="text-[8px] text-zinc-750"><span className="ia-desktop-copy">cole, clique ou arraste</span><span className="ia-mobile-copy">toque para adicionar</span></span></div>
      <div className={`grid gap-2 ${caps?.supports_start_end_image?'grid-cols-2':'grid-cols-1'}`}>{slot(p.initialImage,'Imagem inicial','INITIAL')}{caps?.supports_start_end_image&&slot(p.endImage,'Imagem final','END')}</div></>}
      {supportsGeneralReferences&&<section onDragEnter={(e)=>{e.preventDefault();setDragTarget('GENERAL')}} onDragOver={(e)=>e.preventDefault()} onDragLeave={()=>setDragTarget(v=>v==='GENERAL'?null:v)} onDrop={(e)=>acceptDrop('GENERAL',e)} className={`ia-reference-panel rounded-xl border p-2.5 transition-colors ${dragTarget==='GENERAL'?'border-cyan-300/50 bg-cyan-300/[0.06]':'border-white/[0.065] bg-white/[0.025]'}`}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700"><span className="ia-desktop-copy">{acceptedReferenceLabels||'mídia compatível'} · clique ou arraste</span><span className="ia-mobile-copy">{acceptedReferenceLabels||'mídia compatível'} · toque para adicionar</span></p></div><button onClick={()=>p.onOpenPicker('GENERAL')} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 hover:text-white"><Plus className="w-3.5 h-3.5"/></button></div>{generalRefs.length>0?<div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">{generalRefs.map((ref)=>{const type=ref.asset?.type||'IMAGE';return <div key={ref.asset_id} onDoubleClick={()=>p.onConfigureReference(ref)} className={`ia-reference-thumb relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-colors duration-150 ease-out ${activeAliases.has(ref.asset_id)?'border-cyan-300 ring-2 ring-cyan-300/10':'border-white/[0.07]'}`}>{type==='IMAGE'&&ref.asset?.public_url?<img src={ref.asset.thumbnail_url||ref.asset.public_url} alt="" decoding="async" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center bg-black/20">{type==='VIDEO'?<Video className="w-4 h-4 text-sky-300"/>:type==='AUDIO'?<Music className="w-4 h-4 text-violet-300"/>:<ImageIcon className="w-4 h-4 text-zinc-600"/>}</div>}<span className="absolute left-1 top-1 px-1 py-0.5 rounded bg-black/65 text-[6px] font-bold uppercase text-zinc-300">{type==='IMAGE'?'img':type==='VIDEO'?'vídeo':'áudio'}</span><button onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5"/></button>{ref.asset?.status==='UPLOADING'&&<span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-center text-[6px] font-bold text-cyan-200">enviando…</span>}{activeAliases.has(ref.asset_id)&&ref.asset?.status!=='UPLOADING'&&<span className="absolute left-1 bottom-1 px-1 py-0.5 rounded bg-cyan-300 text-[6.5px] font-black uppercase text-[#071015]">em uso</span>}</div>})}</div>:<div className="ia-reference-dropzone mt-2 h-9 rounded-lg border border-dashed border-white/[0.07] flex items-center justify-center text-[8px] text-zinc-700">{p.uploadBusy?'Enviando mídia...':<><span className="ia-desktop-copy">{`Arraste ${acceptedReferenceLabels||'mídia'} aqui`}</span><span className="ia-mobile-copy">Adicionar referência</span></>}</div>}</section>}
      <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt={p.negativePrompt} onChangeNegativePrompt={p.onChangeNegativePrompt} onOpenImproveModal={p.onOpenImproveModal} references={generalRefs} onRequestAddMedia={()=>p.onOpenPicker('GENERAL')} supportsNegativePrompt={caps?.supports_negative_prompt===true} supportsReferences={supportsGeneralReferences} maxChars={caps?.max_prompt_length||4000}/>
      <div className="space-y-1.5">{durations.length>0&&<GeneratorSettingRow icon={Clock3} label="Duração" value={`${p.durationSeconds}s`} open={openCard==='duration'} onToggle={()=>setOpenCard(openCard==='duration'?null:'duration')} semantic="duration"><GeneratorDiscreteSlider values={durations} value={p.durationSeconds} onChange={p.onChangeDuration} suffix="s" subtitle="duração do vídeo" rightLabel={p.unitPriceCents!=null?'preço fixo':undefined} rightValue={p.unitPriceCents!=null?`${formatCredits(p.unitPriceCents)} / segundo`:undefined}/></GeneratorSettingRow>}{ratios.length>0&&<GeneratorSettingRow icon={Ratio} label="Proporção" value={p.aspectRatio} open={openCard==='ratio'} onToggle={()=>setOpenCard(openCard==='ratio'?null:'ratio')} semantic="ratio"><GeneratorOptionGrid values={ratios.map(value=>({value:String(value),label:String(value)}))} current={p.aspectRatio} onSelect={p.onChangeAspectRatio}/></GeneratorSettingRow>}{resolutions.length>0&&<GeneratorSettingRow icon={SlidersHorizontal} label={resolutionLabel} value={p.resolution} open={openCard==='resolution'} onToggle={()=>setOpenCard(openCard==='resolution'?null:'resolution')} semantic="resolution"><GeneratorOptionGrid values={resolutions.map(value=>({value:String(value),label:String(value)}))} current={p.resolution} onSelect={p.onChangeResolution}/></GeneratorSettingRow>}</div>
      {hasAdvanced&&<section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={p.onToggleAdvanced} className="w-full h-10 px-3 flex items-center gap-2 text-[10px] font-semibold text-zinc-400"><Settings2 className="w-3.5 h-3.5"/> Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${p.showAdvanced?'rotate-180':''}`}/></button>{p.showAdvanced&&<div className={`px-3 pb-3 grid gap-2 ${supportsSeed&&supportsMotion?'grid-cols-2':'grid-cols-1'}`}>{supportsSeed&&<label className="text-[8px] text-zinc-600">Seed<input value={p.seed} onChange={(e)=>p.onChangeSeed(e.target.value===''?'':Number(e.target.value))} type="number" placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label>}{supportsMotion&&<label className="text-[8px] text-zinc-600">Movimento<input value={p.motionStrength} onChange={(e)=>p.onChangeMotionStrength(Number(e.target.value))} type="range" min="0" max="10" className="mt-2 w-full accent-cyan-400"/></label>}</div>}</section>}
      {p.modelAdjustmentNotice&&<div role="status" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-2 text-[9px] leading-relaxed text-cyan-100">Configuração ajustada automaticamente · {p.modelAdjustmentNotice}</div>}
  </UniversalCreatorShell>;
};
