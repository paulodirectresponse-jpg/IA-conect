import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Clock3,
  Image as ImageIcon,
  Layers3,
  Plus,
  Ratio,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  ModelRegistryItem,
  PricingEntry,
  WorkspaceReference,
  Asset,
  GenerationMode,
  ModelCapabilities,
} from '../../types/index.js';
import { PromptComposer } from './PromptComposer.js';
import { formatCentsToBRL } from '../../config/constants.js';

interface Props {
  models: ModelRegistryItem[];
  pricing: PricingEntry[];
  selectionMode: 'AUTO' | 'MANUAL';
  selectedModelId: string;
  autoResolvedModel?: ModelRegistryItem | null;
  onSelectAuto: () => void;
  onSelectModel: (m: ModelRegistryItem) => void;
  favoriteModelIds: string[];
  recentModelIds: string[];
  onToggleFavorite: (id: string) => void;
  initialImage: Asset | null;
  endImage: Asset | null;
  references: WorkspaceReference[];
  onOpenPicker: (s: 'INITIAL' | 'END' | 'GENERAL') => void;
  onRemoveSlot: (s: 'INITIAL' | 'END') => void;
  onRemoveReference: (id: string) => void;
  onConfigureReference: (r: WorkspaceReference) => void;
  resolvedMode: GenerationMode;
  modeExplanation?: string;
  prompt: string;
  onChangePrompt: (t: string) => void;
  negativePrompt: string;
  onChangeNegativePrompt: (t: string) => void;
  onOpenImproveModal: () => void;
  aspectRatio: string;
  onChangeAspectRatio: (v: string) => void;
  durationSeconds: number;
  onChangeDuration: (v: number) => void;
  resolution: string;
  onChangeResolution: (v: string) => void;
  numberOfOutputs: number;
  onChangeNumberOfOutputs: (v: number) => void;
  capabilities: ModelCapabilities | null;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  seed: number | '';
  onChangeSeed: (v: number | '') => void;
  motionStrength: number;
  onChangeMotionStrength: (v: number) => void;
  totalEstimatedCostCents: number | null;
  unitPriceCents: number | null;
  availableBalanceCents: number;
  hasSufficientFunds: boolean;
  onNavigateToWallet?: () => void;
  onGenerate: () => void;
  validating: boolean;
  validationErrors: string[];
}

type OpenCard = 'duration' | 'ratio' | 'resolution' | 'outputs' | null;

