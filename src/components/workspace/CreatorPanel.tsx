import React,{useState}from'react';
import{ChevronDown,Clock3,Image as ImageIcon,Layers3,Music2,Ratio,Settings2,SlidersHorizontal,UploadCloud,WandSparkles,X}from'lucide-react';
import{Asset,GenerationMode,ModelCapabilities,ModelRegistryItem,WorkspaceReference}from'../../types/index.js';
import{CompactModelPicker}from'./CompactModelPicker.js';
import{PromptComposer}from'./PromptComposer.js';
import{formatCredits}from'../../utils/creditFormat.js';

interface Props{
 models:ModelRegistryItem[];selectionMode:'AUTO'|'MANUAL';selectedModelId:string;autoResolvedModel?:ModelRegistryItem|null;
 onSelectAuto:()=>void;onSelectModel:(m:ModelRegistryItem)=>void;favoriteModelIds:string[];recentModelIds:string[];onToggleFavorite:(id:string)=>void;
 initialImage:Asset|null;endImage:Asset|null;references:WorkspaceReference[];
 onOpenPicker:(s:'INITIAL'|'END'|'GENERAL')=>void;onRemoveSlot:(s:'INITIAL'|'END')=>void;onRemoveReference:(id:string)=>void;
 onConfigureReference:(r:WorkspaceReference)=>void;onQuickUpload?:(target:'INITIAL'|'END'|'GENERAL',files:File[])=>void;uploadBusy?:boolean;
 resolvedMode:GenerationMode;modeExplanation?:string;prompt:string;onChangePrompt:(t:string)=>void;negativePrompt:string;onChangeNegativePrompt:(t:string)=>void;onOpenImproveModal:()=>void;
 aspectRatio:string;onChangeAspectRatio:(v:string)=>void;durationSeconds:number;onChangeDuration:(v:number)=>void;resolution:string;onChangeResolution:(v:string)=>void;
 capabilities:ModelCapabilities|null;showAdvanced:boolean;onToggleAdvanced:()=>void;seed:number|'';onChangeSeed:(v:number|'')=>void;motionStrength:number;onChangeMotionStrength:(v:number)=>void;
 audioEnabled:boolean;onChangeAudioEnabled:(v:boolean)=>void;
 totalEstimatedCostCents:number|null;availableBalanceCents:number;hasSufficientFunds:boolean;onGenerate:()=>void;validating:boolean;generating?:boolean;validationErrors:string[];generationError?:string;
 livePricesByModelId?:Record<string,number|null>;priceLoadingModelIds?:string[];adaptationLabelsByModelId?:Record<string,string>;blockedReasonsByModelId?:Record<string,string>;adaptationNotice?:string;
}
type OpenCard='duration'|'ratio'|'resolution'|null;
const filesFromDrop=(e:React.DragEvent)=>Array.from(e.dataTransfer.files||[]);
const modeLabel=(mode:GenerationMode)=>mode==='IMAGE_TO_VIDEO'?'Imagem → vídeo':mode==='REFERENCE_TO_VIDEO'?'Referências → vídeo':mode==='VIDEO_TO_VIDEO'?'Vídeo → vídeo':'Texto → vídeo';

