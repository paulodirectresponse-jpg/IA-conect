import React,{useMemo,useState}from'react';
import{ChevronDown,Image as ImageIcon,Layers3,Plus,Ratio,Settings2,SlidersHorizontal,UploadCloud,X}from'lucide-react';
import{Asset,ModelRegistryItem,WorkspaceReference}from'../../types/index.js';
import{UniversalModelPicker}from'./UniversalModelPicker.js';
import{GeneratorFooter,GeneratorOptionGrid,GeneratorSettingRow,UniversalCreatorShell}from'./GeneratorControls.js';
import{PromptComposer}from'./PromptComposer.js';
import{CreditAmount}from'../common/CreditAmount.js';
import{getModelCapabilities}from'../../services/modelCapabilities.js';
import{getImageModelCoverSources}from'../../config/imageModelCovers.js';

interface Props{
 models:ModelRegistryItem[];selectionMode:'AUTO'|'MANUAL';selectedModelId:string;autoResolvedModel?:ModelRegistryItem|null;
 onSelectAuto:()=>void;onSelectModel:(m:ModelRegistryItem)=>void;favoriteModelIds:string[];recentModelIds:string[];onToggleFavorite:(id:string)=>void;
 references:WorkspaceReference[];onOpenPicker:()=>void;onRemoveReference:(id:string)=>void;onQuickUpload:(files:File[])=>void;uploadBusy:boolean;hasPendingReferences?:boolean;
 prompt:string;onChangePrompt:(v:string)=>void;aspectRatio:string;onChangeAspectRatio:(v:string)=>void;resolution:string;onChangeResolution:(v:string)=>void;
 numberOfOutputs:number;onChangeNumberOfOutputs:(v:number)=>void;availableResolutions:string[];activeModel:ModelRegistryItem|null;
 showAdvanced:boolean;onToggleAdvanced:()=>void;seed:number|'';onChangeSeed:(v:number|'')=>void;
 totalPrice:number|null;unitPrice:number|null;balance:number;hasBalance:boolean;generating:boolean;priceLoading:boolean;onGenerate:()=>void;error?:string;modelAdjustmentNotice?:string;
 unitPricesByModelId:Record<string,number|null>;priceLoadingModelIds:string[];
}
type OpenCard='ratio'|'resolution'|'outputs'|null;
const filesFromDrop=(e:React.DragEvent)=>Array.from(e.dataTransfer.files||[]);

