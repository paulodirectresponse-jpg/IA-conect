import React,{useCallback,useEffect,useMemo,useState}from'react';
import{FileAudio,Languages,Volume2}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{assetService}from'../../services/assetService.js';
import{ApiError}from'../../services/apiClient.js';
import{voiceGenerationClient,VoiceJob,VoiceModel}from'../../services/voiceGenerationClient.js';
import{Asset}from'../../types/index.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
import{StableGeneratorModelPicker}from'../workspace/StableGeneratorModelPicker.js';
import{GeneratorFooter,GeneratorOptionGrid,GeneratorPanel,GeneratorScroll,GeneratorSettingRow}from'../workspace/GeneratorControls.js';
import{PromptComposer}from'../workspace/PromptComposer.js';
import{MobileStudioLayout}from'../workspace/MobileStudioLayout.js';

const VOICES=[{id:'calm-female',label:'Feminina calma'},{id:'wise-female',label:'Feminina madura'},{id:'friendly',label:'Amigável'},{id:'casual-male',label:'Masculina casual'}];
const LANGUAGES=[{id:'auto',label:'Detectar automaticamente'},{id:'pt',label:'Português'},{id:'en',label:'Inglês'},{id:'es',label:'Espanhol'},{id:'fr',label:'Francês'},{id:'de',label:'Alemão'}];
const FORMATS=[{value:'mp3',label:'MP3'},{value:'wav',label:'WAV'}];
const terminal=(status?:string)=>['SUCCEEDED','FAILED','CANCELLED'].includes(String(status||''));
const message=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';
type OpenCard='voice'|'language'|'format'|null;

