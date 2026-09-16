import React,{useCallback,useEffect,useMemo,useState}from'react';
import{AudioLines,CheckCircle2,FileAudio,FileVideo,Languages,LoaderCircle,Mic2,Music2,RefreshCw,Sparkles,Upload,Volume2,WandSparkles}from'lucide-react';
import{betaAudioClient,BetaAudioVoice}from'../audioClient.js';
import{BetaCapabilityModel}from'../capabilityClient.js';
import{betaJobClient,BetaJobView}from'../jobClient.js';
import{universalAssetClient,UniversalAssetView}from'../universalAssetClient.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';

type Tool='text-to-speech'|'sound-effects'|'music'|'transcription'|'subtitles'|'authorized-voice-clone'|'dubbing';

const TOOLS:Array<{id:Tool;label:string;description:string;icon:React.ComponentType<any>}>= [
 {id:'text-to-speech',label:'Voz',description:'Texto em voz natural.',icon:Mic2},
 {id:'sound-effects',label:'Efeitos',description:'Crie sons e ambientes.',icon:Volume2},
 {id:'music',label:'Música',description:'Gere trilhas por prompt.',icon:Music2},
 {id:'transcription',label:'Transcrever',description:'Áudio em texto.',icon:FileAudio},
 {id:'subtitles',label:'Legendas',description:'Fala de vídeo com timestamps.',icon:FileVideo},
 {id:'authorized-voice-clone',label:'Clonar voz',description:'Somente voz autorizada.',icon:AudioLines},
 {id:'dubbing',label:'Dublar',description:'Localize áudio ou vídeo.',icon:Languages},
];

const BUILTIN_VOICES=[
 {id:'calm-female',label:'Feminina calma'},
 {id:'wise-female',label:'Feminina madura'},
 {id:'friendly',label:'Amigável'},
 {id:'casual-male',label:'Masculina casual'},
];

const promptRequired=(tool:Tool)=>['text-to-speech','sound-effects','music'].includes(tool);
const needsReference=(tool:Tool)=>['transcription','subtitles','authorized-voice-clone','dubbing'].includes(tool);
const acceptFor=(tool:Tool)=>tool==='subtitles'?'video/*':tool==='dubbing'?'audio/*,video/*':'audio/*';

