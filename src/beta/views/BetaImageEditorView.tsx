import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Brush,CheckCircle2,Eraser,Expand,Image as ImageIcon,Layers,LoaderCircle,RefreshCw,RemoveFormatting,Scaling,Sparkles,Upload,WandSparkles}from'lucide-react';
import{betaImageEditorClient}from'../imageEditorClient.js';
import{BetaCapabilityModel}from'../capabilityClient.js';
import{betaJobClient,BetaJobView}from'../jobClient.js';
import{universalAssetClient,UniversalAssetView}from'../universalAssetClient.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';

type Tool='image-edit'|'inpaint-mask'|'background-remove-replace'|'outpaint'|'upscale'|'variations';
const TOOLS:Array<{id:Tool;label:string;description:string;icon:React.ComponentType<any>}>= [
 {id:'image-edit',label:'Editar',description:'Altere a imagem com instruções.',icon:WandSparkles},
 {id:'inpaint-mask',label:'Inpaint',description:'Edite somente a área pintada.',icon:Brush},
 {id:'background-remove-replace',label:'Fundo',description:'Remova ou substitua o fundo.',icon:RemoveFormatting},
 {id:'outpaint',label:'Expandir',description:'Amplie a cena para outro formato.',icon:Expand},
 {id:'upscale',label:'Upscale',description:'Aumente resolução preservando conteúdo.',icon:Scaling},
 {id:'variations',label:'Variações',description:'Crie uma nova versão fiel ao original.',icon:Layers},
];
const promptRequired=(tool:Tool)=>['image-edit','inpaint-mask','outpaint'].includes(tool);
const err=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';
const status=(job:BetaJobView|null)=>job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Cotado':'Rascunho';

