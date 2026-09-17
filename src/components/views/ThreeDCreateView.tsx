import React,{useCallback,useEffect,useMemo,useState}from'react';
import{Box,Boxes,CheckCircle2,Download,Image as ImageIcon,Layers3,LoaderCircle,RefreshCw,Sparkles,Upload,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{threeDGenerationClient,ThreeDCapability,ThreeDJob,ThreeDModel}from'../../services/threeDGenerationClient.js';
import{Asset}from'../../types/index.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
import{StableModel3DPreview}from'../workspace/StableModel3DPreview.js';
import'../../styles/three-d-create.css';

type Tool=ThreeDCapability;
const TOOLS:Array<{id:Tool;label:string;description:string;icon:React.ComponentType<{className?:string}>}>=[
 {id:'text-to-3d',label:'Texto → 3D',description:'Crie um objeto 3D a partir de uma descrição.',icon:Box},
 {id:'image-to-3d',label:'Imagem → 3D',description:'Reconstrua um objeto usando uma imagem.',icon:ImageIcon},
 {id:'multi-image-to-3d',label:'Multiimagem → 3D',description:'Combine de 2 a 4 vistas do mesmo objeto.',icon:Boxes},
];
const terminal=(status?:string)=>['SUCCEEDED','FAILED','CANCELLED'].includes(String(status||''));
const message=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';

export const ThreeDCreateView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[tool,setTool]=useState<Tool>('text-to-3d');
 const[models,setModels]=useState<ThreeDModel[]>([]);
 const[selectedModelId,setSelectedModelId]=useState('');
 const[selectedProviderId,setSelectedProviderId]=useState('AUTO');
 const[images,setImages]=useState<Asset[]>([]);
 const[selectedIds,setSelectedIds]=useState<string[]>([]);
 const[prompt,setPrompt]=useState('');
 const[meshMode,setMeshMode]=useState<'TEXTURED'|'LOW_POLY'|'GEOMETRY'>('TEXTURED');
 const[pbr,setPbr]=useState(false);
 const[targetFaces,setTargetFaces]=useState(500000);
 const[topology,setTopology]=useState<'TRIANGLE'|'QUAD'>('TRIANGLE');
 const[job,setJob]=useState<ThreeDJob|null>(null);
 const[result,setResult]=useState<Asset|null>(null);
 const[busy,setBusy]=useState('load');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const load=useCallback(async()=>{
  setBusy(current=>current||'load');setError('');
  try{
   const[catalog,assetRows]=await Promise.all([threeDGenerationClient.catalog(),assetService.listAssets({type:'IMAGE'})]);
   setModels(catalog);setImages(assetRows);
   setSelectedModelId(current=>catalog.some(model=>model.model_id===current)?current:(catalog.find(model=>model.model_id==='AUTO')?.model_id||catalog[0]?.model_id||''));
  }catch(err){setError(message(err));}
  finally{setBusy(current=>current==='load'?'':current);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const availableModels=useMemo(()=>models.filter(model=>model.capabilities.some(cap=>cap.id===tool)),[models,tool]);
 const model=useMemo(()=>availableModels.find(item=>item.model_id===selectedModelId)||availableModels.find(item=>item.model_id==='AUTO')||availableModels[0]||null,[availableModels,selectedModelId]);
 const providerOptions=useMemo(()=>(model?.providers||[]).filter(provider=>provider.capability_ids.includes(tool)),[model,tool]);
 const routeReady=providerOptions.length>0;
 const selectedProviderName=selectedProviderId==='AUTO'?'AUTO · melhor rota':providerOptions.find(provider=>provider.provider_id===selectedProviderId)?.name||selectedProviderId;
 const invalidate=()=>{setJob(null);setResult(null);setPollCount(0);setError('');};
 useEffect(()=>{const fallback=availableModels.find(item=>item.model_id==='AUTO')?.model_id||availableModels[0]?.model_id||'';if(!availableModels.some(item=>item.model_id===selectedModelId))setSelectedModelId(fallback);setSelectedProviderId('AUTO');invalidate();},[tool]);
 useEffect(()=>{if(selectedProviderId!=='AUTO'&&!providerOptions.some(provider=>provider.provider_id===selectedProviderId))setSelectedProviderId('AUTO');},[providerOptions,selectedProviderId]);

 useEffect(()=>{
  if(!job||terminal(job.status)||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=180)return;
  const timer=window.setTimeout(async()=>{try{setJob(await threeDGenerationClient.get(job.job_id));setPollCount(value=>value+1);}catch(err){setError(message(err));setPollCount(180);}},Math.min(7000,2000+pollCount*100));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);
 useEffect(()=>{
  if(job?.status!=='SUCCEEDED')return;
  void refreshWallet();
  const assetId=job.result_asset_ids?.[0];
  if(assetId)void threeDGenerationClient.asset(assetId).then(setResult).catch(()=>setResult(null));
  window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'THREE_D',asset_ids:job.result_asset_ids||[]}}));
 },[job?.status,job?.result_asset_ids,refreshWallet]);

 const toggleImage=(id:string)=>{invalidate();if(tool==='image-to-3d'){setSelectedIds([id]);return;}setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):current.length<4?[...current,id]:current);};
 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const files:File[]=event.target.files?Array.from(event.target.files):[];event.target.value='';if(!files.length)return;
  setBusy('upload');setError('');
  try{
   const next:Asset[]=[];
   for(const file of files.slice(0,tool==='multi-image-to-3d'?4:1))next.push(await assetService.uploadAsset({file,name:file.name}));
   setImages(current=>[...next,...current.filter(row=>!next.some(item=>item.asset_id===row.asset_id))]);
   setSelectedIds(current=>tool==='image-to-3d'?[next[0].asset_id]:Array.from(new Set([...current,...next.map(item=>item.asset_id)])).slice(0,4));invalidate();
  }catch(err){setError(message(err));}finally{setBusy('');}
 };

 const buildRequest=()=>{
  if(!model)throw new Error('Nenhum modelo 3D está disponível agora.');
  if(!routeReady)throw new Error('Este modelo ainda não possui provider com mapping e preço verificados.');
  if(tool==='text-to-3d'&&!prompt.trim())throw new Error('Descreva o objeto que deseja criar.');
  if(tool==='image-to-3d'&&selectedIds.length!==1)throw new Error('Selecione uma imagem de referência.');
  if(tool==='multi-image-to-3d'&&(selectedIds.length<2||selectedIds.length>4))throw new Error('Selecione de 2 a 4 imagens do mesmo objeto.');
  const pricing_options=selectedProviderId==='AUTO'?{}:{preferred_provider_id:selectedProviderId};
  return{capability_id:tool,model_id:model.model_id,prompt:prompt.trim(),references:selectedIds.map(asset_id=>({asset_id,slot_type:'GENERAL' as const})),controls:{output_format:'glb',mesh_mode:meshMode,pbr:meshMode==='GEOMETRY'?false:pbr,target_faces:targetFaces,topology,pricing_options}};
 };
 const quote=async()=>{setBusy('quote');setError('');setJob(null);setResult(null);try{const created=await threeDGenerationClient.create(buildRequest());setJob(await threeDGenerationClient.quote(created.job_id));setPollCount(0);}catch(err){setError(message(err));}finally{setBusy('');}};
 const generate=async()=>{if(!job)return;setBusy('generate');setError('');try{setJob(await threeDGenerationClient.queue(job.job_id));setPollCount(0);}catch(err){setError(message(err));}finally{setBusy('');}};

 const balance=wallet?.available_credits??0,price=job?.quote?.credit_price??null,insufficient=price!=null&&balance<price;
 const status=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='CANCELLED'?'Cancelado':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';

 return <div className="ia-three-d-studio">
  <section className="ia-three-d-creator" aria-label="Gerador 3D">
   <header className="ia-three-d-heading"><div className="ia-three-d-heading-icon"><Layers3/></div><div><span>GERADOR 3D</span><h1>Do conceito ao asset 3D.</h1><p>Gere GLB por texto ou imagens usando os mesmos créditos, Jobs e Assets do IA Connect.</p></div></header>
   <div className="ia-three-d-tools">{TOOLS.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={tool===item.id?'is-selected':''} onClick={()=>setTool(item.id)}><Icon/><span><strong>{item.label}</strong><small>{item.description}</small></span></button>})}</div>
   <div className="ia-three-d-modelbar">
    <label><span>IA / modelo</span><select value={model?.model_id||''} disabled={!availableModels.length} onChange={event=>{setSelectedModelId(event.target.value);setSelectedProviderId('AUTO');invalidate();}}>{availableModels.map(item=><option key={item.model_id} value={item.model_id}>{item.model_id==='AUTO'?'AUTO · Melhor modelo disponível':item.name}</option>)}</select></label>
    <label><span>Provider</span><select value={selectedProviderId} disabled={!routeReady} onChange={event=>{setSelectedProviderId(event.target.value);invalidate();}}>{routeReady?<><option value="AUTO">AUTO · Mais econômico/saudável</option>{providerOptions.map(provider=><option key={provider.provider_id} value={provider.provider_id}>{provider.name}</option>)}</>:<option value="AUTO">Nenhum provider verificado</option>}</select></label>
    <div className="ia-three-d-routing"><strong>{model?.name||'Carregando…'}</strong><small>{routeReady?`Provider: ${selectedProviderName}. A cotação continua server-authoritative.`:'Sem rota segura publicada para esta modalidade.'}</small></div>
   </div>

   {tool==='text-to-3d'?<div className="ia-three-d-field"><div className="ia-three-d-label-row"><label htmlFor="three-d-prompt">Descrição do objeto</label><span>{prompt.length.toLocaleString('pt-BR')} caracteres</span></div><textarea id="three-d-prompt" rows={6} value={prompt} maxLength={4000} onChange={event=>{setPrompt(event.target.value);invalidate();}} placeholder="Ex.: cadeira lounge escultural em nogueira, almofada de couro caramelo, proporções realistas…"/></div>:
   <div className="ia-three-d-field"><div className="ia-three-d-label-row"><label>{tool==='image-to-3d'?'Imagem de referência':'Vistas do mesmo objeto'}</label><label className="ia-three-d-upload"><Upload/>{busy==='upload'?'Enviando…':'Upload'}<input type="file" accept="image/*" multiple={tool==='multi-image-to-3d'} disabled={busy==='upload'} onChange={upload}/></label></div><div className="ia-three-d-image-grid">{images.slice(0,20).map(asset=><button type="button" key={asset.asset_id} className={selectedIds.includes(asset.asset_id)?'is-selected':''} onClick={()=>toggleImage(asset.asset_id)}><img src={asset.thumbnail_url||asset.public_url||''} alt={asset.name}/><span>{asset.name}</span><small>{selectedIds.includes(asset.asset_id)?selectedIds.indexOf(asset.asset_id)+1:'+'}</small></button>)}</div>{tool==='multi-image-to-3d'&&<p className="ia-three-d-help">Selecione 2–4 vistas. A ordem escolhida é preservada para o executor 3D.</p>}</div>}

   <div className="ia-three-d-options"><label><span>Tipo de malha</span><select value={meshMode} onChange={event=>{setMeshMode(event.target.value as any);invalidate();}}><option value="TEXTURED">Texturizada</option><option value="LOW_POLY">Low poly</option><option value="GEOMETRY">Somente geometria</option></select></label><label><span>Topologia</span><select value={topology} onChange={event=>{setTopology(event.target.value as any);invalidate();}}><option value="TRIANGLE">Triângulos</option><option value="QUAD">Quads</option></select></label><label className="is-range"><span>Faces alvo · {targetFaces.toLocaleString('pt-BR')}</span><input type="range" min={40000} max={1500000} step={20000} value={targetFaces} onChange={event=>{setTargetFaces(Number(event.target.value));invalidate();}}/></label><label className="is-check"><input type="checkbox" checked={pbr} disabled={meshMode==='GEOMETRY'} onChange={event=>{setPbr(event.target.checked);invalidate();}}/><span>Materiais PBR</span></label></div>

   {error&&<div className="ia-three-d-error" role="status">{error}</div>}
   <section className="ia-three-d-price"><div><span>Créditos</span><strong>{price==null?'Calcule antes de gerar':`${price.toLocaleString('pt-BR')} créditos`}</strong>{price!=null&&<small>{insufficient?'Saldo insuficiente para esta geração.':`Saldo disponível: ${balance.toLocaleString('pt-BR')} créditos`}</small>}</div>{!job?.quote?<button className="ia-three-d-primary" disabled={Boolean(busy)||!model||!routeReady} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>:['DRAFT','QUOTED'].includes(job.status)?<div className="ia-three-d-actions"><button disabled={Boolean(busy)} onClick={()=>void quote()}><RefreshCw/>Atualizar</button><button className="ia-three-d-primary" disabled={Boolean(busy)||insufficient} onClick={()=>void generate()}>{busy==='generate'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Gerar 3D</button></div>:<button disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{status}</button>}</section>
   {job&&<section className="ia-three-d-current"><div className="ia-three-d-current-head"><div><span>Resultado atual</span><strong>{status}</strong></div>{job.status==='SUCCEEDED'?<CheckCircle2/>:<Box/>}</div>{job.quote&&<p>Modelo: <strong>{job.quote.selected_model_id}</strong> · {job.quote.routing_mode==='AUTO'?'roteamento AUTO':'modelo manual'} · provider solicitado: <strong>{selectedProviderName}</strong>.</p>}{['QUEUED','RUNNING'].includes(job.status)&&<p>A geração continua no sistema de tarefas e pode levar alguns minutos.</p>}{job.status==='FAILED'&&<p>{job.error_message||'A geração 3D não pôde ser concluída.'}</p>}{job.status==='SUCCEEDED'&&result?.public_url&&<><StableModel3DPreview url={result.public_url} label={result.name}/><a className="ia-three-d-download" href={result.public_url} target="_blank" rel="noreferrer"><Download/>Abrir GLB gerado</a></>}{job.status==='SUCCEEDED'&&!result?.public_url&&<p>Asset concluído. Sincronizando o arquivo 3D…</p>}</section>}
  </section>
  <section className="ia-three-d-creations"><CreationGallery defaultFilter="THREE_D" title="Minhas criações" subtitle="O mesmo histórico universal de Imagem, Vídeo, Voz, Música e 3D."/></section>
 </div>;
};

export default ThreeDCreateView;