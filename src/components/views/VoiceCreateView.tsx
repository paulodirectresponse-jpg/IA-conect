import React,{useCallback,useEffect,useMemo,useState}from'react';
import{AudioLines,Clock3,LoaderCircle,Mic2,RefreshCw,Sparkles,Volume2,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{voiceGenerationClient,VoiceJob}from'../../services/voiceGenerationClient.js';
import{Asset}from'../../types/index.js';
import'../../styles/voice-create.css';

const VOICES=[
 {id:'calm-female',label:'Feminina calma'},
 {id:'wise-female',label:'Feminina madura'},
 {id:'friendly',label:'Amigável'},
 {id:'casual-male',label:'Masculina casual'},
];
const LANGUAGES=[
 {id:'auto',label:'Detectar automaticamente'},
 {id:'pt',label:'Português'},
 {id:'en',label:'Inglês'},
 {id:'es',label:'Espanhol'},
 {id:'fr',label:'Francês'},
 {id:'de',label:'Alemão'},
];
const terminal=(status?:string)=>['SUCCEEDED','FAILED','CANCELLED'].includes(String(status||''));
const message=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';

export const VoiceCreateView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[models,setModels]=useState<Array<{model_id:string;name:string}>>([]);
 const[text,setText]=useState('');
 const[voice,setVoice]=useState('calm-female');
 const[language,setLanguage]=useState('auto');
 const[format,setFormat]=useState('mp3');
 const[job,setJob]=useState<VoiceJob|null>(null);
 const[creations,setCreations]=useState<Asset[]>([]);
 const[busy,setBusy]=useState('load');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const loadCreations=useCallback(async()=>{
  const rows=await assetService.listAssets({type:'AUDIO',origin:'GENERATED'}).catch(()=>[]);
  setCreations(rows.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)));
 },[]);
 const load=useCallback(async()=>{
  setBusy(current=>current||'load');setError('');
  try{
   const[catalog]=await Promise.all([voiceGenerationClient.catalog(),loadCreations()]);
   setModels(catalog.filter(model=>model.capabilities.some(capability=>capability.id==='text-to-speech')).map(model=>({model_id:model.model_id,name:model.name})));
  }catch(err){setError(message(err));}
  finally{setBusy(current=>current==='load'?'':current);}
 },[loadCreations]);
 useEffect(()=>{void load();},[load]);

 const modelId=useMemo(()=>models.find(model=>model.model_id==='AUTO')?.model_id||models[0]?.model_id||'',[models]);
 const invalidate=()=>{setJob(null);setPollCount(0);setError('');};

 useEffect(()=>{
  if(!job||terminal(job.status)||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=160)return;
  const timer=window.setTimeout(async()=>{
   try{const next=await voiceGenerationClient.get(job.job_id);setJob(next);setPollCount(value=>value+1);}
   catch(err){setError(message(err));setPollCount(160);}
  },Math.min(6500,1800+pollCount*120));
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);

 useEffect(()=>{
  if(job?.status!=='SUCCEEDED')return;
  void refreshWallet();
  void loadCreations();
  const timer=window.setTimeout(()=>void loadCreations(),900);
  return()=>window.clearTimeout(timer);
 },[job?.status,loadCreations,refreshWallet]);

 const quote=async()=>{
  if(!text.trim())return setError('Digite o texto que será narrado.');
  if(!modelId)return setError('Nenhum modelo de voz está disponível agora.');
  setBusy('quote');setError('');setJob(null);
  try{
   const created=await voiceGenerationClient.create({model_id:modelId,prompt:text.trim(),controls:{language,voice,output_format:format}});
   setJob(await voiceGenerationClient.quote(created.job_id));setPollCount(0);
  }catch(err){setError(message(err));}
  finally{setBusy('');}
 };
 const generate=async()=>{
  if(!job)return;
  setBusy('generate');setError('');
  try{setJob(await voiceGenerationClient.queue(job.job_id));setPollCount(0);}
  catch(err){setError(message(err));}
  finally{setBusy('');}
 };

 const resultId=job?.result_asset_ids?.[0];
 const result=creations.find(asset=>asset.asset_id===resultId)||null;
 const balance=wallet?.available_credits??0;
 const price=job?.quote?.credit_price??null;
 const insufficient=price!=null&&balance<price;
 const status=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';

 return <div className="ia-voice-studio">
  <section className="ia-voice-creator" aria-label="Gerador de voz">
   <header className="ia-voice-heading">
    <div className="ia-voice-heading-icon"><Mic2/></div>
    <div><span>GERADOR DE VOZ</span><h1>Transforme texto em voz.</h1><p>Escreva sua narração, escolha a voz e gere o áudio usando os mesmos créditos e criações do IA Connect.</p></div>
   </header>

   <div className="ia-voice-field ia-voice-text-field">
    <div className="ia-voice-label-row"><label htmlFor="voice-text">Texto</label><span>{text.length.toLocaleString('pt-BR')} caracteres</span></div>
    <textarea id="voice-text" rows={10} value={text} maxLength={12000} onChange={event=>{setText(event.target.value);invalidate();}} placeholder="Digite o texto que deseja transformar em voz…"/>
   </div>

   <div className="ia-voice-options">
    <label><span>Voz</span><select value={voice} onChange={event=>{setVoice(event.target.value);invalidate();}}>{VOICES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>Idioma</span><select value={language} onChange={event=>{setLanguage(event.target.value);invalidate();}}>{LANGUAGES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>Formato</span><select value={format} onChange={event=>{setFormat(event.target.value);invalidate();}}><option value="mp3">MP3</option><option value="wav">WAV</option></select></label>
   </div>

   {error&&<div className="ia-voice-error" role="status">{error}</div>}

   <section className="ia-voice-price">
    <div className="ia-voice-price-copy">
     <span>Créditos</span>
     <strong>{price==null?'Calcule antes de gerar':`${price.toLocaleString('pt-BR')} créditos`}</strong>
     {price!=null&&<small>{insufficient?'Saldo insuficiente para esta geração.':`Saldo disponível: ${balance.toLocaleString('pt-BR')} créditos`}</small>}
    </div>
    {!job?.quote?<button className="ia-voice-primary" disabled={Boolean(busy)||!text.trim()||!modelId} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>
     :['DRAFT','QUOTED'].includes(job.status)?<div className="ia-voice-actions"><button disabled={Boolean(busy)} onClick={()=>void quote()}><RefreshCw/>Atualizar</button><button className="ia-voice-primary" disabled={Boolean(busy)||insufficient} onClick={()=>void generate()}>{busy==='generate'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Gerar voz</button></div>
     :<button className="ia-voice-status" disabled>{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{status}</button>}
   </section>

   {job&&<section className="ia-voice-current">
    <div className="ia-voice-current-head"><div><span>Resultado atual</span><strong>{status}</strong></div><Volume2/></div>
    {['QUEUED','RUNNING'].includes(job.status)&&<p>A geração continua sendo processada e também pode ser acompanhada pelo sistema de tarefas.</p>}
    {job.status==='FAILED'&&<p>{job.error_message||'A voz não pôde ser gerada.'}</p>}
    {job.status==='SUCCEEDED'&&result?.public_url&&<audio controls preload="metadata" src={result.public_url}/>} 
    {job.status==='SUCCEEDED'&&!result?.public_url&&<p>Áudio concluído. Atualizando Minhas criações…</p>}
   </section>}
  </section>

  <section className="ia-voice-gallery" aria-label="Minhas criações de voz">
   <header className="ia-voice-gallery-head"><div><span>MINHAS CRIAÇÕES</span><h2>Vozes geradas</h2><p>Os resultados ficam salvos na mesma Biblioteca do IA Connect.</p></div><button onClick={()=>void loadCreations()} disabled={busy==='load'}><RefreshCw className={busy==='load'?'is-spin':''}/>Atualizar</button></header>
   {creations.length?<div className="ia-voice-grid">{creations.map(asset=><article key={asset.asset_id} className="ia-voice-card">
    <div className="ia-voice-card-icon"><AudioLines/></div>
    <div className="ia-voice-card-copy"><strong>{asset.name||'Voz gerada'}</strong><span><Clock3/> {new Date(asset.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
    {asset.public_url?<audio controls preload="metadata" src={asset.public_url}/>:<p>Áudio indisponível para reprodução.</p>}
   </article>)}</div>:<div className="ia-voice-empty"><Mic2/><strong>Suas vozes aparecerão aqui.</strong><span>Gere a primeira narração para começar.</span></div>}
  </section>
 </div>;
};

export default VoiceCreateView;
