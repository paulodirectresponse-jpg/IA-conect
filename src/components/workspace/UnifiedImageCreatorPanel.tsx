import React,{useState}from'react';
import{ChevronDown,Image as ImageIcon,Package,Palette,Ratio,Settings2,SlidersHorizontal,Sparkles,UploadCloud,UserRound,X}from'lucide-react';
import{ModelRegistryItem,WorkspaceReference}from'../../types/index.js';
import{AssetPickerContentView}from'./AssetPickerModal.js';
import{CompactModelPicker}from'./CompactModelPicker.js';
import{PromptComposer}from'./PromptComposer.js';
import{formatCredits}from'../../utils/creditFormat.js';
import{getModelCapabilities}from'../../services/modelCapabilities.js';

type SemanticRole='CHARACTER'|'PRODUCT'|'STYLE'|'GENERAL';
interface Props{
 models:ModelRegistryItem[];selectionMode:'AUTO'|'MANUAL';selectedModelId:string;autoResolvedModel?:ModelRegistryItem|null;
 onSelectAuto:()=>void;onSelectModel:(m:ModelRegistryItem)=>void;favoriteModelIds:string[];recentModelIds:string[];onToggleFavorite:(id:string)=>void;
 references:WorkspaceReference[];onOpenPicker:(view:AssetPickerContentView,role:SemanticRole)=>void;onRemoveReference:(id:string)=>void;onQuickUpload:(files:File[])=>void;uploadBusy:boolean;
 prompt:string;onChangePrompt:(v:string)=>void;aspectRatio:string;onChangeAspectRatio:(v:string)=>void;resolution:string;onChangeResolution:(v:string)=>void;
 availableResolutions:string[];activeModel:ModelRegistryItem|null;showAdvanced:boolean;onToggleAdvanced:()=>void;seed:number|'';onChangeSeed:(v:number|'')=>void;
 totalPrice:number|null;balance:number;hasBalance:boolean;generating:boolean;priceLoading:boolean;onGenerate:()=>void;error?:string;
 livePricesByModelId:Record<string,number|null>;priceLoadingModelIds:string[];adaptationLabelsByModelId?:Record<string,string>;blockedReasonsByModelId?:Record<string,string>;adaptationNotice?:string;
}
type OpenCard='ratio'|'resolution'|null;
const filesFromDrop=(e:React.DragEvent)=>Array.from(e.dataTransfer.files||[]);

