import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Brush,CheckCircle2,Download,Eraser,Expand,FolderOpen,Image as ImageIcon,Layers,LoaderCircle,Minus,Plus,RefreshCw,RemoveFormatting,RotateCcw,Scaling,Sparkles,Upload,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{apiRequest,ApiError}from'../../services/apiClient.js';
import{editorClient,EditorCapability,EditorJobView}from'../../services/editorClient.js';
import{Asset}from'../../types/index.js';
import{EditorWorkspaceShell}from'../editors/shared/EditorWorkspaceShell.js';
import{EditorAssetPicker}from'../editors/shared/EditorAssetPicker.js';
import{ImageEditorCanvas,ImageEditorViewMode}from'../editors/image/ImageEditorCanvas.js';
import{StableGeneratorModelPicker}from'../workspace/StableGeneratorModelPicker.js';

type Tool=Extract<EditorCapability,'image-edit'|'inpaint-mask'|'background-remove-replace'|'outpaint'|'upscale'|'variations'>;
const TOOLS:Array<{id:Tool;label:string;shortLabel:string;description:string;icon:React.ComponentType<{className?:string}>}>=[
 {id:'image-edit',label:'Editar imagem',shortLabel:'Editar',description:'Transforme a imagem a partir de uma instrução.',icon:WandSparkles},
 {id:'inpaint-mask',label:'Inpaint',shortLabel:'Inpaint',description:'Pinte uma área e altere somente a região selecionada.',icon:Brush},
 {id:'background-remove-replace',label:'Fundo',shortLabel:'Fundo',description:'Remova o fundo ou substitua por uma nova cena.',icon:RemoveFormatting},
 {id:'outpaint',label:'Expandir',shortLabel:'Expandir',description:'Amplie a cena para outra proporção sem destruir o original.',icon:Expand},
 {id:'upscale',label:'Upscale',shortLabel:'Upscale',description:'Aumente a resolução preservando o conteúdo.',icon:Scaling},
 {id:'variations',label:'Variações',shortLabel:'Variações',description:'Crie uma nova versão visual a partir da imagem original.',icon:Layers},
];
const promptRequired=(tool:Tool,backgroundMode:'TRANSPARENT'|'REPLACE')=>['image-edit','inpaint-mask','outpaint'].includes(tool)||(tool==='background-remove-replace'&&backgroundMode==='REPLACE');
const errorText=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';
const status=(job:EditorJobView|null)=>job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';

