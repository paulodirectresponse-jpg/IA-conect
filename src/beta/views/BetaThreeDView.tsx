import React,{useCallback,useEffect,useMemo,useState}from'react';
import{Box,Boxes,CheckCircle2,Download,Image as ImageIcon,Layers3,LoaderCircle,RefreshCw,Sparkles,Upload,WandSparkles}from'lucide-react';
import{betaThreeDClient}from'../threeDClient.js';
import{BetaCapabilityModel}from'../capabilityClient.js';
import{betaJobClient,BetaJobView}from'../jobClient.js';
import{universalAssetClient,UniversalAssetView}from'../universalAssetClient.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{Model3DPreview}from'../components/Model3DPreview.js';

type Tool='text-to-3d'|'image-to-3d'|'multi-image-to-3d';

const TOOLS:Array<{id:Tool;label:string;description:string;icon:React.ComponentType<any>}>= [
 {id:'text-to-3d',label:'Texto → 3D',description:'Descreva um objeto e gere a malha.',icon:Box},
 {id:'image-to-3d',label:'Imagem → 3D',description:'Reconstrua um objeto a partir de uma vista.',icon:ImageIcon},
 {id:'multi-image-to-3d',label:'Multiimagem → 3D',description:'Combine de 2 a 4 vistas do mesmo objeto.',icon:Boxes},
];

