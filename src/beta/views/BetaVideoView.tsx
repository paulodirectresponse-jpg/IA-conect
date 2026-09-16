import React,{useCallback,useEffect,useMemo,useState}from'react';
import{CheckCircle2,Clapperboard,Film,Image as ImageIcon,LoaderCircle,RefreshCw,Sparkles,Upload,Video,VideoIcon,WandSparkles}from'lucide-react';
import{betaVideoClient}from'../videoClient.js';
import{BetaCapabilityModel}from'../capabilityClient.js';
import{betaJobClient,BetaJobView}from'../jobClient.js';
import{universalAssetClient,UniversalAssetView}from'../universalAssetClient.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';

type Tool='text-to-video'|'image-to-video'|'first-frame'|'last-frame'|'video-extend'|'video-edit';
const TOOLS:Array<{id:Tool;label:string;description:string;icon:React.ComponentType<any>}>= [
 {id:'text-to-video',label:'Texto → Vídeo',description:'Crie um vídeo a partir de uma descrição.',icon:Clapperboard},
 {id:'image-to-video',label:'Imagem → Vídeo',description:'Anime uma imagem da sua Library.',icon:ImageIcon},
 {id:'first-frame',label:'Frame inicial',description:'Controle explicitamente o primeiro frame.',icon:Film},
 {id:'last-frame',label:'Inicial + final',description:'Defina os frames inicial e final.',icon:Film},
 {id:'video-extend',label:'Estender',description:'Continue um vídeo preservando a continuidade.',icon:VideoIcon},
 {id:'video-edit',label:'Editar vídeo',description:'Reinterprete um vídeo com instruções.',icon:WandSparkles},
];

const errorMessage=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';
const statusLabel=(job:BetaJobView|null)=>job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='CANCELLED'?'Cancelado':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Cotado':'Rascunho';
const promptRequired=(tool:Tool)=>tool!=='video-extend';

