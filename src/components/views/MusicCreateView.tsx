import React,{useCallback,useEffect,useMemo,useState}from'react';
import{Disc3,LoaderCircle,Music2,RefreshCw,Sparkles,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{musicGenerationClient,MusicJob,MusicModel}from'../../services/musicGenerationClient.js';
import{Asset}from'../../types/index.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
import'../../styles/music-create.css';

const PREFERRED_DURATIONS=[15,30,60,90,120,180,240];
const FALLBACK_DURATIONS=[30,60,120];
const terminal=(status?:string)=>['SUCCEEDED','FAILED','CANCELLED'].includes(String(status||''));
const message=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';

export const MusicCreateView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[models,setModels]=useState<MusicModel[]>([]);
 const[selectedModelId,setSelectedModelId]=useState('');
 const[selectedProviderId,setSelectedProviderId]=useState('AUTO');
 const[prompt,setPrompt]=useState('');
 const[duration,setDuration]=useState(60);
 const[format,setFormat]=useState('mp3');
 const[instrumental,setInstrumental]=useState(true);
 const[seed,setSeed]=useState<number|''>('');
 const[job,setJob]=useState<MusicJob|null>(null);
 const[currentAsset,setCurrentAsset]=useState<Asset|null>(null);
 const[busy,setBusy]=useState('load');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const loadCurrentAsset=useCallback(async(assetId?:string)=>{
  if(!assetId)return setCurrentAsset(null);
  const rows=await assetService.listAssets({type:'AUDIO',origin:'GENERATED'}).catch(()=>[]);
  setCurrentAsset(rows.find(asset=>asset.asset_id===assetId)||null);
 },[]);
 const load=useCallback(async()=>{
  setBusy(current=>current||'load');setError('');
  try{
   const available=(await musicGenerationClient.catalog()).filter(model=>model.capabilities.some(capability=>capability.id==='music'));
   setModels(available);
   setSelectedModelId(current=>available.some(model=>model.model_id===current)?current:(available.find(model=>model.model_id==='AUTO')?.model_id||available[0]?.model_id||''));
  }catch(err){setError(message(err));}
  finally{setBusy(current=>current==='load'?'':current);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const model=useMemo(()=>models.find(item=>item.model_id===selectedModelId)||null,[models,selectedModelId]);
 const capability=useMemo(()=>model?.capabilities.find(item=>item.id==='music')||null,[model]);
 const providerOptions=model?.providers||[];
 const routeReady=providerOptions.length>0;
 const selectedProviderName=selectedProviderId==='AUTO'?'AUTO · melhor rota':providerOptions.find(provider=>provider.provider_id===selectedProviderId)?.name||selectedProviderId;
 const durations=useMemo(()=>{
  const values:number[]=(capability?.supported_durations?.length?capability.supported_durations:model?.supported_durations)||[];
  const clean:number[]=Array.from(new Set<number>(values.map(value=>Number(value)).filter((value:number)=>Number.isFinite(value)&&value>0))).sort((a:number,b:number)=>a-b);
  if(!clean.length)return FALLBACK_DURATIONS;
  const allowed=new Set<number>(clean),preferred=PREFERRED_DURATIONS.filter(value=>allowed.has(value));
  if(preferred.length)return preferred;
  return Array.from(new Set<number>([clean[0],clean[Math.floor((clean.length-1)/2)],clean[clean.length-1]])).filter((value):value is number=>Number.isFinite(value));
 },[capability,model]);
 const supportsSeed=Boolean(capability?.controls?.includes('seed'));
 useEffect(()=>{if(!durations.includes(duration))setDuration(durations.includes(60)?60:durations[0]);},[durations,duration]);
 useEffect(()=>{if(selectedProviderId!=='AUTO'&&!providerOptions.some(provider=>provider.provider_id===selectedProviderId))setSelectedProviderId('AUTO');},[selectedModelId,providerOptions,selectedProviderId]);
 const invalidate=()=>{setJob(null);setCurrentAsset(null);setPollCount(0);setError('');};

 useEffect(()=>{
  if(!job||terminal(job.status)||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=160)return;
  const timer=window.setTimeout(async()=>{
   try{const next=await musicGenerationClient.get(job.job_id);setJob(next);setPollCount(value=>value+1);}
   catch(err){setError(message(err));setPollCount(160);}
  },Math.min(6500,1800+pollCount*120));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);

 useEffect(()=>{
  if(job?.status!=='SUCCEEDED')return;
  void refreshWallet();
  const assetId=job.result_asset_ids?.[0];
  void loadCurrentAsset(assetId);
  const timer=window.setTimeout(()=>void loadCurrentAsset(assetId),900);
  window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'MUSIC',asset_ids:job.result_asset_ids||[]}}));
  return()=>window.clearTimeout(timer);
 },[job?.status,job?.result_asset_ids,loadCurrentAsset,refreshWallet]);

 const quote=async()=>{
  if(!prompt.trim())return setError('Descreva a música que deseja criar.');
  if(!model)return setError('Nenhum modelo de música está disponível agora.');
  if(!routeReady)return setError('Este modelo ainda não possui provider com mapping e preço verificados. Escolha outro modelo.');
  setBusy('quote');setError('');setJob(null);setCurrentAsset(null);
  try{
   const pricing_options=selectedProviderId==='AUTO'?{}:{preferred_provider_id:selectedProviderId};
   const created=await musicGenerationClient.create({model_id:model.model_id,prompt:prompt.trim(),controls:{duration_seconds:duration,instrumental,output_format:format,seed:supportsSeed?(seed===''?null:seed):undefined,pricing_options}});
   setJob(await musicGenerationClient.quote(created.job_id));setPollCount(0);
  }catch(err){setError(message(err));}
  finally{setBusy('');}
 };
 const generate=async()=>{
  if(!job)return;
  setBusy('generate');setError('');
  try{setJob(await musicGenerationClient.queue(job.job_id));setPollCount(0);}
  catch(err){setError(message(err));}
  finally{setBusy('');}
 };

 const balance=wallet?.available_credits??0;
 const price=job?.quote?.credit_price??null;
 const insufficient=price!=null&&balance<price;
 const status=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';
 const selectedName=model?.name||selectedModelId;

 return <div className="ia-music-studio">
  <section className="ia-music-creator" aria-label="Gerador de música">
   <header className="ia-music-heading">
    <div className="ia-music-heading-icon"><Music2/></div>
    <div><span>GERADOR DE MÚSICA</span><h1>Transforme uma ideia em música.</h1><p>Escolha a IA e, se quiser, o provider. Só rotas com mapping e preço verificados ficam disponíveis.</p></div>
   </header>

   <div className="ia-music-modelbar">
    <label htmlFor="music-model"><span>IA / modelo</span><select id="music-model" value={selectedModelId} disabled={busy==='load'||!models.length} onChange={event=>{setSelectedModelId(event.target.value);setSelectedProviderId('AUTO');invalidate();}}>{models.map(item=><option key={item.model_id} value={item.model_id}>{item.model_id==='AUTO'?'AUTO · Melhor modelo disponível':item.name}</option>)}</select></label>
    <label htmlFor="music-provider"><span>Provider</span><select id="music-provider" value={selectedProviderId} disabled={!routeReady} onChange={event=>{setSelectedProviderId(event.target.value);invalidate();}}>{routeReady?<><option value="AUTO">AUTO · Mais econômico/saudável</option>{providerOptions.map(provider=><option key={provider.provider_id} value={provider.provider_id}>{provider.name}</option>)}</>:<option value="AUTO">Nenhum provider verificado</option>}</select></label>
    <div className={`ia-music-routing ${selectedModelId==='AUTO'?'is-auto':'is-manual'}`}><span>{selectedModelId==='AUTO'?'AUTO':'MODELO FIXO'}</span><strong>{selectedName||'Carregando...'}</strong><small>{routeReady?`Provider: ${selectedProviderName}. ${selectedProviderId==='AUTO'?'O sistema escolhe uma rota economicamente segura.':'A rota fica restrita ao provider escolhido e continua sujeita aos bloqueios de custo e saldo.'}`:'Sem rota segura publicada; o modelo permanece indisponível para geração.'}</small></div>
   </div>

   <div className="ia-music-field ia-music-text-field">
    <div className="ia-music-label-row"><label htmlFor="music-prompt">Descrição da música</label><span>{prompt.length.toLocaleString('pt-BR')} caracteres</span></div>
    <textarea id="music-prompt" rows={9} value={prompt} maxLength={4000} onChange={event=>{setPrompt(event.target.value);invalidate();}} placeholder="Ex.: trilha cinematográfica emocional, piano suave, cordas crescendo, sem vocais, atmosfera inspiradora…"/>
   </div>

   <div className="ia-music-options">
    <label><span>Duração</span><select value={duration} onChange={event=>{setDuration(Number(event.target.value));invalidate();}}>{durations.map(value=><option key={value} value={value}>{value}s</option>)}</select></label>
    <label><span>Formato</span><select value={format} onChange={event=>{setFormat(event.target.value);invalidate();}}><option value="mp3">MP3</option><option value="wav">WAV</option></select></label>
    {supportsSeed&&<label><span>Seed</span><input type="number" min="0" value={seed} onChange={event=>{setSeed(event.target.value===''?'':Number(event.target.value));invalidate();}} placeholder="Automática"/></label>}
   </div>

   <label className="ia-music-toggle"><input type="checkbox" checked={instrumental} onChange={event=>{setInstrumental(event.target.checked);invalidate();}}/><span className="ia-music-toggle-control"/><span><strong>Instrumental</strong><small>{instrumental?'Gerar sem vocais.':'Permitir vocais quando o modelo suportar.'}</small></span></label>

   {error&&<div className="ia-music-error" role="status">{error}</div>}

   <section className="ia-music-price">
    <div className="ia-music-price-copy">
     <span>Créditos</span>
     <strong>{price==null?'Calcule antes de gerar':`${price.toLocaleString('pt-BR')} créditos`}</strong>
     {price!=null&&<small>{insufficient?'Saldo insuficiente para esta geração.':`Saldo disponível: ${balance.toLocaleString('pt-BR')} créditos`}</small>}
    </div>
    {!job?.quote?<button className="ia-music-primary" disabled={Boolean(busy)||!prompt.trim()||!model||!routeReady} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>
     :['DRAFT','QUOTED'].includes(job.status)?<div className="ia-music-actions"><button disabled={Boolean(busy)} onClick={()=>void quote()}><RefreshCw/>Atualizar</button><button className="ia-music-primary" disabled={Boolean(busy)||insufficient} onClick={()=>void generate()}>{busy==='generate'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Gerar música</button></div>
     :<button className="ia-music-status" disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{status}</button>}
   </section>

   {job&&<section className="ia-music-current">
    <div className="ia-music-current-head"><div><span>Resultado atual</span><strong>{status}</strong></div><Disc3 className={['QUEUED','RUNNING'].includes(job.status)?'is-spin-slow':''}/></div>
    {job.quote&&<p>Modelo selecionado: <strong>{models.find(item=>item.model_id===job.quote?.selected_model_id)?.name||job.quote.selected_model_id}</strong> · {job.quote.routing_mode==='AUTO'?'roteamento AUTO':'modelo manual'} · provider solicitado: <strong>{selectedProviderName}</strong>.</p>}
    {['QUEUED','RUNNING'].includes(job.status)&&<p>A composição continua sendo processada e também pode ser acompanhada pelo sistema de tarefas.</p>}
    {job.status==='FAILED'&&<p>{job.error_message||'A música não pôde ser gerada.'}</p>}
    {job.status==='SUCCEEDED'&&currentAsset?.public_url&&<audio controls preload="metadata" src={currentAsset.public_url}/>} 
    {job.status==='SUCCEEDED'&&!currentAsset?.public_url&&<p>Música concluída. Atualizando Minhas criações…</p>}
   </section>}
  </section>

  <section className="ia-music-creations" aria-label="Minhas criações">
   <CreationGallery defaultFilter="MUSIC" title="Minhas criações" subtitle="Imagens, vídeos, voz e música no mesmo histórico universal."/>
  </section>
 </div>;
};

export default MusicCreateView;