function errorMessage(error:any){return error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';}
function statusLabel(job:BetaJobView|null){return job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='CANCELLED'?'Cancelado':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Cotado':'Rascunho';}

export const BetaThreeDView:React.FC<{onOpenLibrary?:()=>void}>=({onOpenLibrary})=>{
 const[tool,setTool]=useState<Tool>('text-to-3d');
 const[catalog,setCatalog]=useState<BetaCapabilityModel[]>([]);
 const[images,setImages]=useState<UniversalAssetView[]>([]);
 const[prompt,setPrompt]=useState('');
 const[selectedIds,setSelectedIds]=useState<string[]>([]);
 const[meshMode,setMeshMode]=useState<'TEXTURED'|'LOW_POLY'|'GEOMETRY'>('TEXTURED');
 const[pbr,setPbr]=useState(false);
 const[targetFaces,setTargetFaces]=useState(500000);
 const[topology,setTopology]=useState<'TRIANGLE'|'QUAD'>('TRIANGLE');
 const[job,setJob]=useState<BetaJobView|null>(null);
 const[resultAsset,setResultAsset]=useState<UniversalAssetView|null>(null);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const load=useCallback(async()=>{
  try{
   const[models,assets]=await Promise.all([betaThreeDClient.catalog(),universalAssetClient.list({type:'IMAGE'})]);
   setCatalog(models);setImages(assets);
  }catch(err){setError(errorMessage(err));}
 },[]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{setSelectedIds([]);setJob(null);setResultAsset(null);setError('');setPollCount(0);},[tool]);
 useEffect(()=>{
  if(!job||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=180)return;
  const timer=window.setTimeout(async()=>{try{setJob(await betaJobClient.get(job.job_id));setPollCount(v=>v+1);}catch(err){setError(errorMessage(err));setPollCount(180);}},Math.min(7000,2000+pollCount*100));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);
 useEffect(()=>{
  const id=job?.status==='SUCCEEDED'?job.result_asset_ids?.[0]:null;
  if(!id){if(job?.status!=='SUCCEEDED')setResultAsset(null);return;}
  void universalAssetClient.get(id).then(setResultAsset).catch(()=>setResultAsset(null));
 },[job?.status,job?.result_asset_ids?.[0]]);

 const model=useMemo(()=>catalog.find(item=>item.capabilities.some(cap=>cap.id===tool)),[catalog,tool]);
 const selected=selectedIds.map(id=>images.find(asset=>asset.asset_id===id)).filter(Boolean) as UniversalAssetView[];
 const clearQuote=()=>{setJob(null);setResultAsset(null);};

 const toggleImage=(id:string)=>{
  clearQuote();
  if(tool==='image-to-3d'){setSelectedIds([id]);return;}
  setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):current.length<4?[...current,id]:current);
 };

 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const files:File[]=event.target.files?Array.from(event.target.files):[];event.target.value='';if(!files.length)return;
  setBusy('upload');setError('');
  try{
   const next:UniversalAssetView[]=[];
   for(const file of files.slice(0,tool==='multi-image-to-3d'?4:1)){
    const asset=await assetService.uploadAsset({file,name:file.name});
    next.push(await universalAssetClient.get(asset.asset_id));
   }
   setImages(current=>[...next,...current.filter(row=>!next.some(item=>item.asset_id===row.asset_id))]);
   setSelectedIds(current=>tool==='image-to-3d'?[next[0].asset_id]:Array.from(new Set([...current,...next.map(item=>item.asset_id)])).slice(0,4));
   clearQuote();
  }catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };

 const buildRequest=()=>{
  if(!model)throw new Error('Nenhum modelo 3D elegível está disponível.');
  if(tool==='text-to-3d'&&!prompt.trim())throw new Error('Descreva o objeto que deseja criar.');
  if(tool==='image-to-3d'&&selectedIds.length!==1)throw new Error('Selecione uma imagem.');
  if(tool==='multi-image-to-3d'&&(selectedIds.length<2||selectedIds.length>4))throw new Error('Selecione de 2 a 4 imagens do mesmo objeto.');
  return{
   capability_id:tool,model_id:model.model_id,prompt:prompt.trim(),
   references:selectedIds.map(asset_id=>({asset_id,slot_type:'GENERAL' as const})),
   controls:{output_format:'glb',mesh_mode:meshMode,pbr:meshMode==='GEOMETRY'?false:pbr,target_faces:targetFaces,topology},
  };
 };
 const quote=async()=>{
  setBusy('quote');setError('');setJob(null);setResultAsset(null);
  try{const created=await betaJobClient.create(buildRequest());setJob(await betaJobClient.quote(created.job_id));setPollCount(0);}
  catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };
 const execute=async()=>{if(!job)return;setBusy('execute');setError('');try{setJob(await betaJobClient.queue(job.job_id));setPollCount(0);}catch(err){setError(errorMessage(err));}finally{setBusy('');}};

 return <main className="ia-beta-3d">
  <section className="ia-beta-3d-head">
   <div><span><Layers3/> 3D V1</span><h1>Do conceito ao asset 3D.</h1><p>Gere modelos por texto ou referências visuais, configure geometria e materiais, visualize o GLB e reutilize o asset na Library.</p></div>
   <button onClick={()=>void load()}><RefreshCw/><span>Atualizar</span></button>
  </section>

  <div className="ia-beta-3d-layout">
   <aside className="ia-beta-3d-tools">{TOOLS.map(item=>{const Icon=item.icon;return <button key={item.id} className={tool===item.id?'is-selected':''} onClick={()=>setTool(item.id)}><Icon/><div><strong>{item.label}</strong><span>{item.description}</span></div></button>})}</aside>

   <section className="ia-beta-3d-workspace">
    <div className="ia-beta-3d-title"><div><span>{TOOLS.find(item=>item.id===tool)?.label}</span><h2>{TOOLS.find(item=>item.id===tool)?.description}</h2></div><small>{model?model.name:'Indisponível'}</small></div>

    {tool==='text-to-3d'&&<label className="ia-beta-3d-field"><span>Descrição do objeto</span><textarea rows={6} value={prompt} onChange={e=>{setPrompt(e.target.value);clearQuote();}} placeholder="Ex.: cadeira lounge escultural, madeira nogueira, almofada de couro caramelo, proporções realistas…"/></label>}

    {tool!=='text-to-3d'&&<div className="ia-beta-3d-field"><div className="ia-beta-3d-field-head"><span>{tool==='image-to-3d'?'Imagem de referência':'Vistas do objeto'}</span><label className="ia-beta-3d-upload"><Upload/>{busy==='upload'?'Enviando…':'Upload'}<input type="file" accept="image/*" multiple={tool==='multi-image-to-3d'} disabled={busy==='upload'} onChange={upload}/></label></div>
      <div className="ia-beta-3d-image-grid">{images.slice(0,24).map(asset=><button key={asset.asset_id} className={selectedIds.includes(asset.asset_id)?'is-selected':''} onClick={()=>toggleImage(asset.asset_id)}><img src={asset.preview_url||asset.public_url||''} alt=""/><span>{asset.name}</span><small>{selectedIds.includes(asset.asset_id)?selectedIds.indexOf(asset.asset_id)+1:'+'}</small></button>)}</div>
      {tool==='multi-image-to-3d'&&<p className="ia-beta-3d-help">Use 2–4 imagens do mesmo objeto. A ordem selecionada é frente, trás, esquerda e direita.</p>}
    </div>}

    <div className="ia-beta-3d-options">
     <label><span>Tipo de malha</span><select value={meshMode} onChange={e=>{setMeshMode(e.target.value as any);clearQuote();}}><option value="TEXTURED">Texturizada</option><option value="LOW_POLY">Low poly</option><option value="GEOMETRY">Somente geometria</option></select></label>
     <label><span>Topologia</span><select value={topology} onChange={e=>{setTopology(e.target.value as any);clearQuote();}}><option value="TRIANGLE">Triângulos</option><option value="QUAD">Quads</option></select></label>
     <label><span>Faces alvo · {targetFaces.toLocaleString('pt-BR')}</span><input type="range" min={40000} max={1500000} step={20000} value={targetFaces} onChange={e=>{setTargetFaces(Number(e.target.value));clearQuote();}}/></label>
     <label className="is-check"><input type="checkbox" checked={pbr} disabled={meshMode==='GEOMETRY'} onChange={e=>{setPbr(e.target.checked);clearQuote();}}/><span>Materiais PBR</span></label>
    </div>

    {error&&<div className="ia-beta-3d-error" role="status">{error}</div>}

    <div className="ia-beta-3d-runbar">
     <div>{job?.quote?<><span>Cotação</span><strong>{job.quote.credit_price.toLocaleString('pt-BR')} créditos</strong><small>válida até {new Date(job.quote.expires_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></>:<><span>Preço</span><strong>Calcule antes de executar</strong></>}</div>
     {!job?.quote?<button className="is-primary" disabled={Boolean(busy)||!model} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>:
      ['DRAFT','QUOTED'].includes(job.status)?<div className="ia-beta-3d-run-actions"><button onClick={()=>void quote()} disabled={Boolean(busy)}><RefreshCw/>Atualizar</button><button className="is-primary" onClick={()=>void execute()} disabled={Boolean(busy)}>{busy==='execute'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Gerar 3D</button></div>:
      <button disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{statusLabel(job)}</button>}
    </div>

    {job&&<section className="ia-beta-3d-result">
      <div className="ia-beta-3d-result-head"><div><span>Resultado</span><strong>{statusLabel(job)}</strong></div>{job.status==='SUCCEEDED'&&<CheckCircle2/>}</div>
      {['QUEUED','RUNNING'].includes(job.status)&&<p>A geração continua no Task Center e pode levar alguns minutos.</p>}
      {job.status==='FAILED'&&<p>{job.error_message||'A geração 3D não pôde ser concluída.'}</p>}
      {job.status==='SUCCEEDED'&&resultAsset?.public_url&&<><Model3DPreview url={resultAsset.public_url} label={resultAsset.name}/><div className="ia-beta-3d-result-actions"><a href={resultAsset.public_url} target="_blank" rel="noreferrer"><Download/>Abrir GLB</a><button onClick={onOpenLibrary}>Abrir na Library</button></div></>}
    </section>}
   </section>
  </div>
 </main>;
};