function errorMessage(error:any){return error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';}

export const BetaAudioView:React.FC<{onOpenLibrary?:()=>void}>=({onOpenLibrary})=>{
 const[tool,setTool]=useState<Tool>('text-to-speech');
 const[catalog,setCatalog]=useState<BetaCapabilityModel[]>([]);
 const[voices,setVoices]=useState<BetaAudioVoice[]>([]);
 const[assets,setAssets]=useState<UniversalAssetView[]>([]);
 const[prompt,setPrompt]=useState('');
 const[referenceId,setReferenceId]=useState('');
 const[duration,setDuration]=useState(12);
 const[language,setLanguage]=useState('auto');
 const[targetLanguage,setTargetLanguage]=useState('pt');
 const[voice,setVoice]=useState('calm-female');
 const[outputFormat,setOutputFormat]=useState('mp3');
 const[instrumental,setInstrumental]=useState(false);
 const[timestamps,setTimestamps]=useState(true);
 const[voiceLabel,setVoiceLabel]=useState('Minha voz');
 const[voiceConsent,setVoiceConsent]=useState(false);
 const[job,setJob]=useState<BetaJobView|null>(null);
 const[resultAsset,setResultAsset]=useState<UniversalAssetView|null>(null);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[pollCount,setPollCount]=useState(0);

 const load=useCallback(async()=>{
  try{
   const[models,audio,video,savedVoices]=await Promise.all([
    betaAudioClient.catalog(),universalAssetClient.list({type:'AUDIO'}),universalAssetClient.list({type:'VIDEO'}),betaAudioClient.voices(),
   ]);
   setCatalog(models);setAssets([...audio,...video].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)));setVoices(savedVoices);
  }catch(err){setError(errorMessage(err));}
 },[]);
 useEffect(()=>{void load()},[load]);

 const availableAssets=useMemo(()=>assets.filter(asset=>{
  if(tool==='subtitles')return asset.type==='VIDEO';
  if(tool==='dubbing')return asset.type==='VIDEO'||asset.type==='AUDIO';
  return asset.type==='AUDIO';
 }),[assets,tool]);

 const model=useMemo(()=>catalog.find(item=>item.capabilities.some(cap=>cap.id===tool)),[catalog,tool]);

 useEffect(()=>{setJob(null);setResultAsset(null);setPollCount(0);setError('');setReferenceId('');},[tool]);
 useEffect(()=>{
  if(!job||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=120)return;
  const delay=Math.min(6000,1800+pollCount*120);
  const timer=window.setTimeout(async()=>{
   try{const next=await betaJobClient.get(job.job_id);setJob(next);setPollCount(count=>count+1);}
   catch(err){setError(errorMessage(err));setPollCount(120);}
  },delay);
  return()=>window.clearTimeout(timer);
 },[job,pollCount]);

 useEffect(()=>{
  const assetId=job?.status==='SUCCEEDED'?job.result_asset_ids?.[0]:null;
  if(!assetId){if(job?.status!=='SUCCEEDED')setResultAsset(null);return;}
  void universalAssetClient.get(assetId).then(setResultAsset).catch(()=>setResultAsset(null));
  if(job?.request?.capability_id==='authorized-voice-clone')void betaAudioClient.voices().then(setVoices).catch(()=>{});
 },[job?.status,job?.result_asset_ids?.[0]]);

 const buildRequest=()=>{
  if(!model)throw new Error('Nenhum modelo de áudio elegível está disponível para esta ferramenta.');
  if(promptRequired(tool)&&!prompt.trim())throw new Error('Escreva o conteúdo ou descrição antes de cotar.');
  if(needsReference(tool)&&!referenceId)throw new Error('Selecione um arquivo da Library.');
  if(tool==='authorized-voice-clone'&&!voiceConsent)throw new Error('Confirme que você possui autorização para usar esta voz.');
  const controls:any={output_format:outputFormat};
  if(['sound-effects','music'].includes(tool))controls.duration_seconds=duration;
  if(['text-to-speech','transcription','subtitles','authorized-voice-clone'].includes(tool))controls.language=language;
  if(tool==='text-to-speech')controls.voice=voice;
  if(tool==='music')controls.instrumental=instrumental;
  if(['transcription','subtitles'].includes(tool))controls.timestamps=timestamps;
  if(tool==='authorized-voice-clone'){controls.voice_clone_consent=true;controls.voice_label=voiceLabel;}
  if(tool==='dubbing'){controls.source_language=language;controls.target_language=targetLanguage;}
  return{
   capability_id:tool,model_id:model.model_id,prompt:prompt.trim(),
   references:referenceId?[{asset_id:referenceId,slot_type:'GENERAL'}]:[],
   controls,
  };
 };

 const quote=async()=>{
  setBusy('quote');setError('');setJob(null);setResultAsset(null);
  try{
   const created=await betaJobClient.create(buildRequest());
   const quoted=await betaJobClient.quote(created.job_id);
   setJob(quoted);setPollCount(0);
  }catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };
 const execute=async()=>{
  if(!job)return;
  setBusy('execute');setError('');
  try{const next=await betaJobClient.queue(job.job_id);setJob(next);setPollCount(0);}
  catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };
 const requote=async()=>{
  if(!job)return quote();
  setBusy('quote');setError('');
  try{setJob(await betaJobClient.quote(job.job_id));}
  catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };

 const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy('upload');setError('');
  try{
   const asset=await assetService.uploadAsset({file,name:file.name});
   const view=await universalAssetClient.get(asset.asset_id);
   setAssets(current=>[view,...current.filter(row=>row.asset_id!==view.asset_id)]);setReferenceId(view.asset_id);
  }catch(err){setError(errorMessage(err));}
  finally{setBusy('');}
 };

 const selectedAsset=assets.find(asset=>asset.asset_id===referenceId)||null;
 const statusLabel=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='CANCELLED'?'Cancelado':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Cotado':'Rascunho';

 return <main className="ia-beta-audio">
  <section className="ia-beta-audio-head">
   <div><span><AudioLines/> Audio V1</span><h1>Voz, som e linguagem no mesmo workspace.</h1><p>Gere, transcreva e duble sem escolher provider. O IA Conect cuida da rota, créditos e entrega na Library.</p></div>
   <button onClick={()=>void load()}><RefreshCw/><span>Atualizar</span></button>
  </section>

  <div className="ia-beta-audio-layout">
   <aside className="ia-beta-audio-tools">{TOOLS.map(item=>{const Icon=item.icon;return <button key={item.id} className={tool===item.id?'is-selected':''} onClick={()=>setTool(item.id)}><Icon/><div><strong>{item.label}</strong><span>{item.description}</span></div></button>})}</aside>

   <section className="ia-beta-audio-workspace">
    <div className="ia-beta-audio-workspace-title"><div><span>{TOOLS.find(item=>item.id===tool)?.label}</span><h2>{TOOLS.find(item=>item.id===tool)?.description}</h2></div><small>{model?model.name:'Indisponível'}</small></div>

    {promptRequired(tool)&&<label className="ia-beta-audio-field"><span>{tool==='text-to-speech'?'Texto':'Descrição'}</span><textarea rows={tool==='text-to-speech'?7:5} value={prompt} onChange={e=>{setPrompt(e.target.value);setJob(null)}} placeholder={tool==='text-to-speech'?'Digite o texto que será narrado…':tool==='music'?'Ex.: trilha eletrônica cinematográfica, crescente, sem vocal…':'Ex.: chuva forte em telhado metálico, ambiente externo…'}/></label>}

    {needsReference(tool)&&<div className="ia-beta-audio-field"><span>Arquivo de entrada</span><div className="ia-beta-audio-reference-row"><select value={referenceId} onChange={e=>{setReferenceId(e.target.value);setJob(null)}}><option value="">Selecione da Library</option>{availableAssets.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name} · {asset.type}</option>)}</select><label className="ia-beta-audio-upload"><Upload/>{busy==='upload'?'Enviando…':'Upload'}<input type="file" accept={acceptFor(tool)} onChange={upload} disabled={busy==='upload'}/></label></div>{selectedAsset&&<div className="ia-beta-audio-selected"><span>{selectedAsset.type}</span><strong>{selectedAsset.name}</strong></div>}</div>}

    <div className="ia-beta-audio-options">
     {tool==='text-to-speech'&&<label><span>Voz</span><select value={voice} onChange={e=>{setVoice(e.target.value);setJob(null)}}>{BUILTIN_VOICES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}{voices.map(item=><option key={item.voice_id} value={item.voice_id}>{item.label} · clonada</option>)}</select></label>}
     {['text-to-speech','transcription','subtitles','authorized-voice-clone','dubbing'].includes(tool)&&<label><span>{tool==='dubbing'?'Idioma original':'Idioma'}</span><select value={language} onChange={e=>{setLanguage(e.target.value);setJob(null)}}><option value="auto">Detectar automaticamente</option><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option><option value="de">Alemão</option></select></label>}
     {tool==='dubbing'&&<label><span>Idioma de destino</span><select value={targetLanguage} onChange={e=>{setTargetLanguage(e.target.value);setJob(null)}}><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option><option value="de">Alemão</option></select></label>}
     {['sound-effects','music'].includes(tool)&&<label><span>Duração · {duration}s</span><input type="range" min={tool==='music'?5:1} max={tool==='music'?240:180} value={duration} onChange={e=>{setDuration(Number(e.target.value));setJob(null)}}/></label>}
     {tool==='music'&&<label className="is-check"><input type="checkbox" checked={instrumental} onChange={e=>{setInstrumental(e.target.checked);setJob(null)}}/><span>Instrumental</span></label>}
     {['transcription','subtitles'].includes(tool)&&<label className="is-check"><input type="checkbox" checked={timestamps} onChange={e=>{setTimestamps(e.target.checked);setJob(null)}}/><span>Incluir timestamps</span></label>}
     {['text-to-speech','sound-effects','music'].includes(tool)&&<label><span>Formato</span><select value={outputFormat} onChange={e=>{setOutputFormat(e.target.value);setJob(null)}}><option value="mp3">MP3</option><option value="wav">WAV</option><option value="aac">AAC</option></select></label>}
    </div>

    {tool==='authorized-voice-clone'&&<div className="ia-beta-audio-consent"><label><span>Nome da voz</span><input value={voiceLabel} onChange={e=>{setVoiceLabel(e.target.value);setJob(null)}} maxLength={80}/></label><label className="is-consent"><input type="checkbox" checked={voiceConsent} onChange={e=>{setVoiceConsent(e.target.checked);setJob(null)}}/><span>Confirmo que sou titular desta voz ou possuo autorização explícita para cloná-la e utilizá-la.</span></label></div>}

    {error&&<div className="ia-beta-audio-error" role="status">{error}</div>}

    <div className="ia-beta-audio-runbar">
     <div>{job?.quote?<><span>Cotação</span><strong>{job.quote.credit_price.toLocaleString('pt-BR')} créditos</strong><small>válida até {new Date(job.quote.expires_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></>:<><span>Preço</span><strong>Calcule antes de executar</strong></>}</div>
     {!job?.quote?<button className="is-primary" disabled={Boolean(busy)||!model} onClick={()=>void quote()}>{busy==='quote'?<LoaderCircle className="is-spin"/>:<Sparkles/>}Calcular créditos</button>:
      ['DRAFT','QUOTED'].includes(job.status)?<div className="ia-beta-audio-run-actions"><button onClick={()=>void requote()} disabled={Boolean(busy)}><RefreshCw/>Atualizar</button><button className="is-primary" onClick={()=>void execute()} disabled={Boolean(busy)}>{busy==='execute'?<LoaderCircle className="is-spin"/>:<WandSparkles/>}Executar</button></div>:
      <button disabled className="is-status">{['QUEUED','RUNNING'].includes(job.status)&&<LoaderCircle className="is-spin"/>}{statusLabel}</button>}
    </div>

    {job&&<section className="ia-beta-audio-result">
      <div className="ia-beta-audio-result-head"><div><span>Resultado</span><strong>{statusLabel}</strong></div>{job.status==='SUCCEEDED'&&<CheckCircle2/>}</div>
      {['QUEUED','RUNNING'].includes(job.status)&&<p>A tarefa continua no Task Center. Você pode navegar pelo Beta sem interromper a execução.</p>}
      {job.status==='FAILED'&&<div><p>{job.error_message||'A execução não pôde ser concluída.'}</p><button onClick={()=>void requote()}>Nova cotação</button></div>}
      {job.status==='SUCCEEDED'&&resultAsset?.type==='AUDIO'&&resultAsset.public_url&&<audio controls preload="metadata" src={resultAsset.public_url}/>}
      {job.status==='SUCCEEDED'&&resultAsset?.type==='VIDEO'&&resultAsset.public_url&&<video controls preload="metadata" src={resultAsset.public_url}/>}
      {job.status==='SUCCEEDED'&&job.result_text&&<pre>{job.result_text}</pre>}
      {job.status==='SUCCEEDED'&&job.result_structured?.voice&&<div className="ia-beta-audio-voice-success"><Mic2/><div><strong>{job.result_structured.voice.label}</strong><span>Voz adicionada ao seletor de Voz do IA Conect.</span></div></div>}
      {job.status==='SUCCEEDED'&&<div className="ia-beta-audio-result-actions"><button onClick={onOpenLibrary}>Abrir na Library</button></div>}
    </section>}
   </section>
  </div>
 </main>;
};