export const UnifiedImageCreatorPanel:React.FC<Props>=(p)=>{
 const[openCard,setOpenCard]=useState<OpenCard>(null),[dragging,setDragging]=useState(false);
 const caps=p.activeModel?getModelCapabilities(p.activeModel):null;
 const ratios=caps?.supported_aspect_ratios?.length?caps.supported_aspect_ratios:['1:1','16:9','9:16'];
 const optionGrid=(values:Array<string|number>,current:string|number,select:(v:any)=>void)=><div className="flex flex-wrap gap-1.5">{values.map(value=><button key={String(value)} type="button" onClick={()=>select(value)} className={`min-w-12 px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold ${String(current)===String(value)?'border-cyan-300/35 bg-cyan-300/10 text-cyan-200':'border-white/[0.06] bg-black/15 text-zinc-500 hover:text-zinc-200'}`}>{value}</button>)}</div>;
 const settingRow=(id:Exclude<OpenCard,null>,icon:any,label:string,value:string,body:React.ReactNode)=>{const Icon=icon,opened=openCard===id;return <div className={`rounded-xl border transition-colors ${opened?'border-cyan-300/20 bg-cyan-300/[0.035]':'border-white/[0.065] bg-white/[0.025]'}`}><button type="button" onClick={()=>setOpenCard(opened?null:id)} className="h-10 w-full px-3 flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-zinc-500"/><span className="text-[10px] font-semibold text-zinc-300">{label}</span><span className="ml-auto text-[10px] font-bold text-white">{value}</span><ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${opened?'rotate-180':''}`}/></button>{opened&&<div className="px-2.5 pb-2.5 pt-0.5">{body}</div>}</div>};
 const refFor=(role:SemanticRole)=>p.references.find(ref=>String(ref.role||'GENERAL').toUpperCase()===role)||null;
 const quickSlots:Array<{role:SemanticRole;view:AssetPickerContentView;label:string;hint:string;icon:any}>=[
  {role:'CHARACTER',view:'CHARACTERS',label:'Pessoa',hint:'rosto ou personagem',icon:UserRound},
  {role:'PRODUCT',view:'PRODUCTS',label:'Produto',hint:'objeto principal',icon:Package},
  {role:'STYLE',view:'STYLES',label:'Estilo',hint:'visual e acabamento',icon:Palette},
  {role:'GENERAL',view:'ASSETS',label:'Referência',hint:'imagem livre',icon:ImageIcon},
 ];
 const slot=(item:(typeof quickSlots)[number])=>{const ref=refFor(item.role),Icon=item.icon,url=ref?.asset?.thumbnail_url||ref?.asset?.public_url;return <div key={item.role} className="relative h-[74px] rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025] group"><button type="button" disabled={!caps?.supports_image_reference} onClick={()=>p.onOpenPicker(item.view,item.role)} className="absolute inset-0 w-full h-full text-left disabled:opacity-35">{url?<img src={url} className="absolute inset-0 w-full h-full object-cover" alt=""/>:<div className="h-full grid place-items-center"><div className="text-center"><Icon className="w-4 h-4 mx-auto text-zinc-600"/><p className="mt-1 text-[8.5px] font-semibold text-zinc-400">{item.label}</p><p className="text-[6.5px] text-zinc-700">{item.hint}</p></div></div>}</button>{ref&&<><span className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded bg-black/70 text-[7px] font-bold text-white">@{ref.alias_snapshot}</span><button type="button" onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute right-1 top-1 w-4.5 h-4.5 rounded bg-black/70 grid place-items-center text-white"><X className="w-2.5 h-2.5"/></button></>}</div>};
 const assignedIds=new Set(quickSlots.map(s=>refFor(s.role)?.asset_id).filter(Boolean));
 const extras=p.references.filter(ref=>!assignedIds.has(ref.asset_id));
 return <aside className="w-full md:w-[344px] xl:w-[356px] h-full shrink-0 bg-[#090c11] border-r border-white/[0.06] flex flex-col">
  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
   <CompactModelPicker models={p.models} selectionMode={p.selectionMode} selectedModelId={p.selectedModelId} autoResolvedModel={p.autoResolvedModel} onSelectAuto={p.onSelectAuto} onSelectModel={p.onSelectModel} favoriteModelIds={p.favoriteModelIds} recentModelIds={p.recentModelIds} onToggleFavorite={p.onToggleFavorite} livePricesByModelId={p.livePricesByModelId} priceLoadingModelIds={p.priceLoadingModelIds} adaptationLabelsByModelId={p.adaptationLabelsByModelId} blockedReasonsByModelId={p.blockedReasonsByModelId}/>
   {p.adaptationNotice&&<div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] px-3 py-2 text-[8px] leading-relaxed text-cyan-100"><span className="font-bold">Ajustado automaticamente.</span> {p.adaptationNotice}</div>}
   <section onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const files=filesFromDrop(e);if(files.length)p.onQuickUpload(files)}} className={`rounded-xl border p-2.5 transition-colors ${dragging?'border-cyan-300/50 bg-cyan-300/[0.06]':'border-white/[0.055] bg-white/[0.012]'}`}>
    <div className="flex items-center justify-between mb-2"><div><p className="text-[9px] font-bold text-zinc-400">Referências rápidas</p><p className="text-[7px] text-zinc-700">opcional · clique ou arraste</p></div>{p.references.length>0&&<span className="text-[7.5px] text-cyan-300">{p.references.length}/{caps?.max_reference_images||0}</span>}</div>
    <div className="grid grid-cols-4 gap-1.5">{quickSlots.map(slot)}</div>
    {extras.length>0&&<div className="mt-2 flex gap-1">{extras.slice(0,4).map(ref=><div key={ref.asset_id} className="relative w-8 h-8 rounded-md overflow-hidden border border-white/[0.07]">{ref.asset?.thumbnail_url||ref.asset?.public_url?<img src={ref.asset.thumbnail_url||ref.asset.public_url} className="w-full h-full object-cover" alt=""/>:<UploadCloud className="w-3 h-3 m-2 text-zinc-600"/>}<button type="button" onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/80 grid place-items-center"><X className="w-2 h-2"/></button></div>)}{extras.length>4&&<span className="self-center text-[8px] text-zinc-600">+{extras.length-4}</span>}</div>}
   </section>
   <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt="" onChangeNegativePrompt={()=>{}} onOpenImproveModal={()=>{}} references={p.references} onRequestAddMedia={()=>p.onOpenPicker('ASSETS','GENERAL')} supportsNegativePrompt={false} maxChars={caps?.max_prompt_length||10000}/>
   <div className="space-y-1.5">{settingRow('ratio',Ratio,'Proporção',p.aspectRatio,optionGrid(ratios,p.aspectRatio,p.onChangeAspectRatio))}{settingRow('resolution',SlidersHorizontal,'Resolução',p.resolution,optionGrid(p.availableResolutions,p.resolution,p.onChangeResolution))}</div>
   {caps?.supports_seed&&<section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button type="button" onClick={p.onToggleAdvanced} className="w-full h-10 px-3 flex items-center gap-2 text-[10px] font-semibold text-zinc-400"><Settings2 className="w-3.5 h-3.5"/> Avançado <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${p.showAdvanced?'rotate-180':''}`}/></button>{p.showAdvanced&&<div className="px-3 pb-3"><label className="text-[8px] text-zinc-600">Seed<input value={p.seed} onChange={e=>p.onChangeSeed(e.target.value===''?'':Number(e.target.value))} type="number" placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label></div>}</section>}
  </div>
  <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#080b0f]">{p.error&&<div role="alert" aria-live="assertive" className="mb-2 rounded-xl border border-rose-400/15 bg-rose-500/[0.08] px-3 py-2 text-[9px] leading-relaxed text-rose-300">{p.error}</div>}{p.generating&&!p.error&&<div aria-live="polite" className="mb-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] px-3 py-2 text-[9px] text-cyan-200">Geração enviada. Aguardando o processamento...</div>}<div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] uppercase tracking-wider text-zinc-700">Preço</p><p className="text-[11px] font-bold text-white">{p.totalPrice==null?'Cotando...':formatCredits(p.totalPrice)}</p></div><div className="text-right"><p className="text-[8px] text-zinc-700">Saldo</p><p className={`text-[10px] font-semibold ${p.hasBalance?'text-zinc-400':'text-rose-400'}`}>{formatCredits(p.balance)}</p></div></div><button disabled={p.generating||p.priceLoading||!p.prompt.trim()||p.totalPrice==null||!p.hasBalance} onClick={p.onGenerate} className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 text-[#071015] text-[11px] font-black flex items-center justify-center gap-2 disabled:opacity-35 disabled:grayscale hover:brightness-110"><Sparkles className="w-4 h-4"/>{p.generating?'Gerando...':p.totalPrice==null?'Aguardando preço':`Gerar imagem · ${formatCredits(p.totalPrice)}`}</button></div>
 </aside>;
};