export const VoiceCreateView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[models,setModels]=useState<VoiceModel[]>([]),[selectedModelId,setSelectedModelId]=useState(''),[text,setText]=useState(''),[voice,setVoice]=useState('calm-female'),[language,setLanguage]=useState('auto'),[format,setFormat]=useState('mp3'),[openCard,setOpenCard]=useState<OpenCard>(null),[mobileActiveCount,setMobileActiveCount]=useState(0);
 const[job,setJob]=useState<VoiceJob|null>(null),[result,setResult]=useState<Asset|null>(null),[busy,setBusy]=useState('load'),[error,setError]=useState(''),[pollCount,setPollCount]=useState(0);
 const load=useCallback(async()=>{setBusy(current=>current||'load');setError('');try{const available=(await voiceGenerationClient.catalog()).filter(model=>model.capabilities.some(capability=>capability.id==='text-to-speech'));setModels(available);const fallback=available.find(model=>model.providers?.length)?.model_id||'';setSelectedModelId(current=>available.some(model=>model.model_id===current)?current:fallback);}catch(err){setError(message(err));}finally{setBusy(current=>current==='load'?'':current)}},[]);
 useEffect(()=>{void load()},[load]);
 const selectedModel=useMemo(()=>models.find(model=>model.model_id===selectedModelId)||null,[models,selectedModelId]);
 const routeReady=Boolean(selectedModel?.providers?.length);
 const invalidate=()=>{setJob(null);setResult(null);setPollCount(0);setError('')};
 useEffect(()=>{if(!job||terminal(job.status)||!['QUEUED','RUNNING'].includes(job.status)||pollCount>=160)return;const timer=window.setTimeout(async()=>{try{setJob(await voiceGenerationClient.get(job.job_id));setPollCount(value=>value+1)}catch(err){setError(message(err));setPollCount(160)}},Math.min(6500,1800+pollCount*120));return()=>window.clearTimeout(timer)},[job,pollCount]);
 useEffect(()=>{if(job?.status!=='SUCCEEDED')return;let disposed=false;const sync=async()=>{void refreshWallet();const resultId=job.result_asset_ids?.[0];if(resultId){const rows=await assetService.listAssets({type:'AUDIO',origin:'GENERATED'}).catch(()=>[]);if(!disposed)setResult(rows.find(asset=>asset.asset_id===resultId)||null)}window.dispatchEvent(new CustomEvent('creations:updated',{detail:{kind:'VOICE',asset_ids:job.result_asset_ids||[]}}))};void sync();const timer=window.setTimeout(()=>void sync(),900);return()=>{disposed=true;window.clearTimeout(timer)}},[job?.status,job?.result_asset_ids,refreshWallet]);
 const quote=async()=>{if(!text.trim())return setError('Digite o texto que será narrado.');if(!routeReady)return setError('Nenhum modelo com rota e preço verificados está disponível agora.');setBusy('quote');setError('');setJob(null);setResult(null);try{const created=await voiceGenerationClient.create({model_id:selectedModelId,prompt:text.trim(),controls:{language,voice,output_format:format}});setJob(await voiceGenerationClient.quote(created.job_id));setPollCount(0)}catch(err){setError(message(err))}finally{setBusy('')}};
 const generate=async()=>{if(!job)return;setBusy('generate');setError('');try{setJob(await voiceGenerationClient.queue(job.job_id));setPollCount(0)}catch(err){setError(message(err))}finally{setBusy('')}};
 const balance=wallet?.available_credits??0,price=job?.quote?.credit_price??null,insufficient=price!=null&&balance<price;
 const status=job?.status==='SUCCEEDED'?'Concluído':job?.status==='FAILED'?'Falhou':job?.status==='RUNNING'?'Processando':job?.status==='QUEUED'?'Na fila':job?.status==='QUOTED'?'Preço calculado':'Preparando';
 const currentVoice=VOICES.find(item=>item.id===voice)?.label||voice,currentLanguage=LANGUAGES.find(item=>item.id===language)?.label||language;
 const footer=!job?.quote?{label:'Calcular créditos',disabled:Boolean(busy)||!text.trim()||!routeReady,onClick:quote,secondary:undefined as string|undefined,onSecondary:undefined as(()=>void)|undefined}:{label:['DRAFT','QUOTED'].includes(job.status)?'Gerar voz':status,disabled:Boolean(busy)||insufficient||!['DRAFT','QUOTED'].includes(job.status),onClick:generate,secondary:['DRAFT','QUOTED'].includes(job.status)?'Atualizar':undefined,onSecondary:['DRAFT','QUOTED'].includes(job.status)?quote:undefined};
 const creator=<GeneratorPanel ariaLabel="Gerador de voz"><GeneratorScroll>
  <StableGeneratorModelPicker models={models.map(model=>({model_id:model.model_id,name:model.name,description:'Modelo de voz'}))} selectedModelId={selectedModelId} loading={busy==='load'} onSelect={modelId=>{setSelectedModelId(modelId);invalidate()}}/>
  {!busy&&models.length===0&&<section className="ia-stable-current"><strong>Nenhum modelo disponível.</strong><p>As IAs serão exibidas quando uma Route estiver pronta.</p></section>}
  <PromptComposer prompt={text} onChangePrompt={value=>{setText(value);invalidate()}} negativePrompt="" onChangeNegativePrompt={()=>{}} onOpenImproveModal={()=>{}} references={[]} onRequestAddMedia={()=>{}} supportsNegativePrompt={false} supportsReferences={false} maxChars={12000} label="Texto" placeholder="Digite o texto que deseja transformar em voz…" showImproveButton={false}/>
  <div className="space-y-1.5">
   <GeneratorSettingRow icon={Volume2} label="Voz" value={currentVoice} open={openCard==='voice'} onToggle={()=>setOpenCard(openCard==='voice'?null:'voice')}><GeneratorOptionGrid values={VOICES.map(item=>({value:item.id,label:item.label}))} current={voice} onSelect={value=>{setVoice(value);invalidate()}}/></GeneratorSettingRow>
   <GeneratorSettingRow icon={Languages} label="Idioma" value={currentLanguage} open={openCard==='language'} onToggle={()=>setOpenCard(openCard==='language'?null:'language')}><GeneratorOptionGrid values={LANGUAGES.map(item=>({value:item.id,label:item.label}))} current={language} onSelect={value=>{setLanguage(value);invalidate()}}/></GeneratorSettingRow>
   <GeneratorSettingRow icon={FileAudio} label="Formato" value={format.toUpperCase()} open={openCard==='format'} onToggle={()=>setOpenCard(openCard==='format'?null:'format')} semantic="resolution"><GeneratorOptionGrid values={FORMATS} current={format} onSelect={value=>{setFormat(value);invalidate()}}/></GeneratorSettingRow>
  </div>
  {job&&<section className="ia-stable-current"><div className="flex items-center justify-between"><div><span className="text-[8px] text-zinc-600">Resultado atual</span><strong className="block text-[10px] text-white">{status}</strong></div><Volume2 className="w-4 h-4 text-cyan-300"/></div>{job.quote&&<p>Modelo executado: <strong>{job.quote.selected_model_id}</strong> · {job.quote.routing_mode==='AUTO'?'roteamento AUTO':'modelo específico'}.</p>}{job.status==='SUCCEEDED'&&result?.public_url&&<audio controls preload="metadata" src={result.public_url} className="mt-2 w-full h-9"/>}{job.status==='FAILED'&&<p>{job.error_message||'A voz não pôde ser gerada.'}</p>}</section>}
 </GeneratorScroll><GeneratorFooter error={error} price={price} balance={balance} hasBalance={!insufficient} primaryLabel={footer.label} onPrimary={()=>void footer.onClick()} primaryDisabled={footer.disabled} primaryBusy={busy==='quote'||busy==='generate'} secondaryLabel={footer.secondary} onSecondary={footer.onSecondary?()=>void footer.onSecondary?.():undefined} secondaryDisabled={Boolean(busy)}/></GeneratorPanel>;
 return <MobileStudioLayout activeCount={mobileActiveCount} creator={creator} gallery={<CreationGallery defaultFilter="VOICE" title="Minhas criações" subtitle="Todo o histórico de criações do seu studio." onActiveCountChange={setMobileActiveCount}/>}/>;
};
export default VoiceCreateView;
