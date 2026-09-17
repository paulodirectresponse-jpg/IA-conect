import React,{useCallback,useEffect,useState}from'react';
import{LoaderCircle,Mic2,RefreshCw,Sparkles,Volume2,WandSparkles}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{voiceGenerationClient,VoiceJob}from'../../services/voiceGenerationClient.js';
import{Asset}from'../../types/index.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
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
 const[selectedModelId,setSelectedModelId]=useState('');
 const[text,setText]=useState('');
 const[voice,setVoice]=useState('calm-female');
 const[language,setLanguage]=useState('auto');
 const[format,setFormat]=useState('mp3');
 const[job,setJob]=useState<VoiceJob|null>(null);
 const[result,setResult]=useState<Asset|null>(null);
 const[busy,setBusy]=useState('load');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const load=useCallback(async()=>{
  setBusy(current=>current||'load');setError('');
  try{
   const catalog=await voiceGenerationClient.catalog();
   const available=catalog.filter(model=>model.capabilities.some(capability=>capability.id==='text-to-speech')).map(model=>({model_id:model.model_id,name:model.name}));
   setModels(available);
   setSelectedModelId(current=>available.some(model=>model.model_id===current)?current:(available.find(model=>model.model_id==='AUTO')?.model_id||available[0]?.model_id||''));
  }catch(err){setError(message(err));}
  finally{setBusy(current=>current==='load'?'':current);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const modelId=selectedModelId;
 const invalidate=()=>{setJob(null);setResult(null);setPollCount(0);setError('');};

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
  let disposed=false;
  const sync=async()=>{
   void refreshWallet();
   const resultId=job.result_asset_ids?.[0];
   if(resultId){const rows=await assetService.listAssets({type:'AUDIO',origin:'GENERATED'}).catch(()=>[]);if(!disposed)setResult(rows.find(asset=>asset.asset_id===resultId)||null)}
   window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'VOICE',asset_ids:job.result_asset_ids||[]}}));
  };
  void sync();
  const timer=window.setTimeout(()=>void sync(),900);
  return()=>{disposed=true;window.clearTimeout(timer)};
 },[job?.status,job?.result_asset_ids,refreshWallet]);

 const quote=async()=>{
  if(!text.trim())return setError('Digite o texto que será narrado.');
  if(!modelId)return setError('Nenhum modelo de voz está disponível agora.');
  setBusy('quote');setError('');setJob(null);setResult(null);
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

 const balance=wallet?.available_credits??0;
 const price=job?.quote?.credit_price??null;
 const insufficient=price!=null&&balance<price;
 const status=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';
 const selectedName=models.find(model=>model.model_id===modelId)?.name||modelId;

 return <div className="ia-voice-studio">
  <section className="ia-voice-creator" aria-label="Gerador de voz">
   <header className="ia-voice-heading">
    <div className="ia-voice-heading-icon"><Mic2/></div>
    <div><span>GERADOR DE VOZ</span><h1>Transforme texto em voz.</h1><p>Escolha a IA, configure a voz e gere o áudio usando os mesmos créditos e o Minhas criações universal do IA Connect.</p></div>
   </header>

   <div className="ia-voice-modelbar">
    <label htmlFor="voice-model"><span>IA / modelo</span><select id="voice-model" value={modelId} disabled={busy==='load'||!models.length} onChange={event=>{setSelectedModelId(event.target.value);invalidate();}}>{models.map(model=><option key={model.model_id} value={model.model_id}>{model.model_id==='AUTO'?'AUTO · Melhor rota disponível':model.name}</option>)}</select></label>
    <div className={`ia-voice-routing ${modelId==='AUTO'?'is-auto':'is-manual'}`}><span>{modelId==='AUTO'?'AUTO':'MODELO FIXO'}</span><strong>{selectedName||'Carregando...'}</strong><small>{modelId==='AUTO'?'O sistema escolhe a rota economicamente segura entre os modelos elegíveis.':'A geração fica vinculada ao modelo escolhido; o Smart Router usa providers ativos com mapping e preço seguros.'}</small></div>
   </div>

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
    {job.quote&&<p>Modelo selecionado: <strong>{models.find(model=>model.model_id===job.quote?.selected_model_id)?.name||job.quote.selected_model_id}</strong> · {job.quote.routing_mode==='AUTO'?'roteamento AUTO':'modelo manual'}.</p>}
    {['QUEUED','RUNNING'].includes(job.status)&&<p>A geração continua sendo processada e também pode ser acompanhada pelo sistema de tarefas.</p>}
    {job.status==='FAILED'&&<p>{job.error_message||'A voz não pôde ser gerada.'}</p>}
    {job.status==='SUCCEEDED'&&result?.public_url&&<audio controls preload="metadata" src={result.public_url}/>} 
    {job.status==='SUCCEEDED'&&!result?.public_url&&<p>Áudio concluído. Atualizando Minhas criações…</p>}
   </section>}
  </section>

  <CreationGallery defaultFilter="VOICE" title="Minhas criações" subtitle="Imagens, vídeos, vozes e todo o histórico de criação do IA Connect."/>
 </div>;
};

export default VoiceCreateView;