export const UnifiedImageCreatorPanel:React.FC<Props>=(p)=>{
 const[openCard,setOpenCard]=useState<OpenCard>(null),[dragging,setDragging]=useState(false);
 const caps=p.activeModel?getModelCapabilities(p.activeModel):null;
 const selectedCoverSources=p.selectionMode==='MANUAL'?getImageModelCoverSources(p.selectedModelId):null;
 const supportsSeed=Boolean(caps?.supports_seed);
 const ratios=p.activeModel?.supported_aspect_ratios||[];
 const activeAliases=useMemo(()=>new Set(p.references.filter(r=>p.prompt.toLowerCase().includes(`@${r.alias_snapshot.toLowerCase()}`)).map(r=>r.asset_id)),[p.references,p.prompt]);
 return <UniversalCreatorShell
  ariaLabel="Gerador de imagem"
  className="ia-generator-panel-image"
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
   selectedCoverSources={selectedCoverSources}
  />}
  footer={<GeneratorFooter
   error={p.error}
   notice={p.generating&&!p.error?'Enviando esta geração. Você poderá iniciar outra assim que ela entrar na fila.':undefined}
   price={p.totalPrice}
   balance={p.balance}
   hasBalance={p.hasBalance}
   primaryLabel={p.hasPendingReferences?'Gerar assim que a imagem enviar':'Gerar imagem'}
   primaryPrice={!p.hasPendingReferences?p.totalPrice:null}
   onPrimary={p.onGenerate}
   primaryDisabled={p.generating||!p.prompt.trim()||(!p.hasPendingReferences&&(p.priceLoading||p.totalPrice==null||!p.hasBalance))}
   primaryBusy={p.generating}
  />}
 >
   {caps?.supports_image_reference===true&&<section onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const files=filesFromDrop(e);if(files.length)p.onQuickUpload(files)}} className={`ia-reference-panel rounded-xl border p-2.5 transition-colors ${dragging?'border-cyan-300/50 bg-cyan-300/[0.06]':'border-white/[0.065] bg-white/[0.025]'}`}>
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-300">Referências</p><p className="text-[8px] text-zinc-700"><span className="ia-desktop-copy">Cole, arraste ou escolha uma imagem</span><span className="ia-mobile-copy">Toque para adicionar uma imagem</span></p></div><button disabled={!caps?.supports_image_reference} onClick={p.onOpenPicker} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.035] grid place-items-center text-zinc-400 hover:text-white disabled:opacity-30"><Plus className="w-3.5 h-3.5"/></button></div>
    {p.references.length?<div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">{p.references.map(ref=><div key={ref.asset_id} className={`ia-reference-thumb relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${activeAliases.has(ref.asset_id)?'border-cyan-300 ring-2 ring-cyan-300/10':'border-white/[0.07]'}`}>{ref.asset?.public_url?<img src={ref.asset.thumbnail_url||ref.asset.public_url} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full grid place-items-center"><ImageIcon className="w-4 h-4 text-zinc-700"/></div>}<button onClick={()=>p.onRemoveReference(ref.asset_id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 grid place-items-center"><X className="w-2.5 h-2.5"/></button>{ref.asset?.status==='UPLOADING'&&<span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-center text-[6px] font-bold text-cyan-200">enviando…</span>}{activeAliases.has(ref.asset_id)&&ref.asset?.status!=='UPLOADING'&&<span className="absolute left-1 bottom-1 px-1 py-0.5 rounded bg-cyan-300 text-[6.5px] font-black uppercase text-[#071015]">em uso</span>}</div>)}</div>:<div className="ia-reference-dropzone mt-2 h-9 rounded-lg border border-dashed border-white/[0.07] flex items-center justify-center gap-1.5 text-[8px] text-zinc-700"><UploadCloud className="w-3.5 h-3.5"/>{p.uploadBusy?'Enviando mídia...':<><span className="ia-desktop-copy">Arraste uma imagem aqui</span><span className="ia-mobile-copy">Adicionar referência</span></>}</div>}
   </section>}
   <PromptComposer prompt={p.prompt} onChangePrompt={p.onChangePrompt} negativePrompt="" onChangeNegativePrompt={()=>{}} onOpenImproveModal={()=>{}} references={p.references} onRequestAddMedia={p.onOpenPicker} supportsNegativePrompt={false} supportsReferences={caps?.supports_image_reference===true} maxChars={caps?.max_prompt_length||10000}/>
   <div className="space-y-1.5">
    {ratios.length>0&&<GeneratorSettingRow icon={Ratio} label="Proporção" value={p.aspectRatio} open={openCard==='ratio'} onToggle={()=>setOpenCard(openCard==='ratio'?null:'ratio')} semantic="ratio"><GeneratorOptionGrid values={ratios.map(value=>({value:String(value),label:String(value)}))} current={p.aspectRatio} onSelect={p.onChangeAspectRatio}/></GeneratorSettingRow>}
    {p.availableResolutions.length>0&&<GeneratorSettingRow icon={SlidersHorizontal} label="Resolução" value={p.resolution} open={openCard==='resolution'} onToggle={()=>setOpenCard(openCard==='resolution'?null:'resolution')} semantic="resolution"><GeneratorOptionGrid values={p.availableResolutions.map(value=>({value:String(value),label:String(value)}))} current={p.resolution} onSelect={p.onChangeResolution}/></GeneratorSettingRow>}
    {(Number(p.activeModel?.supported_controls?.max_outputs)||0)>1&&<GeneratorSettingRow icon={Layers3} label="Quantidade" value={String(p.numberOfOutputs)} open={openCard==='outputs'} onToggle={()=>setOpenCard(openCard==='outputs'?null:'outputs')} semantic="outputs"><div><GeneratorOptionGrid values={Array.from({length:Math.min(4,Number(p.activeModel?.supported_controls?.max_outputs)||1)},(_,index)=>({value:String(index+1),label:String(index+1)}))} current={String(p.numberOfOutputs)} onSelect={value=>p.onChangeNumberOfOutputs(Number(value))}/>{p.unitPrice!=null&&<p className="mt-2 flex items-center gap-1 text-[8px] text-zinc-600"><CreditAmount value={p.unitPrice} size="xs"/> <span>por imagem · preço fixo × quantidade</span></p>}</div></GeneratorSettingRow>}
   </div>
   {supportsSeed&&<section className="rounded-xl border border-white/[0.065] bg-white/[0.025] overflow-hidden"><button onClick={p.onToggleAdvanced} className="w-full h-10 px-3 flex items-center gap-2 text-[10px] font-semibold text-zinc-400"><Settings2 className="w-3.5 h-3.5"/> Configurações avançadas <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${p.showAdvanced?'rotate-180':''}`}/></button>{p.showAdvanced&&<div className="px-3 pb-3"><label className="text-[8px] text-zinc-600">Seed<input value={p.seed} onChange={e=>p.onChangeSeed(e.target.value===''?'':Number(e.target.value))} type="number" placeholder="Aleatório" className="mt-1 w-full h-8 px-2 rounded-lg bg-[#0b0e13] border border-white/[0.06] text-[9px] text-zinc-300 outline-none"/></label></div>}</section>}
   {p.modelAdjustmentNotice&&<div role="status" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-2 text-[9px] leading-relaxed text-cyan-100">Configuração ajustada automaticamente · {p.modelAdjustmentNotice}</div>}
 </UniversalCreatorShell>;
};