export const CreatorPanel:React.FC<Props>=(p)=>{
 const[openCard,setOpenCard]=useState<OpenCard>(null),[dragTarget,setDragTarget]=useState<'INITIAL'|'END'|'GENERAL'|null>(null);
 const caps=p.capabilities;
 const canStart=Boolean(caps?.supports_image_reference&&caps.supported_modes.includes('IMAGE_TO_VIDEO'));
 const canEnd=Boolean(canStart&&caps?.supports_start_end_image);
 const canGeneral=Boolean(caps?.supported_modes.includes('REFERENCE_TO_VIDEO')&&(caps.supports_image_reference||caps.supports_video_reference||caps.supports_audio_reference));
 const frameMode=Boolean(p.initialImage||p.endImage);
 const canGenerate=p.prompt.trim().length>0&&p.hasSufficientFunds&&!p.validating&&!p.generating&&p.validationErrors.length===0;
 const durations=caps?.supported_durations?.length?[...caps.supported_durations].sort((a,b)=>a-b):[5];
 const ratios=caps?.supported_aspect_ratios?.length?caps.supported_aspect_ratios:['16:9'];
 const resolutions=caps?.supported_resolutions?.length?caps.supported_resolutions:['720p'];
 const durationIndex=Math.max(0,durations.findIndex(v=>v===p.durationSeconds));
 const acceptedRefs=[caps?.supports_image_reference?'imagem':'',caps?.supports_video_reference?'vídeo':'',caps?.supports_audio_reference?'áudio':''].filter(Boolean).join(' · ');
 const hasAdvanced=Boolean(caps?.audio_generation_mode==='OPTIONAL'||caps?.supports_seed||caps?.supports_motion_strength);
 const acceptDrop=(target:'INITIAL'|'END'|'GENERAL',e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();setDragTarget(null);const files=filesFromDrop(e);if(files.length)p.onQuickUpload?.(target,files)};
 const optionGrid=(values:Array<string|number>,current:string|number,select:(v:any)=>void)=><div className="flex flex-wrap gap-1.5">{values.map(value=><button key={String(value)} type="button" onClick={()=>select(value)} className={`min-w-12 px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${String(current)===String(value)?'border-cyan-300/35 bg-cyan-300/10 text-cyan-200':'border-white/[0.06] bg-black/15 text-zinc-500 hover:text-zinc-200'}`}>{value}</button>)}</div>;
 const settingRow=(id:Exclude<OpenCard,null>,icon:any,label:string,value:string,body:React.ReactNode)=>{const Icon=icon,opened=openCard===id;return <div className={`rounded-xl border transition-colors ${opened?'border-cyan-300/20 bg-cyan-300/[0.035]':'border-white/[0.065] bg-white/[0.025]'}`}><button type="button" onClick={()=>setOpenCard(opened?null:id)} className="h-10 w-full px-3 flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-zinc-500"/><span className="text-[10px] font-semibold text-zinc-300">{label}</span><span className="ml-auto text-[10px] font-bold text-white">{value}</span><ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${opened?'rotate-180':''}`}/></button>{opened&&<div className="px-2.5 pb-2.5 pt-0.5">{body}</div>}</div>};
 const frameCard=(asset:Asset|null,label:string,target:'INITIAL'|'END',enabled:boolean)=>{
  const blocked=!enabled;
  return <div onDragEnter={e=>{if(!blocked){e.preventDefault();setDragTarget(target)}}} onDragOver={e=>{if(!blocked)e.preventDefault()}} onDragLeave={()=>setDragTarget(v=>v===target?null:v)} onDrop={e=>{if(!blocked)acceptDrop(target,e)}} className={`relative h-[76px] rounded-xl border overflow-hidden ${blocked&&!asset?'border-white/[0.04] bg-white/[0.012] opacity-45':'border-white/[0.07] bg-white/[0.025]'} ${dragTarget===target?'border-cyan-300/55 bg-cyan-300/[0.08]':''}`}>
   <button type="button" disabled={blocked} onClick={()=>p.onOpenPicker(target)} className="absolute inset-0 w-full h-full text-left disabled:cursor-not-allowed">
    {asset?.public_url?<img src={asset.thumbnail_url||asset.public_url} className="absolute inset-0 w-full h-full object-cover" alt=""/>:<div className="h-full grid place-items-center"><div className="text-center"><ImageIcon className="w-4 h-4 mx-auto text-zinc-600"/><p className="mt-1 text-[9px] font-semibold text-zinc-400">{label}</p><p className="text-[7px] text-zinc-700">{blocked?'não disponível':'clique ou arraste'}</p></div></div>}
   </button>
   {asset&&<><span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[7px] font-bold text-white">{label}</span><button type="button" onClick={()=>p.onRemoveSlot(target)} className="absolute right-1.5 top-1.5 w-5 h-5 rounded-md bg-black/70 grid place-items-center text-white"><X className="w-3 h-3"/></button></>}
  </div>;
 };
 const referencesCard=<div onDragEnter={e=>{if(canGeneral){e.preventDefault();setDragTarget('GENERAL')}}} onDragOver={e=>{if(canGeneral)e.preventDefault()}} onDragLeave={()=>setDragTarget(v=>v==='GENERAL'?null:v)} onDrop={e=>{if(canGeneral)acceptDrop('GENERAL',e)}} className={`relative min-h-[76px] rounded-xl border p-2 ${canGeneral?'border-white/[0.07] bg-white/[0.025]':'border-white/[0.04] bg-white/[0.012] opacity-50'} ${dragTarget==='GENERAL'?'border-cyan-300/55 bg-cyan-300/[0.08]':''}`}>
  <button type="button" disabled={!canGeneral} onClick={()=>p.onOpenPicker('GENERAL')} className="absolute inset-0 w-full h-full rounded-xl disabled:cursor-not-allowed"/>
  <div className="relative pointer-events-none h-full flex items-center gap-2"><div className="w-9 h-9 rounded-lg border border-white/[0.06] bg-black/20 grid place-items-center shrink-0"><Layers3 className="w-4 h-4 text-zinc-500"/></div><div className="min-w-0"><p className="text-[9px] font-semibold text-zinc-300">Referências</p><p className="text-[7px] text-zinc-700 truncate">{frameMode&&canGeneral?'substitui os frames':acceptedRefs||'não suportado'}</p>{p.references.length>0&&<p className="mt-1 text-[8px] font-bold text-cyan-300">{p.references.length} anexada{p.references.length===1?'':'s'}</p>}</div></div>
  {p.references.length>0&&<div className="relative mt-2 flex gap-1 pointer-events-auto">{p.references.slice(0,4).map(ref=><div key={ref.asset_id} onDoubleClick={()=>p.onConfigureReference(ref)} className="relative w-8 h-8 rounded-md border border-white/[0.08] overflow-hidden bg-black/20">{ref.asset?.thumbnail_url||ref.asset?.public_url?<img src={ref.asset.thumbnail_url||ref.asset.public_url} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full grid place-items-center text-[7px] text-zinc-600">{ref.asset?.type?.slice(0,1)||'R'}</div>}<button type="button" onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute top-0 right-0 w-3.5 h-3.5 rounded-bl bg-black/80 grid place-items-center text-white"><X className="w-2 h-2"/></button></div>)}{p.references.length>4&&<span className="self-center text-[8px] text-zinc-600">+{p.references.length-4}</span>}</div>}
 </div>;

 return <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
   <CompactModelPicker models={p.models} selectionMode={p.selectionMode} selectedModelId={p.selectedModelId} autoResolvedModel={p.autoResolvedModel} onSelectAuto={p.onSelectAuto} onSelectModel={p.onSelectModel} favoriteModelIds={p.favoriteModelIds} recentModelIds={p.recentModelIds} onToggleFavorite={p.onToggleFavorite} livePricesByModelId={p.livePricesByModelId} priceLoadingModelIds={p.priceLoadingModelIds} adaptationLabelsByModelId={p.adaptationLabelsByModelId} blockedReasonsByModelId={p.blockedReasonsByModelId}/>
   {p.adaptationNotice&&<div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] px-3 py-2 text-[8px] leading-relaxed text-cyan-100"><span className="font-bold">Ajustado automaticamente.</span> {p.adaptationNotice}</div>}
   <section>
    <div className="mb-1.5 flex items-center justify-between"><div><p className="text-[9px] font-bold text-zinc-400">Entradas</p><p className="text-[7.5px] text-zinc-700">{modeLabel(p.resolvedMode)}{caps?.audio_generation_mode==='ALWAYS'?' · áudio incluído':''}</p></div><span className="text-[7px] text-zinc-700">clique, cole ou arraste</span></div>
    <div className={`grid gap-2 ${canEnd||p.endImage?'grid-cols-3':'grid-cols-2'}`}>{frameCard(p.initialImage,'Início','INITIAL',canStart)}{(canEnd||p.endImage)&&frameCard(p.endImage,'Final','END',canEnd)}{referencesCard}</div>
   </section>
   <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt={p.negativePrompt} onChangeNegativePrompt={p.onChangeNegativePrompt} onOpenImproveModal={p.onOpenImproveModal} references={p.references} onRequestAddMedia={()=>p.onOpenPicker('GENERAL')} supportsNegativePrompt={caps?.supports_negative_prompt===true} maxChars={caps?.max_prompt_length||4000}/>
   <div className="space-y-1.5">
    {settingRow('duration',Clock3,'Duração',`${p.durationSeconds}s`,<div className="px-1 pt-1"><input aria-label="Duração do vídeo" type="range" min={0} max={Math.max(0,durations.length-1)} step={1} value={durationIndex} disabled={durations.length<=1} onChange={e=>p.onChangeDuration(durations[Number(e.target.value)]??durations[0])} className="w-full h-1.5 accent-cyan-300"/><div className="mt-1.5 flex justify-between text-[7px] text-zinc-700"><span>{durations[0]}s</span><span>{durations[durations.length-1]}s</span></div></div>)}
    {settingRow('resolution',SlidersHorizontal,'Resolução',p.resolution,optionGrid(resolutions,p.resolution,p.onChangeResolution))}
    {settingRow('ratio',Ratio,'Proporção',p.aspectRatio,optionGrid(ratios,p.aspectRatio,p.onChangeAspectRatio))}
   </div>
   {hasAdvanced&&<section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button type="button" onClick={p.onToggleAdvanced} className="w-full h-10 px-3 flex items-center gap-2 text-[10px] font-semibold text-zinc-400"><Settings2 className="w-3.5 h-3.5"/> Avançado <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${p.showAdvanced?'rotate-180':''}`}/></button>{p.showAdvanced&&<div className="px-3 pb-3 space-y-3">
    {caps?.audio_generation_mode==='OPTIONAL'&&<label className="flex items-center justify-between gap-3"><span><span className="flex items-center gap-1.5 text-[9px] font-semibold text-zinc-300"><Music2 className="w-3.5 h-3.5"/> Áudio nativo</span><span className="text-[7px] text-zinc-700">gera som junto com o vídeo</span></span><button type="button" onClick={()=>p.onChangeAudioEnabled(!p.audioEnabled)} className={`w-9 h-5 rounded-full p-0.5 transition-colors ${p.audioEnabled?'bg-cyan-300':'bg-white/[0.08]'}`}><span className={`block w-4 h-4 rounded-full bg-[#071015] transition-transform ${p.audioEnabled?'translate-x-4':'translate-x-0'}`}/></button></label>}
    {caps?.supports_seed&&<label className="text-[8px] text-zinc-600">Seed<input value={p.seed} onChange={e=>p.onChangeSeed(e.target.value===''?'':Number(e.target.value))} type="number" placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label>}
    {caps?.supports_motion_strength&&<label className="text-[8px] text-zinc-600">Força de movimento<input value={p.motionStrength} onChange={e=>p.onChangeMotionStrength(Number(e.target.value))} type="range" min="0" max="10" className="mt-2 w-full accent-cyan-400"/></label>}
   </div>}</section>}
   {(p.validationErrors[0]||p.generationError)&&<div role="alert" className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-[9px] text-rose-300">{p.validationErrors[0]||p.generationError}</div>}
  </div>
  <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#080b0f]"><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] uppercase tracking-wider text-zinc-700">Preço</p><p className="text-[11px] font-bold text-white">{p.totalEstimatedCostCents==null?'Cotando...':formatCredits(p.totalEstimatedCostCents)}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className={`text-[10px] font-semibold ${p.hasSufficientFunds?'text-zinc-400':'text-rose-400'}`}>{formatCredits(p.availableBalanceCents)}</p></div></div><button disabled={!canGenerate} onClick={p.onGenerate} className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 text-[#071015] text-[11px] font-black flex items-center justify-center gap-2 disabled:opacity-35 disabled:grayscale hover:brightness-110"><WandSparkles className="w-4 h-4"/>{p.generating?'Gerando...':p.validating?'Validando...':p.totalEstimatedCostCents==null?'Aguardando preço':`Gerar vídeo · ${formatCredits(p.totalEstimatedCostCents)}`}</button></div>
 </aside>;
};
