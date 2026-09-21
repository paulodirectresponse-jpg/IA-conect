import React,{useCallback,useEffect,useMemo,useState}from'react';
import{CheckCircle2,Download,FolderOpen,LoaderCircle,RefreshCw,Sparkles,Upload,VideoIcon,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{universalGenerationClient}from'../../services/universalGenerationClient.js';
import{editorCapabilityForSelection,loadUniversalEditorCatalog,UniversalEditorCapability,UniversalEditorModelView}from'../../services/editorUniversalCatalog.js';
import type{UniversalCreationQuote,UniversalCreationRequest}from'../../services/universalGenerationClient.js';
import{Asset,Generation}from'../../types/index.js';
import{EditorWorkspaceShell}from'../editors/shared/EditorWorkspaceShell.js';
import{EditorAssetPicker}from'../editors/shared/EditorAssetPicker.js';
import{VideoEditorPreview,VideoPreviewMode}from'../editors/video/VideoEditorPreview.js';
import{VideoNavigationTimeline}from'../editors/video/VideoNavigationTimeline.js';
import{UniversalModelPicker}from'../workspace/UniversalModelPicker.js';

type Tool=Extract<UniversalEditorCapability,'video-extend'|'video-edit'>;
const TOOLS:Array<{id:Tool;label:string;shortLabel:string;description:string;icon:React.ComponentType<{className?:string}>}>=[
 {id:'video-edit',label:'Editar vídeo',shortLabel:'Editar',description:'Transforme um vídeo a partir de instruções, preservando o original.',icon:WandSparkles},
 {id:'video-extend',label:'Estender vídeo',shortLabel:'Estender',description:'Continue a duração do vídeo mantendo a continuidade visual.',icon:VideoIcon},
];
const errorText=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';
const status=(job:Generation|null,quoted:boolean)=>job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='CANCELLED'?'Cancelado':job&&['RESERVING_FUNDS','SUBMITTED','PROCESSING'].includes(job.status)?'Processando':job?.status==='QUEUED'?'Na fila':quoted?'Preço calculado':'Preparando';

export const VideoEditorView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[tool,setTool]=useState<Tool>('video-edit');
 const[models,setModels]=useState<UniversalEditorModelView[]>([]);
 const[videos,setVideos]=useState<Asset[]>([]);
 const[sourceVideoId,setSourceVideoId]=useState('');
 const[modelId,setModelId]=useState('AUTO');
 const[prompt,setPrompt]=useState('');
 const[duration,setDuration]=useState(5);
 const[resolution,setResolution]=useState('720p');
 const[aspectRatio,setAspectRatio]=useState('16:9');
 const[audioEnabled,setAudioEnabled]=useState(true);
 const[job,setJob]=useState<Generation|null>(null);
 const[quoteState,setQuoteState]=useState<UniversalCreationQuote|null>(null);
 const[quotedRequest,setQuotedRequest]=useState<UniversalCreationRequest|null>(null);
 const[result,setResult]=useState<Asset|null>(null);
 const[busy,setBusy]=useState('');
 const[catalogLoading,setCatalogLoading]=useState(true);
 const[assetsLoading,setAssetsLoading]=useState(true);
 const[catalogError,setCatalogError]=useState('');
 const[assetsError,setAssetsError]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);
 const[pickerOpen,setPickerOpen]=useState(false);
 const[previewMode,setPreviewMode]=useState<VideoPreviewMode>('source');
 const[currentTime,setCurrentTime]=useState(0);
 const[sourceDuration,setSourceDuration]=useState(0);
 const[seekTo,setSeekTo]=useState<number|undefined>(undefined);

 const invalidate=useCallback(()=>{setJob(null);setQuoteState(null);setQuotedRequest(null);setResult(null);setPollCount(0);setError('');setPreviewMode('source');},[]);
 const loadCatalog=useCallback(async()=>{setCatalogLoading(true);setCatalogError('');try{setModels(await loadUniversalEditorCatalog(TOOLS.map(item=>item.id)));}catch(err){setModels([]);setCatalogError(errorText(err));}finally{setCatalogLoading(false);}},[]);
 const loadVideos=useCallback(async()=>{setAssetsLoading(true);setAssetsError('');try{const assets=(await assetService.listAssets()).filter(asset=>asset.type==='VIDEO');setVideos(assets);setSourceVideoId(current=>current&&assets.some(asset=>asset.asset_id===current)?current:'');}catch(err){setAssetsError(errorText(err));}finally{setAssetsLoading(false);}},[]);
 useEffect(()=>{void loadCatalog();void loadVideos();},[loadCatalog,loadVideos]);
 useEffect(()=>{const refresh=()=>void loadVideos();window.addEventListener('creations:updated',refresh);window.addEventListener('ia:asset-upload-complete',refresh);return()=>{window.removeEventListener('creations:updated',refresh);window.removeEventListener('ia:asset-upload-complete',refresh);};},[loadVideos]);

 const source=videos.find(asset=>asset.asset_id===sourceVideoId)||null;
 const eligibleModels=useMemo(()=>models.filter(model=>model.editor_capabilities.some(cap=>cap.id===tool)),[models,tool]);
 const manualModels=eligibleModels;
 useEffect(()=>{if(modelId!=='AUTO'&&!manualModels.some(model=>model.model_id===modelId))setModelId('AUTO');},[manualModels,modelId]);
 const model=modelId==='AUTO'?null:manualModels.find(item=>item.model_id===modelId)||null;
 const capability=editorCapabilityForSelection(manualModels,tool,modelId);
 const controls=useMemo(()=>new Set<string>(capability?.controls||[]),[capability]);
 const durationOptions=capability?.supported_durations||[];
 const resolutionOptions=capability?.supported_resolutions||[];
 const ratioOptions=capability?.supported_aspect_ratios||[];
 const routeReady=manualModels.length>0;
 const activeTool=TOOLS.find(item=>item.id===tool)!;

 useEffect(()=>{invalidate();setCurrentTime(0);setSeekTo(undefined);},[tool,modelId,sourceVideoId,invalidate]);
 useEffect(()=>{if(controls.has('duration')&&durationOptions.length&&!durationOptions.includes(duration))setDuration(durationOptions[0]);if(controls.has('resolution')&&resolutionOptions.length&&!resolutionOptions.includes(resolution))setResolution(resolutionOptions[0]);if(controls.has('aspect_ratio')&&ratioOptions.length&&!ratioOptions.includes(aspectRatio))setAspectRatio(ratioOptions[0]);},[tool,model?.model_id,controls,durationOptions,resolutionOptions,ratioOptions,duration,resolution,aspectRatio]);
 useEffect(()=>{if(!job||['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(job.status)||pollCount>=180)return;const timer=window.setTimeout(async()=>{try{setJob(await universalGenerationClient.get(job.generation_id));setPollCount(v=>v+1);}catch(err){setError(errorText(err));setPollCount(180);}},Math.min(7000,1800+pollCount*110));return()=>window.clearTimeout(timer);},[job,pollCount]);
 useEffect(()=>{if(job?.status!=='SUCCEEDED')return;void refreshWallet();const id=job.result_asset_ids?.[0];if(id)void assetService.listAssets({type:'VIDEO'}).then(assets=>{const asset=assets.find(item=>item.asset_id===id)||null;setResult(asset);if(asset){setVideos(rows=>[asset,...rows.filter(row=>row.asset_id!==asset.asset_id)]);setPreviewMode('result');}}).catch(()=>setResult(null));window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'VIDEO',asset_ids:job.result_asset_ids||[]}}));},[job?.status,job?.result_asset_ids,refreshWallet]);

 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy('upload');setError('');try{const asset=await assetService.uploadAsset({file,name:file.name});setVideos(rows=>[asset,...rows.filter(row=>row.asset_id!==asset.asset_id)]);setSourceVideoId(asset.asset_id);setPickerOpen(false);invalidate();}catch(err){setError(errorText(err));}finally{setBusy('');}};
 const selectAsset=(asset:Asset)=>{setSourceVideoId(asset.asset_id);setPickerOpen(false);invalidate();};
 const buildRequest=():UniversalCreationRequest=>{if(!source)throw new Error('Selecione um vídeo de origem.');if(!routeReady)throw new Error('Nenhum modelo elegível está disponível.');if(modelId!=='AUTO'&&!model)throw new Error('O modelo selecionado não está mais disponível.');if(tool==='video-edit'&&!prompt.trim())throw new Error('Descreva a edição desejada.');const requestControls:any={number_of_outputs:1};if(controls.has('duration')&&durationOptions.length)requestControls.duration_seconds=duration;if(controls.has('resolution')&&resolutionOptions.length)requestControls.resolution=resolution;if(controls.has('aspect_ratio')&&ratioOptions.length)requestControls.aspect_ratio=aspectRatio;if(controls.has('audio_enabled'))requestControls.audio_enabled=audioEnabled;requestControls.editor_operation=tool==='video-edit'?'EDIT':'EXTEND';return{capability_id:tool,model_id:modelId==='AUTO'?'AUTO':model!.model_id,prompt:prompt.trim(),references:[{asset_id:source.asset_id,slot_type:'GENERAL',role:'SOURCE'}],controls:requestControls};};
 const quote=async()=>{setBusy('quote');setError('');try{const request=buildRequest();const preview=await universalGenerationClient.quote(request);setQuotedRequest(request);setQuoteState(preview);setJob(null);setPollCount(0);}catch(err){setQuoteState(null);setQuotedRequest(null);setError(errorText(err));}finally{setBusy('');}};
 const execute=async()=>{if(!quoteState||!quotedRequest)return;setBusy('execute');setError('');try{setJob(await universalGenerationClient.create(quotedRequest,quoteState));setPollCount(0);}catch(err:any){if(['ROUTING_V2_PRICE_CHANGED','PRICE_CHANGED_REQUOTE_REQUIRED'].includes(String(err?.code||''))){try{const refreshed=await universalGenerationClient.quote(quotedRequest);setQuoteState(refreshed);}catch{}setError('O preço mudou. Revise a nova cotação antes de executar.');}else setError(errorText(err));}finally{setBusy('');}};
 const useResultAsSource=()=>{if(!result)return;setVideos(rows=>[result,...rows.filter(row=>row.asset_id!==result.asset_id)]);setSourceVideoId(result.asset_id);invalidate();};

 const price=quoteState?.credit_price??null,balance=wallet?.available_credits??0,insufficient=price!=null&&balance<price,processing=Boolean(job&&!['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(job.status));
 const actionLabel=tool==='video-edit'?'Aplicar edição':'Estender vídeo';

 const topbar=<div className="flex min-h-[60px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 lg:px-5">
  <div className="mr-auto min-w-[160px]"><h1 className="text-sm font-bold text-white sm:text-base">Editor de vídeo</h1><p className="hidden text-[9px] text-zinc-600 sm:block">Transforme ou estenda vídeos sem destruir o original.</p></div>
  <button onClick={()=>setPickerOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-medium text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><FolderOpen className="h-3.5 w-3.5"/>Abrir vídeo</button>
  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-medium text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><Upload className="h-3.5 w-3.5"/>{busy==='upload'?'Enviando…':'Upload'}<input className="hidden" type="file" accept="video/*" onChange={upload}/></label>
  {result?.public_url&&<a href={result.public_url} download target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-[10px] font-bold text-white"><Download className="h-3.5 w-3.5"/>Baixar</a>}
 </div>;

 const tools=<div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">{TOOLS.map(item=>{const Icon=item.icon,selected=tool===item.id,hasRoute=models.some(model=>model.editor_capabilities?.some(cap=>cap.id===item.id));return <button key={item.id} onClick={()=>setTool(item.id)} title={hasRoute||catalogLoading?item.label:`${item.label} · rota de IA indisponível no momento`} className={`min-w-[72px] rounded-xl border px-2 py-3 text-center transition xl:min-w-0 ${selected?'border-cyan-400/35 bg-cyan-400/[0.09] text-cyan-100':'border-white/[0.06] bg-white/[0.018] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'}`}><Icon className={`mx-auto h-4 w-4 ${selected?'text-cyan-300':hasRoute?'':'text-zinc-700'}`}/><span className="mt-1.5 block text-[8px] font-semibold leading-tight">{item.shortLabel}</span></button>;})}</div>;

 const stage=<div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1"><VideoEditorPreview source={source} result={result} mode={previewMode} processing={processing} statusLabel={status(job,Boolean(quoteState))} onOpenPicker={()=>setPickerOpen(true)} onModeChange={setPreviewMode} onTimeUpdate={(current,total)=>{setCurrentTime(current);if(total>0)setSourceDuration(total);}} seekTo={seekTo}/></div><VideoNavigationTimeline currentTime={currentTime} duration={sourceDuration} sourceName={source?.name} modeLabel={tool==='video-edit'?'Editar':'Estender'} resultAvailable={Boolean(result)} onSeek={time=>{setSeekTo(time);setCurrentTime(time);}}/></div>;

 const inspector=<div className="flex min-h-full flex-col p-4">
  <div className="border-b border-white/[0.06] pb-4"><span className="text-[8px] font-bold uppercase tracking-[.16em] text-cyan-400">Ferramenta ativa</span><div className="mt-2 flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06]"><activeTool.icon className="h-4 w-4 text-cyan-300"/></span><div><h2 className="text-[12px] font-bold text-white">{activeTool.label}</h2><p className="mt-1 text-[9px] leading-relaxed text-zinc-500">{activeTool.description}</p></div></div></div>

  <div className="space-y-4 py-4">
   <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-medium text-zinc-400">IA / modelo</span>{catalogError&&<button type="button" onClick={()=>void loadCatalog()} className="inline-flex items-center gap-1 text-[8px] text-rose-300 hover:text-rose-200"><RefreshCw className="h-3 w-3"/>Recarregar</button>}</div><UniversalModelPicker models={manualModels} selectedModelId={modelId} onSelect={id=>{setModelId(id);invalidate();}} loading={catalogLoading}/>{catalogError&&<p className="text-[8px] leading-relaxed text-rose-300/90">O catálogo de IA não carregou. Biblioteca e navegação continuam disponíveis.</p>}{!catalogLoading&&!catalogError&&!routeReady&&<p className="text-[8px] leading-relaxed text-amber-300/80">Nenhuma rota de IA está elegível para esta ferramenta no momento.</p>}</div>

   <label className="block"><span className="text-[9px] font-medium text-zinc-400">{tool==='video-edit'?'Prompt / instruções':'Continuação (opcional)'}</span><textarea rows={5} value={prompt} onChange={e=>{setPrompt(e.target.value);invalidate();}} placeholder={tool==='video-extend'?'Opcional: descreva como o vídeo deve continuar…':'Ex.: transforme a cena em um pôr do sol cinematográfico, preservando o personagem…'} className="mt-1.5 w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[10px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-650 focus:border-cyan-400/25"/></label>

   {controls.has('duration')&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">{tool==='video-extend'?'Duração adicional':'Duração'}</span><select value={duration} onChange={e=>{setDuration(Number(e.target.value));invalidate();}} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] text-zinc-300 outline-none">{durationOptions.map((value:number)=><option key={value} value={value}>{value}s</option>)}</select></label>}

   {controls.has('resolution')&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">Resolução</span><select value={resolution} onChange={e=>{setResolution(e.target.value);invalidate();}} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] text-zinc-300 outline-none">{resolutionOptions.map((value:string)=><option key={value}>{value}</option>)}</select></label>}

   {controls.has('aspect_ratio')&&<label className="block"><span className="text-[9px] font-medium text-zinc-400">Formato</span><select value={aspectRatio} onChange={e=>{setAspectRatio(e.target.value);invalidate();}} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] text-zinc-300 outline-none">{ratioOptions.map((value:string)=><option key={value}>{value}</option>)}</select></label>}

   {controls.has('audio_enabled')&&<button type="button" onClick={()=>{setAudioEnabled(v=>!v);invalidate();}} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 text-left"><div><span className="text-[9px] font-medium text-zinc-300">Áudio</span><p className="mt-0.5 text-[8px] text-zinc-600">Preservar ou gerar áudio quando a rota suportar.</p></div><span className={`relative h-5 w-9 rounded-full transition ${audioEnabled?'bg-cyan-400/40':'bg-white/[0.08]'}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${audioEnabled?'left-5':'left-1'}`}/></span></button>}
  </div>

  <div className="mt-auto border-t border-white/[0.06] pt-4">
   {error&&<div className="mb-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-3 text-[9px] leading-relaxed text-rose-300">{error}</div>}
   <div className="mb-3 flex items-end justify-between gap-3"><div><span className="text-[8px] uppercase tracking-wider text-zinc-600">Preço</span><strong className="mt-0.5 block text-[11px] text-white">{price==null?'Calcule antes de executar':`${price.toLocaleString('pt-BR')} créditos`}</strong></div><div className="text-right"><span className="text-[8px] uppercase tracking-wider text-zinc-600">Saldo</span><strong className={`mt-0.5 block text-[10px] ${insufficient?'text-rose-300':'text-zinc-300'}`}>{balance.toLocaleString('pt-BR')} créditos</strong></div></div>

   {!quoteState?<button onClick={()=>void quote()} disabled={Boolean(busy)||catalogLoading||!routeReady||!source} className="ia-generator-generate flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy==='quote'?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Calcular créditos</button>:!job?<div className="grid grid-cols-[40px_1fr] gap-2"><button onClick={()=>void quote()} title="Recalcular" className="grid h-11 place-items-center rounded-xl border border-white/[0.08] text-zinc-500 hover:text-white"><RefreshCw className="h-3.5 w-3.5"/></button><button onClick={()=>void execute()} disabled={Boolean(busy)||insufficient} className="ia-generator-generate flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy==='execute'?<LoaderCircle className="h-4 w-4 animate-spin"/>:<WandSparkles className="h-4 w-4"/>}{actionLabel}</button></div>:<button disabled className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[9px] text-zinc-500">{processing&&<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>}{status(job,Boolean(quoteState))}</button>}

   {job?.status==='SUCCEEDED'&&result&&<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={useResultAsSource} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] text-[9px] text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><CheckCircle2 className="h-3.5 w-3.5"/>Usar como origem</button><button onClick={()=>setPreviewMode('result')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] text-[9px] text-zinc-300 hover:border-cyan-400/20 hover:text-cyan-200"><VideoIcon className="h-3.5 w-3.5"/>Ver resultado</button></div>}
  </div>
 </div>;

 return <>
  <EditorWorkspaceShell topbar={topbar} tools={tools} canvas={stage} inspector={inspector}/>
  <EditorAssetPicker open={pickerOpen} assets={videos} selectedId={sourceVideoId} uploading={busy==='upload'} loading={assetsLoading} assetType="VIDEO" title="Abrir vídeo" subtitle="Escolha um vídeo da mesma Biblioteca Global do IA Connect ou envie um novo arquivo." onClose={()=>setPickerOpen(false)} onSelect={selectAsset} onUpload={upload}/>
  {assetsError&&pickerOpen&&<div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-rose-400/20 bg-[#170d13] px-4 py-2 text-[9px] text-rose-300 shadow-xl">Não foi possível atualizar a Biblioteca. <button onClick={()=>void loadVideos()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
 </>;
};
export default VideoEditorView;