export const CreatorPanel: React.FC<Props> = (p) => {
  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const caps = p.capabilities;
  const activeModel = p.selectionMode === 'AUTO' ? p.autoResolvedModel : p.models.find((m) => m.model_id === p.selectedModelId);
  const canGenerate = p.prompt.trim().length > 0 && p.hasSufficientFunds && !p.validating && p.validationErrors.length === 0;
  const durations = caps?.supported_durations?.length ? caps.supported_durations : [5, 10, 15, 30];
  const ratios = caps?.supported_aspect_ratios?.length ? caps.supported_aspect_ratios : ['16:9','9:16','1:1'];
  const resolutions = caps?.supported_resolutions?.length ? caps.supported_resolutions : ['720p','1080p'];
  const generalRefs = p.references.filter((r) => !['START_FRAME','INITIAL_FRAME','END_FRAME'].includes(String(r.role || '').toUpperCase()));
  const costText = p.totalEstimatedCostCents == null ? 'Preço ao validar' : formatCentsToBRL(p.totalEstimatedCostCents);
  const activeAliases = useMemo(() => new Set(generalRefs.filter((r)=>p.prompt.includes(`@${r.alias_snapshot}`)).map((r)=>r.asset_id)), [generalRefs, p.prompt]);

  const slot = (asset: Asset | null, label: string, target: 'INITIAL'|'END') => <button type="button" disabled={target==='END' && !caps?.supports_start_end_image} onClick={()=>p.onOpenPicker(target)} className="relative h-[68px] rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025] disabled:opacity-35 text-left">
    {asset?.public_url ? <img src={asset.thumbnail_url || asset.public_url} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700"><ImageIcon className="w-4 h-4"/><span className="text-[9px]">{label}</span></div>}
    {asset && <><span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-semibold text-white">{label}</span><span onClick={(e)=>{e.stopPropagation();p.onRemoveSlot(target);}} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/70 grid place-items-center text-zinc-300"><X className="w-3 h-3"/></span></>}
  </button>;

  const optionGrid = (values: Array<string|number>, current: string|number, select: (v:any)=>void, suffix='') => <div className="flex flex-wrap gap-1.5">{values.map((value)=><button key={String(value)} type="button" onClick={()=>select(value)} className={`min-w-12 px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${String(current)===String(value)?'border-violet-400/40 bg-violet-400/15 text-violet-200':'border-white/[0.06] bg-black/15 text-zinc-500 hover:text-zinc-200'}`}>{value}{suffix}</button>)}</div>;

  const settingRow = (id: Exclude<OpenCard,null>, icon: any, label: string, value: string, body: React.ReactNode) => {
    const Icon = icon; const opened = openCard === id;
    return <div className={`rounded-xl border transition-colors ${opened ? 'border-violet-400/25 bg-violet-400/[0.045]' : 'border-white/[0.065] bg-white/[0.025]'}`}><button type="button" onClick={()=>setOpenCard(opened?null:id)} className="h-10 w-full px-3 flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-zinc-500"/><span className="text-[10px] font-semibold text-zinc-300">{label}</span><span className="ml-auto text-[10px] font-bold text-white">{value}</span><ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${opened?'rotate-180':''}`}/></button>{opened && <div className="px-2.5 pb-2.5 pt-0.5">{body}</div>}</div>;
  };

  return (
    <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        <section className="rounded-2xl border border-white/[0.07] bg-[#10141b] p-3">
          <div className="flex items-center gap-2 mb-2"><Video className="w-3.5 h-3.5 text-violet-300"/><span className="text-[9px] uppercase tracking-[0.16em] font-bold text-zinc-600">Modelo de IA</span></div>
          <div className="grid grid-cols-[74px_1fr] gap-2"><button onClick={p.onSelectAuto} className={`rounded-xl border px-2 py-2 text-[10px] font-bold flex items-center justify-center gap-1 ${p.selectionMode==='AUTO'?'border-violet-400/35 bg-violet-400/12 text-violet-200':'border-white/[0.065] text-zinc-500'}`}><Sparkles className="w-3 h-3"/> Auto</button><select value={p.selectionMode==='MANUAL'?p.selectedModelId:''} onChange={(e)=>{const m=p.models.find(x=>x.model_id===e.target.value); if(m)p.onSelectModel(m);}} className="h-9 rounded-xl bg-[#0b0e13] border border-white/[0.07] px-2.5 text-[10px] font-semibold text-zinc-200 outline-none"><option value="">Escolher IA</option>{p.models.map((m)=><option key={m.model_id} value={m.model_id}>{m.name}</option>)}</select></div>
          <p className="mt-2 text-[8px] text-zinc-650 truncate">{activeModel ? `${activeModel.name} · ${p.modeExplanation || 'rota compatível'}` : 'Auto encontra a melhor rota compatível'}</p>
        </section>

        <div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Frames</span><span className="text-[8px] text-zinc-750">separados das referências</span></div>
        <div className="grid grid-cols-2 gap-2">{slot(p.initialImage,'Imagem inicial','INITIAL')}{slot(p.endImage,'Imagem final','END')}</div>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700">Imagem, vídeo ou áudio</p></div><button onClick={()=>p.onOpenPicker('GENERAL')} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 hover:text-white"><Plus className="w-3.5 h-3.5"/></button></div>{generalRefs.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">{generalRefs.map((ref)=><div key={ref.asset_id} onDoubleClick={()=>p.onConfigureReference(ref)} className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${activeAliases.has(ref.asset_id)?'border-violet-400 ring-2 ring-violet-400/10':'border-white/[0.07]'}`}>{ref.asset?.public_url ? <img src={ref.asset.thumbnail_url||ref.asset.public_url} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center"><Layers3 className="w-4 h-4 text-zinc-700"/></div>}<button onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5"/></button></div>)}</div>}</section>

        <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt={p.negativePrompt} onChangeNegativePrompt={p.onChangeNegativePrompt} onOpenImproveModal={p.onOpenImproveModal} references={generalRefs} onRequestAddMedia={()=>p.onOpenPicker('GENERAL')} supportsNegativePrompt={caps?.supports_negative_prompt !== false} maxChars={caps?.max_prompt_length || 4000}/>

        <div className="space-y-1.5">{settingRow('duration',Clock3,'Duração',`${p.durationSeconds}s`,optionGrid(durations,p.durationSeconds,p.onChangeDuration,'s'))}{settingRow('ratio',Ratio,'Proporção',p.aspectRatio,optionGrid(ratios,p.aspectRatio,p.onChangeAspectRatio))}{settingRow('resolution',SlidersHorizontal,'Resolução',p.resolution,optionGrid(resolutions,p.resolution,p.onChangeResolution))}{settingRow('outputs',Layers3,'Variações',String(p.numberOfOutputs),optionGrid([1,2,3,4],p.numberOfOutputs,p.onChangeNumberOfOutputs))}</div>

        <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={p.onToggleAdvanced} className="w-full h-10 px-3 flex items-center gap-2 text-[10px] font-semibold text-zinc-400"><Settings2 className="w-3.5 h-3.5"/> Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${p.showAdvanced?'rotate-180':''}`}/></button>{p.showAdvanced && <div className="px-3 pb-3 grid grid-cols-2 gap-2"><label className="text-[8px] text-zinc-600">Seed<input value={p.seed} onChange={(e)=>p.onChangeSeed(e.target.value===''?'':Number(e.target.value))} type="number" placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label><label className="text-[8px] text-zinc-600">Movimento<input value={p.motionStrength} onChange={(e)=>p.onChangeMotionStrength(Number(e.target.value))} type="range" min="0" max="10" className="mt-2 w-full accent-violet-500"/></label></div>}</section>

        {p.validationErrors.length > 0 && <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300">{p.validationErrors[0]}</div>}
      </div>

      <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#080b0f]"><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] uppercase tracking-wider text-zinc-700">Estimativa</p><p className="text-[11px] font-bold text-white">{costText}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className={`text-[10px] font-semibold ${p.hasSufficientFunds?'text-zinc-400':'text-rose-400'}`}>{formatCentsToBRL(p.availableBalanceCents)}</p></div></div><button disabled={!canGenerate} onClick={p.onGenerate} className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white text-[11px] font-black flex items-center justify-center gap-2 shadow-[0_12px_35px_rgba(124,58,237,.18)] disabled:opacity-35 disabled:grayscale hover:brightness-110"><WandSparkles className="w-4 h-4"/>{p.validating?'Validando...':'Gerar vídeo'}</button></div>
    </aside>
  );
};
