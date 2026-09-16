import crypto from 'crypto';
import { GenerationMode, ModelRegistryItem } from '../../../src/types/index.js';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { generationRepository } from '../../repositories/generationRepository.js';
import { assetRepository } from '../../repositories/assetRepository.js';
import { assetReferenceResolver } from '../../services/assetReferenceResolver.js';
import { creditPricingService } from '../../services/creditPricingService.js';
import { generationService } from '../../services/generationService.js';
import { betaEconomicsService } from '../catalog/betaEconomicsService.js';
import { validateModelCapability } from '../capabilityRegistry.js';
import { betaJobRepository } from './jobRepository.js';
import { inlineBetaJobQueue } from './jobQueue.js';
import { assertJobTransition, generationStatusToJobStatus, isTerminalJobStatus } from './jobStateMachine.js';
import { BetaJob, BetaJobAttempt, BetaJobRequest, BetaJobStatus } from './jobTypes.js';

const now=()=>new Date().toISOString();
const makeId=(prefix:string)=>`${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

function generationModeForCapability(capabilityId:string):GenerationMode|null{
  if(capabilityId==='text-to-image')return'TEXT_TO_IMAGE';
  if(capabilityId==='image-to-image'||capabilityId==='image-edit')return'IMAGE_TO_IMAGE';
  if(capabilityId==='text-to-video')return'TEXT_TO_VIDEO';
  if(capabilityId==='image-to-video'||capabilityId==='first-frame'||capabilityId==='last-frame')return'IMAGE_TO_VIDEO';
  if(capabilityId==='text-to-speech')return'TEXT_TO_SPEECH';
  if(capabilityId==='sound-effects'||capabilityId==='music')return'TEXT_TO_AUDIO';
  if(capabilityId==='transcription')return'AUDIO_TO_TEXT';
  if(capabilityId==='subtitles')return'MEDIA_TO_TEXT';
  if(capabilityId==='authorized-voice-clone')return'AUDIO_TO_AUDIO';
  if(capabilityId==='dubbing')return'MEDIA_DUBBING';
  return null;
}

function derivedAssetIdForRequest(request:BetaJobRequest){
  if(!['image-to-image','image-edit','image-to-video','first-frame','last-frame'].includes(request.capability_id))return null;
  return request.references.find(ref=>ref.slot_type==='INITIAL')?.asset_id||request.references[0]?.asset_id||null;
}

function requestedControls(request:BetaJobRequest){
  const controls:string[]=[];
  if(request.controls.aspect_ratio)controls.push('aspect_ratio');
  if(request.controls.resolution)controls.push('resolution');
  if(request.controls.duration_seconds!==undefined)controls.push('duration');
  if(request.controls.seed!==undefined&&request.controls.seed!==null)controls.push('seed');
  if(request.negative_prompt?.trim())controls.push('negative_prompt');
  if(['image-to-image','image-edit','image-to-video'].includes(request.capability_id)&&request.references.length)controls.push('reference_image');
  if(['first-frame','last-frame'].includes(request.capability_id))controls.push('first_frame');
  if(request.capability_id==='last-frame')controls.push('last_frame');
  if(request.controls.language)controls.push('language');
  if(request.controls.voice)controls.push('voice');
  if(request.controls.output_format)controls.push('output_format');
  if(request.controls.style)controls.push('style');
  if(request.controls.instrumental!==undefined)controls.push('instrumental');
  if(request.controls.timestamps!==undefined)controls.push('timestamps');
  if(request.controls.source_language)controls.push('source_language');
  if(request.controls.target_language)controls.push('target_language');
  if(request.controls.voice_clone_consent!==undefined)controls.push('voice_clone_consent');
  if(request.controls.voice_label)controls.push('voice_label');
  return controls;
}

function normalizeRequest(raw:any):BetaJobRequest{
  return{
    capability_id:String(raw?.capability_id||'') as BetaJobRequest['capability_id'],
    model_id:String(raw?.model_id||'').trim(),
    prompt:String(raw?.prompt||'').trim(),
    negative_prompt:String(raw?.negative_prompt||'').trim()||undefined,
    references:Array.isArray(raw?.references)?raw.references.slice(0,32).map((ref:any)=>({
      asset_id:String(ref?.asset_id||'').trim(),
      slot_type:['INITIAL','END','GENERAL'].includes(String(ref?.slot_type||'GENERAL').toUpperCase())
        ?String(ref?.slot_type||'GENERAL').toUpperCase() as 'INITIAL'|'END'|'GENERAL'
        :'GENERAL',
      alias:ref?.alias?String(ref.alias):undefined,
    })).filter((ref:any)=>ref.asset_id):[],
    controls:{
      duration_seconds:Number.isFinite(Number(raw?.controls?.duration_seconds))?Number(raw.controls.duration_seconds):undefined,
      resolution:raw?.controls?.resolution?String(raw.controls.resolution):undefined,
      aspect_ratio:raw?.controls?.aspect_ratio?String(raw.controls.aspect_ratio):undefined,
      number_of_outputs:Number.isFinite(Number(raw?.controls?.number_of_outputs))?Number(raw.controls.number_of_outputs):undefined,
      seed:raw?.controls?.seed===null?null:Number.isFinite(Number(raw?.controls?.seed))?Number(raw.controls.seed):undefined,
      motion_strength:Number.isFinite(Number(raw?.controls?.motion_strength))?Number(raw.controls.motion_strength):undefined,
      audio_enabled:raw?.controls?.audio_enabled===undefined?undefined:Boolean(raw.controls.audio_enabled),
      model_variant:raw?.controls?.model_variant?String(raw.controls.model_variant):undefined,
      pricing_options:raw?.controls?.pricing_options&&typeof raw.controls.pricing_options==='object'?raw.controls.pricing_options:undefined,
      language:raw?.controls?.language?String(raw.controls.language):undefined,
      voice:raw?.controls?.voice?String(raw.controls.voice):undefined,
      output_format:raw?.controls?.output_format?String(raw.controls.output_format):undefined,
      style:raw?.controls?.style?String(raw.controls.style):undefined,
      instrumental:raw?.controls?.instrumental===undefined?undefined:Boolean(raw.controls.instrumental),
      timestamps:raw?.controls?.timestamps===undefined?undefined:Boolean(raw.controls.timestamps),
      source_language:raw?.controls?.source_language?String(raw.controls.source_language):undefined,
      target_language:raw?.controls?.target_language?String(raw.controls.target_language):undefined,
      voice_clone_consent:raw?.controls?.voice_clone_consent===undefined?undefined:Boolean(raw.controls.voice_clone_consent),
      voice_label:raw?.controls?.voice_label?String(raw.controls.voice_label).trim().slice(0,80):undefined,
    },
  };
}

async function assertCapabilityEnabled(capabilityId:string){
  const audioCapabilities=new Set(['text-to-speech','sound-effects','music','transcription','subtitles','authorized-voice-clone','dubbing']);
  if(!audioCapabilities.has(capabilityId))return;
  const audio=await catalogRepository.getFeatureFlag('beta.audio');
  if(!audio?.is_enabled)throw Object.assign(new Error('O módulo de áudio está temporariamente indisponível.'),{code:'AUDIO_MODULE_DISABLED'});
  const keyed:Record<string,string>={
    'sound-effects':'beta.audio.sfx','music':'beta.audio.music','transcription':'beta.audio.transcription',
    'subtitles':'beta.audio.transcription','authorized-voice-clone':'beta.audio.voice_clone','dubbing':'beta.audio.dubbing',
  };
  const key=keyed[capabilityId];
  if(key){
    const flag=await catalogRepository.getFeatureFlag(key);
    if(!flag?.is_enabled)throw Object.assign(new Error('Este recurso de áudio está temporariamente indisponível.'),{code:'AUDIO_CAPABILITY_DISABLED'});
  }
}

async function ownedReferences(userId:string,request:BetaJobRequest){
  const assets=[] as any[];
  for(const ref of request.references){
    const asset=await assetRepository.getAsset(ref.asset_id,userId);
    if(!asset)throw Object.assign(new Error('Uma referência não foi encontrada ou não pertence a este usuário.'),{code:'REFERENCE_NOT_FOUND'});
    if(asset.status!=='READY')throw Object.assign(new Error('Uma referência ainda não está pronta.'),{code:'REFERENCE_NOT_READY'});
    assets.push(asset);
  }
  return assets;
}

async function validateRequest(request:BetaJobRequest,resolvedModelId?:string,userId?:string):Promise<{model:ModelRegistryItem|null;mode:GenerationMode}>{
  if(!request.model_id)throw Object.assign(new Error('Modelo é obrigatório.'),{code:'VALIDATION_ERROR'});
  await assertCapabilityEnabled(request.capability_id);
  const mode=generationModeForCapability(request.capability_id);
  if(!mode)throw Object.assign(new Error('Esta capability ainda não possui executor disponível.'),{code:'CAPABILITY_EXECUTOR_UNAVAILABLE'});
  const modelId=resolvedModelId||request.model_id;
  const model=modelId==='AUTO'?null:await catalogRepository.getModel(modelId);
  if(modelId!=='AUTO'){
    const capability=validateModelCapability(model,request.capability_id,requestedControls(request));
    if(!capability.valid)throw Object.assign(new Error(capability.message||'Capability inválida.'),{code:capability.code||'CAPABILITY_INVALID'});
  }
  const promptRequired=new Set(['text-to-image','image-to-image','image-edit','text-to-video','image-to-video','first-frame','last-frame','text-to-speech','sound-effects','music']);
  if(promptRequired.has(request.capability_id)&&!request.prompt)throw Object.assign(new Error('Prompt é obrigatório para esta capability.'),{code:'VALIDATION_ERROR'});
  if((request.capability_id==='image-to-image'||request.capability_id==='image-to-video')&&!request.references.length)throw Object.assign(new Error('Esta capability exige uma imagem de entrada.'),{code:'REFERENCE_REQUIRED'});
  if(request.capability_id==='first-frame'&&!request.references.some(ref=>ref.slot_type==='INITIAL'))throw Object.assign(new Error('Adicione o frame inicial.'),{code:'REFERENCE_REQUIRED'});
  if(request.capability_id==='last-frame'&&(!request.references.some(ref=>ref.slot_type==='INITIAL')||!request.references.some(ref=>ref.slot_type==='END')))throw Object.assign(new Error('Adicione os frames inicial e final.'),{code:'REFERENCE_REQUIRED'});

  if(userId){
    const assets=await ownedReferences(userId,request);
    const first=assets[0];
    if(request.capability_id==='transcription'&&(!first||first.type!=='AUDIO'))throw Object.assign(new Error('Selecione um áudio para transcrever.'),{code:'REFERENCE_REQUIRED'});
    if(request.capability_id==='subtitles'&&(!first||first.type!=='VIDEO'))throw Object.assign(new Error('Selecione um vídeo para gerar legendas.'),{code:'REFERENCE_REQUIRED'});
    if(request.capability_id==='authorized-voice-clone'){
      if(!first||first.type!=='AUDIO')throw Object.assign(new Error('Selecione um áudio autorizado para clonar a voz.'),{code:'REFERENCE_REQUIRED'});
      if(request.controls.voice_clone_consent!==true)throw Object.assign(new Error('Confirme que você possui autorização para usar esta voz.'),{code:'VOICE_CLONE_CONSENT_REQUIRED'});
    }
    if(request.capability_id==='dubbing'){
      if(!first||!['AUDIO','VIDEO'].includes(first.type))throw Object.assign(new Error('Selecione um áudio ou vídeo para dublar.'),{code:'REFERENCE_REQUIRED'});
      if(!request.controls.target_language)throw Object.assign(new Error('Escolha o idioma de destino da dublagem.'),{code:'VALIDATION_ERROR'});
    }
    if(['transcription','subtitles','authorized-voice-clone','dubbing'].includes(request.capability_id)&&assets.length!==1){
      throw Object.assign(new Error('Esta ferramenta aceita um arquivo de entrada por execução.'),{code:'VALIDATION_ERROR'});
    }
  }
  return{model,mode};
}

async function pricingContext(userId:string,request:BetaJobRequest){
  const assets=await ownedReferences(userId,request);
  if(!assets.length)return{assets,providerReferences:[] as any[],durationSeconds:0};
  const resolved=await assetReferenceResolver.resolveReferenceAssetUrls(userId,request.references.map(ref=>ref.asset_id));
  const providerReferences=resolved.map(asset=>{
    const source=request.references.find(ref=>ref.asset_id===asset.asset_id);
    return{...asset,slot_type:source?.slot_type||'GENERAL',prompt_alias:source?.alias||asset.alias};
  });
  const durationSeconds=assets.reduce((max,asset)=>Math.max(max,Number(asset.duration_seconds||0)),0);
  return{assets,providerReferences,durationSeconds};
}

async function pricingInput(userId:string,request:BetaJobRequest,mode:GenerationMode,modelId=request.model_id,context?:Awaited<ReturnType<typeof pricingContext>>){
  const image=mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';
  const mediaInput=['AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING'].includes(mode);
  const ctx=context||await pricingContext(userId,request);
  const defaults:Record<string,number>={'TEXT_TO_SPEECH':1,'TEXT_TO_AUDIO':request.capability_id==='music'?30:5};
  const duration=image?1:mediaInput
    ?Math.max(1,Math.round(ctx.durationSeconds||request.controls.duration_seconds||1))
    :Math.max(1,Math.round(request.controls.duration_seconds||defaults[mode]||5));
  const audioMode=['TEXT_TO_SPEECH','TEXT_TO_AUDIO','AUDIO_TO_TEXT','MEDIA_TO_TEXT','AUDIO_TO_AUDIO','MEDIA_DUBBING'].includes(mode);
  const pricingOptions={
    ...(request.controls.pricing_options||{}),
    language:request.controls.language,
    voice:request.controls.voice,
    output_format:request.controls.output_format,
    style:request.controls.style,
    instrumental:request.controls.instrumental,
    timestamps:request.controls.timestamps,
    source_language:request.controls.source_language,
    target_language:request.controls.target_language,
    text_chars:request.capability_id==='text-to-speech'?request.prompt.length:undefined,
  };
  return{
    userId,model_id:modelId,mode,capability_id:request.capability_id,prompt:request.prompt||'Processar mídia',negative_prompt:request.negative_prompt,
    duration_seconds:duration,
    resolution:request.controls.resolution||(image?'1K':audioMode?'audio':'720p'),
    aspect_ratio:request.controls.aspect_ratio||(image?'1:1':audioMode?'audio':'16:9'),
    number_of_outputs:image?Math.max(1,Math.min(4,Math.round(request.controls.number_of_outputs||1))):1,
    seed:request.controls.seed,motion_strength:request.controls.motion_strength,
    references:request.references,provider_references:ctx.providerReferences,audio_enabled:request.controls.audio_enabled,
    model_variant:request.controls.model_variant,pricing_options:pricingOptions,
  };
}

function outputAssetType(request:BetaJobRequest,assets:any[]):any{
  if(['text-to-speech','sound-effects','music'].includes(request.capability_id))return'AUDIO';
  if(request.capability_id==='dubbing')return assets[0]?.type==='VIDEO'?'VIDEO':'AUDIO';
  return null;
}

async function saveTransition(job:BetaJob,userId:string,to:BetaJobStatus,patch:Partial<BetaJob>={}){
  const versioned=await betaJobRepository.getJobWithVersion(job.job_id,userId);
  if(!versioned)throw Object.assign(new Error('Job não encontrado.'),{code:'JOB_NOT_FOUND'});
  assertJobTransition(versioned.job.status,to);
  const next={...versioned.job,...patch,status:to,updated_at:now()} as BetaJob;
  return betaJobRepository.saveConditional(next,versioned.updateTime);
}

async function mutation<T>(params:{userId:string;jobId:string;action:'QUOTE'|'QUEUE'|'RETRY'|'CANCEL';idempotencyKey:string},work:()=>Promise<T>):Promise<T>{
  const claim=await betaJobRepository.claimMutation(params);
  if(!claim.claimed){
    if(claim.mutation.status==='FAILED'){
      throw Object.assign(new Error('Esta operação idempotente já falhou. Use uma nova Idempotency-Key para uma nova tentativa.'),{code:claim.mutation.error_code||'JOB_MUTATION_FAILED'});
    }
    const current=await betaJobRepository.getJob(params.jobId,params.userId);
    if(!current)throw Object.assign(new Error('Job não encontrado.'),{code:'JOB_NOT_FOUND'});
    return current as T;
  }
  try{
    const result=await work();
    await betaJobRepository.finishMutation(claim.mutation,'COMPLETED');
    return result;
  }catch(error:any){
    await betaJobRepository.finishMutation(claim.mutation,'FAILED',error?.code||'JOB_MUTATION_FAILED').catch(()=>{});
    throw error;
  }
}

async function createQueuedAttempt(job:BetaJob,userId:string){
  const versioned=await betaJobRepository.getJobWithVersion(job.job_id,userId);
  if(!versioned)throw Object.assign(new Error('Job não encontrado.'),{code:'JOB_NOT_FOUND'});
  if(versioned.job.status!=='QUOTED'&&versioned.job.status!=='FAILED'&&versioned.job.status!=='CANCELLED'){
    throw Object.assign(new Error('O job precisa estar cotado ou em estado recuperável antes de executar.'),{code:'JOB_INVALID_STATE'});
  }
  if(!versioned.job.quote)throw Object.assign(new Error('Cotação do job não encontrada.'),{code:'JOB_QUOTE_REQUIRED'});
  betaEconomicsService.assertQuoteFresh(versioned.job.quote);
  await betaEconomicsService.assertQuotedModelEligible(versioned.job.quote,versioned.job.request.capability_id);
  const attemptNumber=versioned.job.attempt_count+1;
  const attemptId=`batt_${versioned.job.job_id}_${attemptNumber}`;
  const timestamp=now();
  const attempt:BetaJobAttempt={
    attempt_id:attemptId,job_id:versioned.job.job_id,user_id:userId,attempt_number:attemptNumber,status:'QUEUED',
    execution_key:`beta-job:${versioned.job.job_id}:attempt:${attemptNumber}`,
    generation_id:null,error_code:null,error_message:null,created_at:timestamp,updated_at:timestamp,
  };
  const queued={...versioned.job,status:'QUEUED' as const,current_attempt_id:attemptId,attempt_count:attemptNumber,linked_generation_id:null,queued_at:timestamp,started_at:null,completed_at:null,failed_at:null,cancelled_at:null,updated_at:timestamp,error_code:null,error_message:null};
  assertJobTransition(versioned.job.status,'QUEUED');
  await betaJobRepository.saveJobAndAttemptConditional(queued,versioned.updateTime,attempt);
  return{job:queued,attempt};
}

async function markAttempt(jobId:string,userId:string,attempt:BetaJobAttempt,status:BetaJobAttempt['status'],patch:Partial<BetaJobAttempt>={}){
  const next={...attempt,...patch,status,updated_at:now()} as BetaJobAttempt;
  await betaJobRepository.saveAttempt(next);
  return next;
}

async function executeAttempt(job:BetaJob,attempt:BetaJobAttempt,userId:string,reqHost?:string,idToken?:string){
  const versioned=await betaJobRepository.getJobWithVersion(job.job_id,userId);
  if(!versioned)throw Object.assign(new Error('Job não encontrado.'),{code:'JOB_NOT_FOUND'});
  if(versioned.job.status!=='QUEUED')return versioned.job;
  const runningAt=now();
  const running={...versioned.job,status:'RUNNING' as const,started_at:versioned.job.started_at||runningAt,updated_at:runningAt};
  assertJobTransition(versioned.job.status,'RUNNING');
  await betaJobRepository.saveConditional(running,versioned.updateTime);
  let currentAttempt=await markAttempt(job.job_id,userId,attempt,'RUNNING',{started_at:runningAt});

  try{
    const quote=running.quote!;
    betaEconomicsService.assertQuoteFresh(quote);
    await betaEconomicsService.assertExecutionEnabled();
    await betaEconomicsService.assertQuotedModelEligible(quote,running.request.capability_id);
    const {mode}=await validateRequest(running.request,quote.selected_model_id,userId);
    const context=await pricingContext(userId,running.request);
    const input=await pricingInput(userId,running.request,mode,quote.selected_model_id,context);
    await betaEconomicsService.recordLedgerEvent({event_id:`exec:${running.job_id}:${currentAttempt.attempt_id}`,event_type:'EXECUTION_STARTED',user_id:userId,job_id:running.job_id,generation_id:null,requested_model_id:quote.requested_model_id,selected_model_id:quote.selected_model_id,routing_mode:quote.routing_mode,pricing_policy_id:quote.pricing_policy_id,retail_pricing_id:quote.retail_pricing_id,pricing_signature_hash:quote.pricing_signature_hash,credit_price:quote.credit_price,quote_expires_at:quote.expires_at});
    const generation=await generationService.createAndStartGeneration({
      userId,model_id:quote.selected_model_id,mode,capability_id:running.request.capability_id,output_asset_type:outputAssetType(running.request,context.assets),prompt:input.prompt,negative_prompt:input.negative_prompt,
      duration_seconds:input.duration_seconds,resolution:input.resolution,aspect_ratio:input.aspect_ratio,
      number_of_outputs:input.number_of_outputs,seed:input.seed,motion_strength:input.motion_strength,
      references:running.request.references,client_request_id:currentAttempt.execution_key,
      source_job_id:running.job_id,derived_from_asset_id:derivedAssetIdForRequest(running.request),
      requested_model_id:quote.requested_model_id,routing_mode:quote.routing_mode,pricing_policy_id:quote.pricing_policy_id,
      authorized_credit_price:quote.credit_price,retail_pricing_id:quote.retail_pricing_id,
      pricing_signature_hash:quote.pricing_signature_hash,audio_enabled:input.audio_enabled,
      model_variant:input.model_variant,pricing_options:input.pricing_options,
      audio_metadata:running.request.capability_id==='authorized-voice-clone'?{voice_clone_consent_at:runningAt,voice_label:running.request.controls.voice_label||'Minha voz'}:undefined,reqHost,idToken,
    });
    await betaEconomicsService.recordLedgerEvent({event_id:`linked:${running.job_id}:${currentAttempt.attempt_id}`,event_type:'EXECUTION_LINKED',user_id:userId,job_id:running.job_id,generation_id:generation.generation_id,requested_model_id:quote.requested_model_id,selected_model_id:quote.selected_model_id,routing_mode:quote.routing_mode,pricing_policy_id:quote.pricing_policy_id,retail_pricing_id:quote.retail_pricing_id,pricing_signature_hash:quote.pricing_signature_hash,credit_price:quote.credit_price,quote_expires_at:quote.expires_at});
    const mapped=generationStatusToJobStatus(generation.status);
    const latest=await betaJobRepository.getJobWithVersion(running.job_id,userId);
    if(!latest)return running;
    const timestamp=now();
    const next={...latest.job,status:mapped,linked_generation_id:generation.generation_id,updated_at:timestamp,
      completed_at:mapped==='SUCCEEDED'?timestamp:latest.job.completed_at,
      failed_at:mapped==='FAILED'?timestamp:latest.job.failed_at,
      cancelled_at:mapped==='CANCELLED'?timestamp:latest.job.cancelled_at,
      error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null,result_asset_ids:(generation as any).result_asset_ids||[],result_text:(generation as any).result_text||null,result_structured:(generation as any).result_structured||null} as BetaJob;
    if(latest.job.status!==mapped)assertJobTransition(latest.job.status,mapped);
    await betaJobRepository.saveConditional(next,latest.updateTime);
    const attemptStatus=mapped==='SUCCEEDED'?'SUCCEEDED':mapped==='FAILED'?'FAILED':mapped==='CANCELLED'?'CANCELLED':'RUNNING';
    currentAttempt=await markAttempt(running.job_id,userId,currentAttempt,attemptStatus,{generation_id:generation.generation_id,
      completed_at:isTerminalJobStatus(mapped)?timestamp:null,error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null});
    return next;
  }catch(error:any){
    const existing=await generationRepository.findByClientRequest(userId,currentAttempt.execution_key).catch(()=>null);
    if(existing){
      const recovered=await generationService.getGeneration(existing.generation_id,userId).catch(()=>existing);
      const latest=await betaJobRepository.getJobWithVersion(running.job_id,userId);
      if(latest&&latest.job.status==='RUNNING'){
        const mapped=generationStatusToJobStatus(recovered?.status||existing.status);
        const timestamp=now();
        const next={...latest.job,status:mapped,linked_generation_id:existing.generation_id,updated_at:timestamp,
          completed_at:mapped==='SUCCEEDED'?timestamp:latest.job.completed_at,
          failed_at:mapped==='FAILED'?timestamp:latest.job.failed_at,
          cancelled_at:mapped==='CANCELLED'?timestamp:latest.job.cancelled_at,
          error_code:(recovered as any)?.error_code||null,error_message:(recovered as any)?.error_message||null,result_asset_ids:(recovered as any)?.result_asset_ids||[],result_text:(recovered as any)?.result_text||null,result_structured:(recovered as any)?.result_structured||null} as BetaJob;
        if(latest.job.status!==mapped)assertJobTransition(latest.job.status,mapped);
        try{
          await betaJobRepository.saveConditional(next,latest.updateTime);
          const attemptStatus=mapped==='SUCCEEDED'?'SUCCEEDED':mapped==='FAILED'?'FAILED':mapped==='CANCELLED'?'CANCELLED':'RUNNING';
          await markAttempt(running.job_id,userId,currentAttempt,attemptStatus,{generation_id:existing.generation_id,
            completed_at:isTerminalJobStatus(mapped)?timestamp:null,error_code:(recovered as any)?.error_code||null,error_message:(recovered as any)?.error_message||null});
          return next;
        }catch{
          throw Object.assign(new Error('A geração já existe e será recuperada pelo mesmo job; nenhuma nova cobrança será criada.'),{code:'JOB_STATE_PERSISTENCE_PENDING'});
        }
      }
      throw Object.assign(new Error('A geração desta tentativa já existe; atualize o job antes de tentar novamente.'),{code:'JOB_STATE_PERSISTENCE_PENDING'});
    }

    const latest=await betaJobRepository.getJobWithVersion(running.job_id,userId);
    const timestamp=now();
    if(latest&&!isTerminalJobStatus(latest.job.status)){
      const failed={...latest.job,status:'FAILED' as const,failed_at:timestamp,updated_at:timestamp,error_code:error?.code||'JOB_EXECUTION_FAILED',error_message:error?.message||'Falha ao executar job.'};
      assertJobTransition(latest.job.status,'FAILED');
      await betaJobRepository.saveConditional(failed,latest.updateTime).catch(()=>{});
    }
    await markAttempt(running.job_id,userId,currentAttempt,'FAILED',{completed_at:timestamp,error_code:error?.code||'JOB_EXECUTION_FAILED',error_message:error?.message||'Falha ao executar job.'}).catch(()=>{});
    throw error;
  }
}

async function reconcileJob(job:BetaJob,userId:string){
  if(job.status!=='RUNNING')return job;
  let generationId=job.linked_generation_id||null;
  let currentAttempt:BetaJobAttempt|undefined;
  if(!generationId&&job.current_attempt_id){
    const attempts=await betaJobRepository.listAttempts(job.job_id,userId);
    currentAttempt=attempts.find(item=>item.attempt_id===job.current_attempt_id);
    if(currentAttempt){
      const existing=await generationRepository.findByClientRequest(userId,currentAttempt.execution_key).catch(()=>null);
      generationId=existing?.generation_id||null;
    }
  }
  if(!generationId)return job;
  const generation=await generationService.getGeneration(generationId,userId);
  if(!generation)return job;
  const mapped=generationStatusToJobStatus(generation.status);
  if(mapped===job.status&&job.linked_generation_id===generationId)return job;
  const versioned=await betaJobRepository.getJobWithVersion(job.job_id,userId);
  if(!versioned)return job;
  if(versioned.job.status!==job.status)return versioned.job;
  assertJobTransition(versioned.job.status,mapped);
  const timestamp=now();
  const next={...versioned.job,status:mapped,linked_generation_id:generationId,updated_at:timestamp,
    completed_at:mapped==='SUCCEEDED'?timestamp:versioned.job.completed_at,
    failed_at:mapped==='FAILED'?timestamp:versioned.job.failed_at,
    cancelled_at:mapped==='CANCELLED'?timestamp:versioned.job.cancelled_at,
    error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null,result_asset_ids:(generation as any).result_asset_ids||[],result_text:(generation as any).result_text||null,result_structured:(generation as any).result_structured||null} as BetaJob;
  await betaJobRepository.saveConditional(next,versioned.updateTime);
  const attempts=await betaJobRepository.listAttempts(job.job_id,userId);
  const attempt=attempts.find(item=>item.attempt_id===next.current_attempt_id);
  if(attempt){
    const attemptStatus=mapped==='SUCCEEDED'?'SUCCEEDED':mapped==='FAILED'?'FAILED':mapped==='CANCELLED'?'CANCELLED':'RUNNING';
    await markAttempt(job.job_id,userId,attempt,attemptStatus,{completed_at:isTerminalJobStatus(mapped)?timestamp:null,
      error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null});
  }
  return next;
}

function publicAttempt(attempt:BetaJobAttempt){
  const {execution_key,...safe}=attempt;
  return safe;
}

export function publicBetaJob(job:BetaJob,attempts:BetaJobAttempt[]=[]){
  const {idempotency_fingerprint,...safe}=job;
  return{...safe,attempts:attempts.map(publicAttempt)};
}

export const betaJobOrchestrator={
  async create(userId:string,body:any,idempotencyKey:string){
    const request=normalizeRequest(body);
    await validateRequest(request,undefined,userId);
    const timestamp=now();
    const job:BetaJob={
      job_id:makeId('bjob'),user_id:userId,status:'DRAFT',request,quote:null,linked_generation_id:null,current_attempt_id:null,
      attempt_count:0,error_code:null,error_message:null,idempotency_fingerprint:'',created_at:timestamp,updated_at:timestamp,
    };
    return betaJobRepository.createIdempotent({userId,idempotencyKey,job});
  },

  async quote(userId:string,jobId:string,idempotencyKey:string){
    return mutation({userId,jobId,action:'QUOTE',idempotencyKey},async()=>{
      await betaEconomicsService.assertExecutionEnabled();
      const current=await this.get(userId,jobId,false);
      if(current.status==='QUOTED'&&current.quote){
        try{betaEconomicsService.assertQuoteFresh(current.quote);return current;}catch{}
      }
      const {mode}=await validateRequest(current.request,undefined,userId);
      const context=await pricingContext(userId,current.request);
      const base=await pricingInput(userId,current.request,mode,current.request.model_id,context);
      const {userId:_userId,model_id:_modelId,mode:_mode,...pricingRest}=base;
      const resolved=await betaEconomicsService.resolveQuote({
        userId,requestedModelId:current.request.model_id,capabilityId:current.request.capability_id,mode,pricingInput:pricingRest,
        requestedControls:requestedControls(current.request),
      });
      const preview=resolved.preview,timestamp=now(),expiresAt=betaEconomicsService.quoteExpiry(resolved.pricing_policy,new Date(timestamp));
      const quoted=await saveTransition(current,userId,'QUOTED',{
        quote:{credit_price:preview.retail.retail_credit_price,retail_pricing_id:preview.retail.retail_pricing_id,
          retail_pricing_version:preview.retail.version,pricing_signature_hash:preview.signature.hash,
          requested_model_id:current.request.model_id,selected_model_id:resolved.selected_model_id,routing_mode:resolved.routing_mode,
          pricing_policy_id:resolved.pricing_policy.pricing_policy_id,quoted_at:timestamp,expires_at:expiresAt},
        quoted_at:timestamp,error_code:null,error_message:null,
      });
      await betaEconomicsService.recordLedgerEvent({event_id:`quote:${current.job_id}:${timestamp}`,event_type:'QUOTE_AUTHORIZED',user_id:userId,job_id:current.job_id,generation_id:null,requested_model_id:current.request.model_id,selected_model_id:resolved.selected_model_id,routing_mode:resolved.routing_mode,pricing_policy_id:resolved.pricing_policy.pricing_policy_id,retail_pricing_id:preview.retail.retail_pricing_id,pricing_signature_hash:preview.signature.hash,credit_price:preview.retail.retail_credit_price,quote_expires_at:expiresAt});
      return quoted;
    });
  },

  async queue(userId:string,jobId:string,idempotencyKey:string,reqHost?:string,idToken?:string){
    return mutation({userId,jobId,action:'QUEUE',idempotencyKey},async()=>{
      await betaEconomicsService.assertExecutionEnabled();
      const current=await this.get(userId,jobId,true);
      if(current.status==='RUNNING'||current.status==='SUCCEEDED')return current;
      if(current.status!=='QUOTED')throw Object.assign(new Error('O job precisa estar cotado antes de entrar na fila.'),{code:'JOB_QUOTE_REQUIRED'});
      const queued=await createQueuedAttempt(current,userId);
      await inlineBetaJobQueue.enqueue(queued.job,queued.attempt,async()=>{await executeAttempt(queued.job,queued.attempt,userId,reqHost,idToken);});
      return this.get(userId,jobId,true);
    });
  },

  async retry(userId:string,jobId:string,idempotencyKey:string,reqHost?:string,idToken?:string){
    return mutation({userId,jobId,action:'RETRY',idempotencyKey},async()=>{
      await betaEconomicsService.assertExecutionEnabled();
      const current=await this.get(userId,jobId,true);
      if(current.status!=='FAILED'&&current.status!=='CANCELLED'){
        throw Object.assign(new Error('Apenas jobs falhos ou cancelados podem ser reenfileirados.'),{code:'JOB_RETRY_UNAVAILABLE'});
      }
      if(!current.quote)throw Object.assign(new Error('Refaça a cotação antes de tentar novamente.'),{code:'JOB_QUOTE_REQUIRED'});
      betaEconomicsService.assertQuoteFresh(current.quote);
      const queued=await createQueuedAttempt(current,userId);
      await inlineBetaJobQueue.enqueue(queued.job,queued.attempt,async()=>{await executeAttempt(queued.job,queued.attempt,userId,reqHost,idToken);});
      return this.get(userId,jobId,true);
    });
  },

  async cancel(userId:string,jobId:string,idempotencyKey:string){
    return mutation({userId,jobId,action:'CANCEL',idempotencyKey},async()=>{
      const current=await this.get(userId,jobId,true);
      if(isTerminalJobStatus(current.status))return current;
      if(current.linked_generation_id)await generationService.cancelGeneration(current.linked_generation_id,userId);
      const cancelled=await saveTransition(current,userId,'CANCELLED',{cancelled_at:now(),error_code:null,error_message:null});
      const attempts=await betaJobRepository.listAttempts(jobId,userId);
      const attempt=attempts.find(item=>item.attempt_id===cancelled.current_attempt_id);
      if(attempt&&!['SUCCEEDED','FAILED','CANCELLED'].includes(attempt.status))await markAttempt(jobId,userId,attempt,'CANCELLED',{completed_at:now()});
      return cancelled;
    });
  },

  async get(userId:string,jobId:string,reconcile=true):Promise<BetaJob>{
    const job=await betaJobRepository.getJob(jobId,userId);
    if(!job)throw Object.assign(new Error('Job não encontrado.'),{code:'JOB_NOT_FOUND'});
    return reconcile?reconcileJob(job,userId):job;
  },

  async getPublic(userId:string,jobId:string){
    const job=await this.get(userId,jobId,true);
    const attempts=await betaJobRepository.listAttempts(jobId,userId);
    return publicBetaJob(job,attempts);
  },

  async listPublic(userId:string,limit=50){
    const jobs=await betaJobRepository.listJobs(userId,limit);
    const reconciled=await Promise.all(jobs.map(job=>job.status==='RUNNING'?reconcileJob(job,userId):Promise.resolve(job)));
    return Promise.all(reconciled.map(async job=>publicBetaJob(job,await betaJobRepository.listAttempts(job.job_id,userId))));
  },
};