export const BetaImageEditorView:React.FC<{initialAssetId?:string|null;onOpenLibrary?:()=>void}>=({initialAssetId,onOpenLibrary})=>{
 const[catalog,setCatalog]=useState<BetaCapabilityModel[]>([]);
 const[assets,setAssets]=useState<UniversalAssetView[]>([]);
 const[tool,setTool]=useState<Tool>('image-edit');
 const[sourceId,setSourceId]=useState(initialAssetId||'');
 const[prompt,setPrompt]=useState('');
 const[resolution,setResolution]=useState('2K');
 const[aspectRatio,setAspectRatio]=useState('1:1');
 const[backgroundMode,setBackgroundMode]=useState<'TRANSPARENT'|'REPLACE'>('TRANSPARENT');
 const[variationStrength,setVariationStrength]=useState(.35);
 const[brushSize,setBrushSize]=useState(46);
 const[maskDirty,setMaskDirty]=useState(false);
 const[job,setJob]=useState<BetaJobView|null>(null);
 const[result,setResult]=useState<UniversalAssetView|null>(null);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);
 const maskRef=useRef<HTMLCanvasElement|null>(null);
 const drawing=useRef(false);

 const load=useCallback(async()=>{
  try{
   const[models,images]=await Promise.all([betaImageEditorClient.catalog(),universalAssetClient.list({type:'IMAGE'})]);
   setCatalog(models);setAssets(images);
   if(initialAssetId&&images.some(asset=>asset.asset_id===initialAssetId))setSourceId(initialAssetId);
   else if(!sourceId&&images[0])setSourceId(images[0].asset_id);
  }catch(error){setError(err(error));}
 },[initialAssetId]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{setJob(null);setResult(null);setError('');setPollCount(0);},[tool,sourceId]);
 useEffect(()=>{
  if(!job||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=150)return;
  const timer=window.setTimeout(async()=>{try{setJob(await betaJobClient.get(job.job_id));setPollCount(v=>v+1);}catch(error){setError(err(error));setPollCount(150);}},Math.min(6500,1800+pollCount*120));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);
 useEffect(()=>{
  const id=job?.status==='SUCCEEDED'?job.result_asset_ids?.[0]:null;
  if(!id){if(job?.status!=='SUCCEEDED')setResult(null);return;}
  void universalAssetClient.get(id).then(setResult).catch(()=>setResult(null));
 },[job?.status,job?.result_asset_ids?.[0]]);

 const source=assets.find(asset=>asset.asset_id===sourceId)||null;
 const model=useMemo(()=>catalog.find(item=>item.capabilities.some(cap=>cap.id===tool)),[catalog,tool]);

 const clearMask=useCallback(()=>{
  const canvas=maskRef.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);setMaskDirty(false);
 },[]);
 useEffect(()=>{if(tool==='inpaint-mask')requestAnimationFrame(clearMask)},[tool,sourceId,clearMask]);

 const point=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();
  return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
 };
 const begin=(event:React.PointerEvent<HTMLCanvasElement>)=>{drawing.current=true;event.currentTarget.setPointerCapture(event.pointerId);const p=point(event);const ctx=event.currentTarget.getContext('2d');if(!ctx)return;ctx.beginPath();ctx.moveTo(p.x,p.y);};
 const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const p=point(event),ctx=event.currentTarget.getContext('2d');if(!ctx)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';ctx.lineWidth=brushSize*event.currentTarget.width/700;ctx.lineTo(p.x,p.y);ctx.stroke();setMaskDirty(true);};
 const end=()=>{drawing.current=false;};

 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy('upload');setError('');
  try{const asset=await assetService.uploadAsset({file,name:file.name});const view=await universalAssetClient.get(asset.asset_id);setAssets(current=>[view,...current.filter(row=>row.asset_id!==view.asset_id)]);setSourceId(view.asset_id);}
  catch(error){setError(err(error));}finally{setBusy('');}
 };
 const uploadMask=async()=>{
  const canvas=maskRef.current;if(!canvas||!maskDirty)throw new Error('Pinte a área que deseja alterar.');
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível gerar a máscara.')),'image/png'));
  const file=new File([blob],'mask-'+Date.now()+'.png',{type:'image/png'});
  const asset=await assetService.uploadAsset({file,name:'Máscara de inpaint'});await betaImageEditorClient.markMask(asset.asset_id);return asset;
 };

 const buildRequest=async()=>{
  if(!source)throw new Error('Selecione uma imagem da Library.');
  if(!model)throw new Error('O modelo do editor não está elegível agora.');
  if(promptRequired(tool)&&!prompt.trim())throw new Error('Descreva a edição desejada.');
  if(tool==='background-remove-replace'&&backgroundMode==='REPLACE'&&!prompt.trim())throw new Error('Descreva o novo fundo.');
  const refs:any[]=[{asset_id:source.asset_id,slot_type:'GENERAL',role:'SOURCE'}];
  if(tool==='inpaint-mask'){const mask=await uploadMask();refs.push({asset_id:mask.asset_id,slot_type:'GENERAL',role:'MASK'});}
  const operation:Record<Tool,string>={'image-edit':'EDIT','inpaint-mask':'INPAINT','background-remove-replace':backgroundMode==='TRANSPARENT'?'BACKGROUND_REMOVE':'BACKGROUND_REPLACE','outpaint':'OUTPAINT','upscale':'UPSCALE','variations':'VARIATIONS'};
  const controls:any={resolution,output_format:'png',number_of_outputs:1,editor_operation:operation[tool],background_mode:tool==='background-remove-replace'?backgroundMode:undefined,variation_strength:tool==='variations'?variationStrength:undefined};if(tool==='image-edit'||tool==='outpaint')controls.aspect_ratio=aspectRatio;return{capability_id:tool,model_id:model.model_id,prompt:prompt.trim(),references:refs,controls};
 };
 const quote=async()=>{setBusy('quote');setError('');setJob(null);setResult(null);try{const request=await buildRequest();const created=await betaJobClient.create(request);setJob(await betaJobClient.quote(created.job_id));setPollCount(0);}catch(error){setError(err(error));}finally{setBusy('');}};
 const execute=async()=>{if(!job)return;setBusy('execute');setError('');try{setJob(await betaJobClient.queue(job.job_id));setPollCount(0);}catch(error){setError(err(error));}finally{setBusy('');}};

 return <main className="ia-beta-image-editor">
  <section className="ia-beta-image-head"><div><span><ImageIcon/> Image Editor V1</span><h1>Edite sem destruir o original.</h1><p>Cada execução cria um novo Universal Asset derivado, preservando a origem e o histórico.</p></div><button onClick={()=>void load()}><RefreshCw/><span>Atualizar</span></button></section>
  <div className="ia-beta-image-layout">
   <aside className="ia-beta-image-tools">{TOOLS.map(item=>{const Icon=item.icon;return <button key={item.id} className={tool===item.id?'is-selected':''} onClick={()=>setTool(item.id)}><Icon/><div><strong>{item.label}</strong><span>{item.description}</span></div></button>})}</aside>
   <section className="ia-beta-image-workspace">
    <div className="ia-beta-image-title"><div><span>{TOOLS.find(item=>item.id===tool)?.label}</span><h2>{TOOLS.find(item=>item.id===tool)?.description}</h2></div><small>{model?.name||'Indisponível'}</small></div>
    <div className="ia-beta-image-source">
      <div className="ia-beta-image-source-controls"><select value={sourceId} onChange={event=>setSourceId(event.target.value)}><option value="">Selecione da Library</option>{assets.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name}</option>)}</select><label><Upload/>{busy==='upload'?'Enviando…':'Upload'}<input type="file" accept="image/*" onChange={upload}/></label></div>
      <div className="ia-beta-image-canvas-shell">
       {source?.public_url?<img src={source.public_url} alt={source.name}/>:<div className="ia-beta-image-empty"><ImageIcon/><span>Selecione uma imagem</span></div>}
       {tool==='inpaint-mask'&&source&&<canvas ref={maskRef} width={1024} height={1024} className="ia-beta-image-mask" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>}
      </div>
      {tool==='inpaint-mask'&&<div className="ia-beta-image-maskbar"><label><Brush/> Pincel <input type="range" min={12} max={140} value={brushSize} onChange={event=>setBrushSize(Number(event.target.value))}/></label><button onClick={clearMask}><Eraser/>Limpar máscara</button><span>{maskDirty?'Área selecionada':'Pinte em branco a área que será alterada'}</span></div>}
    </div>
    {['image-edit','inpaint-mask','background-remove-replace','outpaint','variations'].includes(tool)&&<label className="ia-beta-image-field"><span>{tool==='background-remove-replace'&&backgroundMode==='REPLACE'?'Novo fundo':'Instrução'}</span><textarea rows={4} value={prompt} onChange={event=>{setPrompt(event.target.value);setJob(null)}} placeholder={tool==='outpaint'?'Ex.: continue a praia e o céu de forma natural…':tool==='variations'?'Opcional: mantenha o produto, mude iluminação e composição…':'Descreva o que deve mudar…'}/></label>}
    <div className="ia-beta-image-options">
      {tool==='background-remove-replace'&&<label><span>Fundo</span><select value={backgroundMode} onChange={event=>{setBackgroundMode(event.target.value as any);setJob(null)}}><option value="TRANSPARENT">Remover / transparente</option><option value="REPLACE">Substituir</option></select></label>}
      {tool==='outpaint'&&<label><span>Formato final</span><select value={aspectRatio} onChange={event=>{setAspectRatio(event.target.value);setJob(null)}}><option>1:1</option><option>16:9</option><option>9:16</option><option>4:3</option><option>3:4</option><option>21:9</option></select></label>}
      <label><span>Resolução</span><select value={resolution} onChange={event=>{setResolution(event.target.value);setJob(null)}}><option>1K</option><option>2K</option><option>4K</option></select></label>
      {tool==='variations'&&<label><span>Força · {Math.round(variationStrength*100)}%</span><input type="range" min={0.1} max={0.9} step={0.05} value={variationStrength} onChange={event=>{setVariationStrength(Number(event.target.value));setJob(null)}}/></label>}
    </div>
    {error&&<div className="ia-beta-image-error">{error}</div>}
    <div className="ia-beta-image-runbar"><div>{job?.quote?<><span>Cotação</span><strong>{job.quote.credit_price.toLocaleString('pt-BR')} créditos</strong><small>válida até {new Date(job.quote.expires_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></>:<><span>Preço</span><strong>Calcule antes de executar</strong></>}</div>{!job?.quote?<button className="is-primary" disabled={Boolean(busy)||!model||!source} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>:['DRAFT','QUOTED'].includes(job.status)?<div className="ia-beta-image-run-actions"><button onClick={()=>void quote()} disabled={Boolean(busy)}><RefreshCw/>Atualizar</button><button className="is-primary" onClick={()=>void execute()} disabled={Boolean(busy)}>{busy==='execute'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Aplicar edição</button></div>:<button disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{status(job)}</button>}</div>
    {job&&<section className="ia-beta-image-result"><div className="ia-beta-image-result-head"><div><span>Resultado</span><strong>{status(job)}</strong></div>{job.status==='SUCCEEDED'&&<CheckCircle2/>}</div>{['QUEUED','RUNNING'].includes(job.status)&&<p>A edição continua no Task Center.</p>}{job.status==='FAILED'&&<p>{job.error_message||'A edição não pôde ser concluída.'}</p>}{job.status==='SUCCEEDED'&&result?.public_url&&<div className="ia-beta-image-result-grid"><div><span>Original</span><img src={source?.public_url||''} alt="Original"/></div><div><span>Derivada</span><img src={result.public_url} alt="Resultado"/></div></div>}{job.status==='SUCCEEDED'&&<div className="ia-beta-image-result-actions"><button onClick={onOpenLibrary}>Abrir na Library</button></div>}</section>}
   </section>
  </div>
 </main>;
};