export const BetaVideoView:React.FC<{initialAssetId?:string|null;initialAssetType?:string|null;onOpenLibrary?:()=>void}>=({initialAssetId,initialAssetType,onOpenLibrary})=>{
 const[catalog,setCatalog]=useState<BetaCapabilityModel[]>([]);
 const[images,setImages]=useState<UniversalAssetView[]>([]);
 const[videos,setVideos]=useState<UniversalAssetView[]>([]);
 const[tool,setTool]=useState<Tool>(initialAssetType==='VIDEO'?'video-edit':initialAssetType==='IMAGE'?'image-to-video':'text-to-video');
 const[modelId,setModelId]=useState('AUTO');
 const[prompt,setPrompt]=useState('');
 const[firstImageId,setFirstImageId]=useState(initialAssetType==='IMAGE'?initialAssetId||'':'');
 const[lastImageId,setLastImageId]=useState('');
 const[sourceVideoId,setSourceVideoId]=useState(initialAssetType==='VIDEO'?initialAssetId||'':'');
 const[duration,setDuration]=useState(5);
 const[resolution,setResolution]=useState('720p');
 const[aspectRatio,setAspectRatio]=useState('16:9');
 const[audioEnabled,setAudioEnabled]=useState(true);
 const[job,setJob]=useState<BetaJobView|null>(null);
 const[result,setResult]=useState<UniversalAssetView|null>(null);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const load=useCallback(async()=>{
  try{
   const[models,imageRows,videoRows]=await Promise.all([
    betaVideoClient.catalog(),universalAssetClient.list({type:'IMAGE'}),universalAssetClient.list({type:'VIDEO'}),
   ]);
   setCatalog(models);setImages(imageRows);setVideos(videoRows);
   if(initialAssetType==='IMAGE'&&initialAssetId&&imageRows.some(asset=>asset.asset_id===initialAssetId))setFirstImageId(initialAssetId);
   if(initialAssetType==='VIDEO'&&initialAssetId&&videoRows.some(asset=>asset.asset_id===initialAssetId))setSourceVideoId(initialAssetId);
  }catch(error){setError(errorMessage(error));}
 },[initialAssetId,initialAssetType]);

 useEffect(()=>{void load()},[load]);
 useEffect(()=>{setJob(null);setResult(null);setError('');setPollCount(0);},[tool,modelId,firstImageId,lastImageId,sourceVideoId]);
 useEffect(()=>{
  const eligible=catalog.filter(model=>model.capabilities.some(cap=>cap.id===tool));
  if(!eligible.some(model=>model.model_id===modelId))setModelId(eligible.find(model=>model.model_id==='AUTO')?.model_id||eligible[0]?.model_id||'');
 },[catalog,tool,modelId]);
 useEffect(()=>{
  if(!job||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=180)return;
  const timer=window.setTimeout(async()=>{try{setJob(await betaJobClient.get(job.job_id));setPollCount(v=>v+1);}catch(error){setError(errorMessage(error));setPollCount(180);}},Math.min(7000,1800+pollCount*110));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);
 useEffect(()=>{
  const id=job?.status==='SUCCEEDED'?job.result_asset_ids?.[0]:null;
  if(!id){if(job?.status!=='SUCCEEDED')setResult(null);return;}
  void universalAssetClient.get(id).then(setResult).catch(()=>setResult(null));
 },[job?.status,job?.result_asset_ids?.[0]]);

 const eligibleModels=useMemo(()=>catalog.filter(model=>model.capabilities.some(cap=>cap.id===tool)),[catalog,tool]);
 const selectedModel=eligibleModels.find(model=>model.model_id===modelId)||null;
 const controls=new Set(selectedModel?.capabilities.find(cap=>cap.id===tool)?.controls||[]);

 const upload=async(event:React.ChangeEvent<HTMLInputElement>,kind:'IMAGE'|'VIDEO',slot:'FIRST'|'LAST'|'SOURCE')=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy('upload');setError('');
  try{
   const asset=await assetService.uploadAsset({file,name:file.name});
   const view=await universalAssetClient.get(asset.asset_id);
   if(kind==='IMAGE'){setImages(rows=>[view,...rows.filter(row=>row.asset_id!==view.asset_id)]);slot==='LAST'?setLastImageId(view.asset_id):setFirstImageId(view.asset_id);}
   else{setVideos(rows=>[view,...rows.filter(row=>row.asset_id!==view.asset_id)]);setSourceVideoId(view.asset_id);}
  }catch(error){setError(errorMessage(error));}
  finally{setBusy('');}
 };

 const buildRequest=()=>{
  if(!selectedModel)throw new Error('Nenhum modelo elegível está disponível para esta ferramenta.');
  if(promptRequired(tool)&&!prompt.trim())throw new Error('Descreva o vídeo ou a edição desejada.');
  const references:any[]=[];
  if(tool==='image-to-video'&&firstImageId)references.push({asset_id:firstImageId,slot_type:'INITIAL',role:'SOURCE'});
  if(tool==='first-frame'&&firstImageId)references.push({asset_id:firstImageId,slot_type:'INITIAL',role:'SOURCE'});
  if(tool==='last-frame'){
    if(firstImageId)references.push({asset_id:firstImageId,slot_type:'INITIAL',role:'SOURCE'});
    if(lastImageId)references.push({asset_id:lastImageId,slot_type:'END',role:'REFERENCE'});
  }
  if((tool==='video-extend'||tool==='video-edit')&&sourceVideoId)references.push({asset_id:sourceVideoId,slot_type:'GENERAL',role:'SOURCE'});
  if(['image-to-video','first-frame'].includes(tool)&&references.length!==1)throw new Error('Selecione uma imagem de origem.');
  if(tool==='last-frame'&&references.length!==2)throw new Error('Selecione os frames inicial e final.');
  if(['video-extend','video-edit'].includes(tool)&&references.length!==1)throw new Error('Selecione um vídeo de origem.');
  const requestControls:any={output_format:'mp4',audio_enabled:audioEnabled,number_of_outputs:1};
  if(controls.has('duration'))requestControls.duration_seconds=duration;
  if(controls.has('resolution'))requestControls.resolution=resolution;
  if(controls.has('aspect_ratio'))requestControls.aspect_ratio=aspectRatio;
  return{capability_id:tool,model_id:modelId,prompt:prompt.trim(),references,controls:requestControls};
 };

 const quote=async()=>{setBusy('quote');setError('');setJob(null);setResult(null);try{const created=await betaJobClient.create(buildRequest());setJob(await betaJobClient.quote(created.job_id));setPollCount(0);}catch(error){setError(errorMessage(error));}finally{setBusy('');}};
 const execute=async()=>{if(!job)return;setBusy('execute');setError('');try{setJob(await betaJobClient.queue(job.job_id));setPollCount(0);}catch(error){setError(errorMessage(error));}finally{setBusy('');}};

 return <main className="ia-beta-video">
  <section className="ia-beta-video-head">
   <div><span><Video/> Video V1</span><h1>Um único workspace para gerar e transformar vídeo.</h1><p>Texto, imagem, frames, extensão e edição usam o mesmo Job, créditos, Task Center e Library — sem escolher provider.</p></div>
   <button onClick={()=>void load()}><RefreshCw/><span>Atualizar</span></button>
  </section>

  <div className="ia-beta-video-layout">
   <aside className="ia-beta-video-tools">{TOOLS.map(item=>{const Icon=item.icon;return <button key={item.id} className={tool===item.id?'is-selected':''} onClick={()=>setTool(item.id)}><Icon/><div><strong>{item.label}</strong><span>{item.description}</span></div></button>})}</aside>
   <section className="ia-beta-video-workspace">
    <div className="ia-beta-video-title"><div><span>{TOOLS.find(item=>item.id===tool)?.label}</span><h2>{TOOLS.find(item=>item.id===tool)?.description}</h2></div><select value={modelId} onChange={event=>setModelId(event.target.value)}>{eligibleModels.map(model=><option key={model.model_id} value={model.model_id}>{model.name}</option>)}</select></div>

    {(tool==='image-to-video'||tool==='first-frame'||tool==='last-frame')&&<div className="ia-beta-video-input-grid">
      <label><span>{tool==='last-frame'?'Frame inicial':'Imagem de origem'}</span><div><select value={firstImageId} onChange={event=>setFirstImageId(event.target.value)}><option value="">Selecione da Library</option>{images.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name}</option>)}</select><label className="ia-beta-video-upload"><Upload/>Upload<input type="file" accept="image/*" onChange={event=>void upload(event,'IMAGE','FIRST')}/></label></div></label>
      {tool==='last-frame'&&<label><span>Frame final</span><div><select value={lastImageId} onChange={event=>setLastImageId(event.target.value)}><option value="">Selecione da Library</option>{images.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name}</option>)}</select><label className="ia-beta-video-upload"><Upload/>Upload<input type="file" accept="image/*" onChange={event=>void upload(event,'IMAGE','LAST')}/></label></div></label>}
    </div>}

    {(tool==='video-extend'||tool==='video-edit')&&<div className="ia-beta-video-source">
      <label><span>Vídeo de origem</span><div><select value={sourceVideoId} onChange={event=>setSourceVideoId(event.target.value)}><option value="">Selecione da Library</option>{videos.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name}</option>)}</select><label className="ia-beta-video-upload"><Upload/>Upload<input type="file" accept="video/*" onChange={event=>void upload(event,'VIDEO','SOURCE')}/></label></div></label>
      {sourceVideoId&&videos.find(asset=>asset.asset_id===sourceVideoId)?.public_url&&<video controls preload="metadata" src={videos.find(asset=>asset.asset_id===sourceVideoId)!.public_url!}/>}
    </div>}

    <label className="ia-beta-video-field"><span>{tool==='video-extend'?'Direção da continuação · opcional':'Prompt'}</span><textarea rows={5} value={prompt} onChange={event=>{setPrompt(event.target.value);setJob(null)}} placeholder={tool==='video-edit'?'Ex.: transforme a cena em um pôr do sol cinematográfico, preservando o personagem…':tool==='video-extend'?'Ex.: continue o movimento de câmera e a caminhada por mais alguns segundos…':'Descreva cena, câmera, movimento, luz e estilo…'}/></label>

    <div className="ia-beta-video-options">
      {controls.has('duration')&&<label><span>Duração · {duration}s</span><input type="range" min={2} max={30} value={duration} onChange={event=>{setDuration(Number(event.target.value));setJob(null)}}/></label>}
      {controls.has('resolution')&&<label><span>Resolução</span><select value={resolution} onChange={event=>{setResolution(event.target.value);setJob(null)}}><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>}
      {controls.has('aspect_ratio')&&<label><span>Formato</span><select value={aspectRatio} onChange={event=>{setAspectRatio(event.target.value);setJob(null)}}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option><option>21:9</option></select></label>}
      <label className="is-check"><input type="checkbox" checked={audioEnabled} onChange={event=>{setAudioEnabled(event.target.checked);setJob(null)}}/><span>Gerar/preservar áudio quando suportado</span></label>
    </div>

    {error&&<div className="ia-beta-video-error" role="status">{error}</div>}

    <div className="ia-beta-video-runbar">
      <div>{job?.quote?<><span>Cotação</span><strong>{job.quote.credit_price.toLocaleString('pt-BR')} créditos</strong><small>{job.quote.routing_mode==='AUTO'?'AUTO → '+job.quote.selected_model_id:'Modelo selecionado'} · válida até {new Date(job.quote.expires_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></>:<><span>Preço</span><strong>Calcule antes de executar</strong></>}</div>
      {!job?.quote?<button className="is-primary" disabled={Boolean(busy)||!selectedModel} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>:['DRAFT','QUOTED'].includes(job.status)?<div className="ia-beta-video-run-actions"><button onClick={()=>void quote()} disabled={Boolean(busy)}><RefreshCw/>Atualizar</button><button className="is-primary" onClick={()=>void execute()} disabled={Boolean(busy)}>{busy==='execute'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Executar</button></div>:<button disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{statusLabel(job)}</button>}
    </div>

    {job&&<section className="ia-beta-video-result">
      <div className="ia-beta-video-result-head"><div><span>Resultado</span><strong>{statusLabel(job)}</strong></div>{job.status==='SUCCEEDED'&&<CheckCircle2/>}</div>
      {['QUEUED','RUNNING'].includes(job.status)&&<p>A tarefa continua no Task Center. Você pode sair desta tela sem interromper a geração.</p>}
      {job.status==='FAILED'&&<p>{job.error_message||'A execução de vídeo não pôde ser concluída.'}</p>}
      {job.status==='SUCCEEDED'&&result?.public_url&&<video controls preload="metadata" src={result.public_url}/>}
      {job.status==='SUCCEEDED'&&<div className="ia-beta-video-result-actions"><button onClick={onOpenLibrary}>Abrir na Library</button></div>}
    </section>}
   </section>
  </div>
 </main>;
};