export const ImageEditorView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[tool,setTool]=useState<Tool>('image-edit');
 const[models,setModels]=useState<any[]>([]);
 const[images,setImages]=useState<Asset[]>([]);
 const[sourceId,setSourceId]=useState('');
 const[modelId,setModelId]=useState('AUTO');
 const[prompt,setPrompt]=useState('');
 const[resolution,setResolution]=useState('2K');
 const[aspectRatio,setAspectRatio]=useState('1:1');
 const[backgroundMode,setBackgroundMode]=useState<'TRANSPARENT'|'REPLACE'>('TRANSPARENT');
 const[variationStrength,setVariationStrength]=useState(.35);
 const[brushSize,setBrushSize]=useState(46);
 const[maskDirty,setMaskDirty]=useState(false);
 const[job,setJob]=useState<EditorJobView|null>(null);
 const[result,setResult]=useState<Asset|null>(null);
 const[busy,setBusy]=useState('');
 const[catalogLoading,setCatalogLoading]=useState(true);
 const[assetsLoading,setAssetsLoading]=useState(true);
 const[catalogError,setCatalogError]=useState('');
 const[assetsError,setAssetsError]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);
 const[pickerOpen,setPickerOpen]=useState(false);
 const[zoom,setZoom]=useState(1);
 const[viewMode,setViewMode]=useState<ImageEditorViewMode>('source');
 const[comparePosition,setComparePosition]=useState(50);
 const maskRef=useRef<HTMLCanvasElement|null>(null),drawing=useRef(false);

 const invalidate=useCallback(()=>{setJob(null);setResult(null);setPollCount(0);setError('');setViewMode('source');},[]);
 const loadCatalog=useCallback(async()=>{setCatalogLoading(true);setCatalogError('');try{const catalog=await editorClient.catalog();setModels(catalog.filter(model=>model.capabilities.some((cap:any)=>TOOLS.some(item=>item.id===cap.id))));}catch(err){setModels([]);setCatalogError(errorText(err));}finally{setCatalogLoading(false);}},[]);
 const loadImages=useCallback(async()=>{setAssetsLoading(true);setAssetsError('');try{const assets=(await assetService.listAssets()).filter(asset=>asset.type==='IMAGE');setImages(assets);setSourceId(current=>current&&assets.some(asset=>asset.asset_id===current)?current:'');}catch(err){setAssetsError(errorText(err));}finally{setAssetsLoading(false);}},[]);
 useEffect(()=>{void loadCatalog();void loadImages();},[loadCatalog,loadImages]);
 useEffect(()=>{const refresh=()=>void loadImages();window.addEventListener('creations:updated',refresh);window.addEventListener('ia:asset-upload-complete',refresh);return()=>{window.removeEventListener('creations:updated',refresh);window.removeEventListener('ia:asset-upload-complete',refresh);};},[loadImages]);

 const source=images.find(asset=>asset.asset_id===sourceId)||null;
 const eligible=useMemo(()=>models.filter(model=>model.capabilities.some((cap:any)=>cap.id===tool)),[models,tool]);
 const manualModels=useMemo(()=>eligible.filter(model=>model.model_id!=='AUTO'),[eligible]);
 useEffect(()=>{if(modelId!=='AUTO'&&!manualModels.some(model=>model.model_id===modelId))setModelId('AUTO');},[manualModels,modelId]);
 const model=eligible.find(item=>item.model_id===modelId)||eligible.find(item=>item.model_id==='AUTO')||manualModels[0]||null;
 const capability=model?.capabilities.find((cap:any)=>cap.id===tool)||null;
 const routeReady=manualModels.length>0||eligible.some(item=>item.model_id==='AUTO');
 const controls=useMemo(()=>new Set<string>(capability?.controls||[]),[capability]);
 const resolutionOptions=capability?.supported_resolutions?.length?capability.supported_resolutions:['1K','2K','4K'];
 const ratioOptions=capability?.supported_aspect_ratios?.length?capability.supported_aspect_ratios:['1:1','16:9','9:16','4:3','3:4','21:9'];
 const activeTool=TOOLS.find(item=>item.id===tool)!;
 const promptVisible=tool==='image-edit'||tool==='inpaint-mask'||tool==='outpaint'||(tool==='background-remove-replace'&&backgroundMode==='REPLACE');

 useEffect(()=>{invalidate();},[tool,sourceId,modelId,invalidate]);
 useEffect(()=>{if(controls.has('resolution')&&!resolutionOptions.includes(resolution))setResolution(resolutionOptions[0]||'2K');if(controls.has('aspect_ratio')&&!ratioOptions.includes(aspectRatio))setAspectRatio(ratioOptions[0]||'1:1');},[tool,model?.model_id]);
 useEffect(()=>{if(!job||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=150)return;const timer=window.setTimeout(async()=>{try{setJob(await editorClient.get(job.job_id));setPollCount(v=>v+1);}catch(err){setError(errorText(err));setPollCount(150);}},Math.min(6500,1800+pollCount*120));return()=>window.clearTimeout(timer);},[job,pollCount]);
 useEffect(()=>{if(job?.status!=='SUCCEEDED')return;void refreshWallet();const id=job.result_asset_ids?.[0];if(id)void editorClient.asset(id).then(asset=>{setResult(asset);setViewMode('compare');setComparePosition(50);}).catch(()=>setResult(null));window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'IMAGE',asset_ids:job.result_asset_ids||[]}}));},[job?.status,job?.result_asset_ids,refreshWallet]);

 const clearMask=useCallback(()=>{const canvas=maskRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);setMaskDirty(false);},[]);
 useEffect(()=>{if(tool==='inpaint-mask')requestAnimationFrame(clearMask);},[tool,sourceId,clearMask]);
 const point=(event:React.PointerEvent<HTMLCanvasElement>)=>{const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};};
 const begin=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(job||result)invalidate();drawing.current=true;event.currentTarget.setPointerCapture(event.pointerId);const p=point(event),ctx=event.currentTarget.getContext('2d');ctx?.beginPath();ctx?.moveTo(p.x,p.y);};
 const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const p=point(event),ctx=event.currentTarget.getContext('2d');if(!ctx)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';ctx.lineWidth=brushSize*event.currentTarget.width/700;ctx.lineTo(p.x,p.y);ctx.stroke();setMaskDirty(true);};
 const end=()=>{drawing.current=false;};

 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy('upload');setError('');try{const asset=await assetService.uploadAsset({file,name:file.name});setImages(rows=>[asset,...rows.filter(row=>row.asset_id!==asset.asset_id)]);setSourceId(asset.asset_id);setPickerOpen(false);setZoom(1);invalidate();}catch(err){setError(errorText(err));}finally{setBusy('');}};
 const selectAsset=(asset:Asset)=>{setSourceId(asset.asset_id);setPickerOpen(false);setZoom(1);invalidate();};
 const uploadMask=async()=>{const canvas=maskRef.current;if(!canvas||!maskDirty)throw new Error('Pinte a área que deseja alterar.');const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível gerar a máscara.')),'image/png'));const file=new File([blob],`mask-${Date.now()}.png`,{type:'image/png'});const asset=await assetService.uploadAsset({file,name:'Máscara de inpaint'});await apiRequest(`/api/assets/${encodeURIComponent(asset.asset_id)}`,{method:'PATCH',body:JSON.stringify({media_metadata:{editor_mask:true}})});return asset;};

 const buildRequest=async()=>{if(!source)throw new Error('Selecione uma imagem.');if(!model)throw new Error('Nenhum modelo elegível está disponível.');if(promptRequired(tool,backgroundMode)&&!prompt.trim())throw new Error(tool==='background-remove-replace'?'Descreva o novo fundo.':'Descreva a edição desejada.');const references:any[]=[{asset_id:source.asset_id,slot_type:'GENERAL',role:'SOURCE'}];if(tool==='inpaint-mask'){const mask=await uploadMask();references.push({asset_id:mask.asset_id,slot_type:'GENERAL',role:'MASK'});}const operation:Record<Tool,string>={'image-edit':'EDIT','inpaint-mask':'INPAINT','background-remove-replace':backgroundMode==='TRANSPARENT'?'BACKGROUND_REMOVE':'BACKGROUND_REPLACE','outpaint':'OUTPAINT','upscale':'UPSCALE','variations':'VARIATIONS'};const requestControls:any={output_format:'png',number_of_outputs:1,editor_operation:operation[tool]};if(controls.has('resolution'))requestControls.resolution=resolution;if(controls.has('aspect_ratio'))requestControls.aspect_ratio=aspectRatio;if(tool==='background-remove-replace')requestControls.background_mode=backgroundMode;if(tool==='variations')requestControls.variation_strength=variationStrength;return{capability_id:tool,model_id:modelId==='AUTO'?'AUTO':model.model_id,prompt:prompt.trim(),references,controls:requestControls};};
 const quote=async()=>{setBusy('quote');setError('');try{const created=await editorClient.create(await buildRequest());setJob(await editorClient.quote(created.job_id));setPollCount(0);}catch(err){setError(errorText(err));}finally{setBusy('');}};
 const execute=async()=>{if(!job)return;setBusy('execute');setError('');try{setJob(await editorClient.queue(job.job_id));setPollCount(0);}catch(err){setError(errorText(err));}finally{setBusy('');}};
 const useResultAsSource=()=>{if(!result)return;setImages(rows=>[result,...rows.filter(row=>row.asset_id!==result.asset_id)]);setSourceId(result.asset_id);setZoom(1);invalidate();};

 const price=job?.quote?.credit_price??null,balance=wallet?.available_credits??0,insufficient=price!=null&&balance<price;
 const processing=Boolean(job&&['QUEUED','RUNNING'].includes(job.status));
 const actionLabel=tool==='image-edit'?'Aplicar edição':tool==='inpaint-mask'?'Aplicar inpaint':tool==='background-remove-replace'?(backgroundMode==='REPLACE'?'Substituir fundo':'Remover fundo'):tool==='outpaint'?'Expandir imagem':tool==='upscale'?'Fazer upscale':'Criar variação';

 const topbar=<div className="flex min-h-[60px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 lg:px-5">
  <div className="mr-auto min-w-[150px]"><h1 className="text-sm font-bold text-white sm:text-base">Editor de imagem</h1><p className="hidden text-[9px] text-zinc-600 sm:block">Edite, transforme e preserve sempre o original.</p></div>
  <button onClick={()=>setPickerOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-medium text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><FolderOpen className="h-3.5 w-3.5"/>Abrir imagem</button>
  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-medium text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><Upload className="h-3.5 w-3.5"/>{busy==='upload'?'Enviando…':'Upload'}<input className="hidden" type="file" accept="image/*" onChange={upload}/></label>
  <div className="hidden items-center rounded-xl border border-white/[0.07] bg-black/20 p-1 md:flex">
   <button onClick={()=>setZoom(value=>Math.max(.6,Number((value-.1).toFixed(1))))} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-white"><Minus className="h-3.5 w-3.5"/></button>
   <button onClick={()=>setZoom(1)} className="min-w-[54px] px-2 text-[9px] font-semibold text-zinc-400 hover:text-white">{Math.round(zoom*100)}%</button>
   <button onClick={()=>setZoom(value=>Math.min(1.6,Number((value+.1).toFixed(1))))} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-white"><Plus className="h-3.5 w-3.5"/></button>
  </div>
  {result?.public_url&&<a href={result.public_url} download target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-[10px] font-bold text-white shadow-[0_0_24px_rgba(34,211,238,.12)]"><Download className="h-3.5 w-3.5"/>Baixar</a>}
 </div>;

 const tools=<div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">{TOOLS.map(item=>{const Icon=item.icon;const selected=tool===item.id;const hasRoute=models.some(model=>model.capabilities?.some((cap:any)=>cap.id===item.id));return <button key={item.id} onClick={()=>setTool(item.id)} title={hasRoute||catalogLoading?item.label:`${item.label} · rota de IA indisponível no momento`} className={`min-w-[72px] rounded-xl border px-2 py-2.5 text-center transition xl:min-w-0 ${selected?'border-cyan-400/35 bg-cyan-400/[0.09] text-cyan-100 shadow-[inset_0_0_20px_rgba(34,211,238,.035)]':'border-white/[0.06] bg-white/[0.018] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'}`}><Icon className={`mx-auto h-4 w-4 ${selected?'text-cyan-300':hasRoute?'':'text-zinc-700'}`}/><span className="mt-1.5 block text-[8px] font-semibold leading-tight">{item.shortLabel}</span></button>;})}</div>;

 const canvas=<ImageEditorCanvas source={source} result={result} tool={tool} zoom={zoom} viewMode={viewMode} comparePosition={comparePosition} processing={processing} statusLabel={status(job)} maskRef={maskRef} onOpenPicker={()=>setPickerOpen(true)} onViewMode={setViewMode} onComparePosition={setComparePosition} onPointerDown={begin} onPointerMove={move} onPointerEnd={end}/>;

 const inspector=<div className="flex min-h-full flex-col p-4">
  <div className="border-b border-white/[0.06] pb-4"><span className="text-[8px] font-bold uppercase tracking-[.16em] text-cyan-400">Ferramenta ativa</span><div className="mt-2 flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06]"><activeTool.icon className="h-4 w-4 text-cyan-300"/></span><div><h2 className="text-[12px] font-bold text-white">{activeTool.label}</h2><p className="mt-1 text-[9px] leading-relaxed text-zinc-500">{activeTool.description}</p></div></div></div>

  <div className="space-y-4 py-4">
   <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-medium text-zinc-400">IA / modelo</span>{catalogError&&<button type="button" onClick={()=>void loadCatalog()} className="inline-flex items-center gap-1 text-[8px] text-rose-300 hover:text-rose-200"><RefreshCw className="h-3 w-3"/>Recarregar</button>}</div><StableGeneratorModelPicker models={manualModels.map(item=>({model_id:item.model_id,name:item.name,description:`Modelo compatível com ${activeTool.shortLabel}`}))} selectedModelId={modelId} onSelect={id=>{setModelId(id);invalidate();}} loading={catalogLoading}/>{catalogError&&<p className="text-[8px] leading-relaxed text-rose-300/90">O catálogo de IA não carregou. As ferramentas e a Biblioteca continuam disponíveis; recarregue para escolher Auto ou um modelo específico.</p>}{!catalogLoading&&!catalogError&&!routeReady&&<p className="text-[8px] leading-relaxed text-amber-300/80">Nenhuma rota de IA está elegível para esta ferramenta no momento.</p>}</div>

   {tool==='background-remove-replace'&&<div><span className="text-[9px] font-medium text-zinc-400">Ação de fundo</span><div className="mt-1.5 grid grid-cols-2 gap-2"><button onClick={()=>{setBackgroundMode('TRANSPARENT');invalidate();}} className={`rounded-xl border px-3 py-2.5 text-[9px] font-semibold ${backgroundMode==='TRANSPARENT'?'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200':'border-white/[0.07] text-zinc-500'}`}>Remover</button><button onClick={()=>{setBackgroundMode('REPLACE');invalidate();}} className={`rounded-xl border px-3 py-2.5 text-[9px] font-semibold ${backgroundMode==='REPLACE'?'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200':'border-white/[0.07] text-zinc-500'}`}>Substituir</button></div></div>}

   {promptVisible&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">{tool==='background-remove-replace'?'Novo fundo':'Prompt / instruções'}</span><textarea rows={5} value={prompt} onChange={e=>{setPrompt(e.target.value);invalidate();}} placeholder={tool==='inpaint-mask'?'Descreva o que deve aparecer na área pintada…':tool==='outpaint'?'Descreva como a cena deve continuar…':tool==='background-remove-replace'?'Descreva o novo fundo…':'Descreva a edição desejada…'} className="mt-1.5 w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[10px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-650 focus:border-cyan-400/25"/></label>}

   {tool==='inpaint-mask'&&<div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3"><div className="flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">Tamanho do pincel</span><span className="text-[9px] font-semibold text-cyan-300">{brushSize}px</span></div><input className="mt-3 w-full accent-cyan-400" type="range" min={12} max={140} value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}/><div className="mt-2 flex items-center justify-between"><span className={`text-[8px] ${maskDirty?'text-cyan-400':'text-zinc-600'}`}>{maskDirty?'Máscara pronta':'Pinte diretamente sobre a imagem'}</span><button onClick={()=>{clearMask();invalidate();}} className="inline-flex items-center gap-1 text-[8px] text-zinc-500 hover:text-zinc-200"><Eraser className="h-3 w-3"/>Limpar</button></div></div>}

   {controls.has('aspect_ratio')&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">{tool==='outpaint'?'Proporção final':'Proporção'}</span><select value={aspectRatio} onChange={e=>{setAspectRatio(e.target.value);invalidate();}} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] text-zinc-300 outline-none focus:border-cyan-400/25">{ratioOptions.map((value:string)=><option key={value}>{value}</option>)}</select></label>}

   {controls.has('resolution')&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">{tool==='upscale'?'Resolução alvo':'Resolução'}</span><select value={resolution} onChange={e=>{setResolution(e.target.value);invalidate();}} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] text-zinc-300 outline-none focus:border-cyan-400/25">{resolutionOptions.map((value:string)=><option key={value}>{value}</option>)}</select></label>}

   {tool==='variations'&&<div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3"><div className="flex items-center justify-between"><span className="text-[9px] font-medium text-zinc-400">Força da variação</span><span className="text-[9px] font-semibold text-cyan-300">{Math.round(variationStrength*100)}%</span></div><input className="mt-3 w-full accent-cyan-400" type="range" min={.1} max={.9} step={.05} value={variationStrength} onChange={e=>{setVariationStrength(Number(e.target.value));invalidate();}}/></div>}
  </div>

  <div className="mt-auto border-t border-white/[0.06] pt-4">
   {error&&<div className="mb-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-3 text-[9px] leading-relaxed text-rose-300">{error}</div>}
   <div className="mb-3 flex items-end justify-between gap-3"><div><span className="text-[8px] uppercase tracking-wider text-zinc-600">Preço</span><strong className="mt-0.5 block text-[11px] text-white">{price==null?'Calcule antes de executar':`${price.toLocaleString('pt-BR')} créditos`}</strong></div><div className="text-right"><span className="text-[8px] uppercase tracking-wider text-zinc-600">Saldo</span><strong className={`mt-0.5 block text-[10px] ${insufficient?'text-rose-300':'text-zinc-300'}`}>{balance.toLocaleString('pt-BR')} créditos</strong></div></div>

   {!job?.quote?<button onClick={()=>void quote()} disabled={Boolean(busy)||catalogLoading||!routeReady||!model||!source} className="ia-generator-generate flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy==='quote'?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Calcular créditos</button>:['DRAFT','QUOTED'].includes(job.status)?<div className="grid grid-cols-[40px_1fr] gap-2"><button onClick={()=>void quote()} title="Recalcular" className="grid h-11 place-items-center rounded-xl border border-white/[0.08] text-zinc-500 hover:text-white"><RefreshCw className="h-3.5 w-3.5"/></button><button onClick={()=>void execute()} disabled={Boolean(busy)||insufficient} className="ia-generator-generate flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy==='execute'?<LoaderCircle className="h-4 w-4 animate-spin"/>:<WandSparkles className="h-4 w-4"/>}{actionLabel}</button></div>:<button disabled className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[9px] text-zinc-500">{processing&&<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>}{status(job)}</button>}

   {job?.status==='SUCCEEDED'&&result&&<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={useResultAsSource} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] text-[9px] text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><CheckCircle2 className="h-3.5 w-3.5"/>Usar como origem</button><button onClick={()=>{setViewMode('compare');setComparePosition(50);}} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] text-[9px] text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><RotateCcw className="h-3.5 w-3.5"/>Comparar</button></div>}
  </div>
 </div>;

 return <>
  <EditorWorkspaceShell topbar={topbar} tools={tools} canvas={canvas} inspector={inspector}/>
  <EditorAssetPicker open={pickerOpen} assets={images} selectedId={sourceId} busy={busy==='upload'||assetsLoading} onClose={()=>setPickerOpen(false)} onSelect={selectAsset} onUpload={upload}/>{assetsError&&pickerOpen&&<div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-rose-400/20 bg-[#170d13] px-4 py-2 text-[9px] text-rose-300 shadow-xl">Não foi possível atualizar a Biblioteca. <button onClick={()=>void loadImages()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
 </>;
};

export default ImageEditorView;
