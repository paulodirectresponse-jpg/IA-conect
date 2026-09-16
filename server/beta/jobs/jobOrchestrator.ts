import crypto from 'crypto';
import { GenerationMode, ModelRegistryItem } from '../../../src/types/index.js';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { creditPricingService } from '../../services/creditPricingService.js';
import { generationService } from '../../services/generationService.js';
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
  return null;
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
    },
  };
}

async function validateRequest(request:BetaJobRequest):Promise<{model:ModelRegistryItem;mode:GenerationMode}>{
  if(!request.model_id)throw Object.assign(new Error('Modelo é obrigatório.'),{code:'VALIDATION_ERROR'});
  const model=await catalogRepository.getModel(request.model_id);
  const capability=validateModelCapability(model,request.capability_id,requestedControls(request));
  if(!capability.valid)throw Object.assign(new Error(capability.message||'Capability inválida.'),{code:capability.code||'CAPABILITY_INVALID'});
  const mode=generationModeForCapability(request.capability_id);
  if(!mode)throw Object.assign(new Error('Esta capability ainda não possui executor na PR-03.'),{code:'CAPABILITY_EXECUTOR_UNAVAILABLE'});
  if(!request.prompt)throw Object.assign(new Error('Prompt é obrigatório para esta capability.'),{code:'VALIDATION_ERROR'});
  if((request.capability_id==='image-to-image'||request.capability_id==='image-to-video')&&!request.references.length){
    throw Object.assign(new Error('Esta capability exige uma imagem de entrada.'),{code:'REFERENCE_REQUIRED'});
  }
  if(request.capability_id==='first-frame'&&!request.references.some(ref=>ref.slot_type==='INITIAL')){
    throw Object.assign(new Error('Adicione o frame inicial.'),{code:'REFERENCE_REQUIRED'});
  }
  if(request.capability_id==='last-frame'&&(!request.references.some(ref=>ref.slot_type==='INITIAL')||!request.references.some(ref=>ref.slot_type==='END'))){
    throw Object.assign(new Error('Adicione os frames inicial e final.'),{code:'REFERENCE_REQUIRED'});
  }
  return{model:model!,mode};
}

function pricingInput(userId:string,request:BetaJobRequest,mode:GenerationMode){
  const image=mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';
  return{
    userId,model_id:request.model_id,mode,prompt:request.prompt,negative_prompt:request.negative_prompt,
    duration_seconds:image?1:Math.max(1,Math.round(request.controls.duration_seconds||5)),
    resolution:request.controls.resolution||(image?'1K':'720p'),
    aspect_ratio:request.controls.aspect_ratio||(image?'1:1':'16:9'),
    number_of_outputs:image?Math.max(1,Math.min(4,Math.round(request.controls.number_of_outputs||1))):1,
    seed:request.controls.seed,motion_strength:request.controls.motion_strength,
    references:request.references,audio_enabled:request.controls.audio_enabled,
    model_variant:request.controls.model_variant,pricing_options:request.controls.pricing_options,
  };
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
  const attemptNumber=versioned.job.attempt_count+1;
  const attemptId=`batt_${versioned.job.job_id}_${attemptNumber}`;
  const timestamp=now();
  const attempt:BetaJobAttempt={
    attempt_id:attemptId,job_id:versioned.job.job_id,user_id:userId,attempt_number:attemptNumber,status:'QUEUED',
    execution_key:`beta-job:${versioned.job.job_id}:attempt:${attemptNumber}`,
    generation_id:null,error_code:null,error_message:null,created_at:timestamp,updated_at:timestamp,
  };
  const queued={...versioned.job,status:'QUEUED' as const,current_attempt_id:attemptId,attempt_count:attemptNumber,queued_at:timestamp,updated_at:timestamp,error_code:null,error_message:null};
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
    const {mode}=await validateRequest(running.request);
    const input=pricingInput(userId,running.request,mode);
    const quote=running.quote!;
    const generation=await generationService.createAndStartGeneration({
      userId,model_id:input.model_id,mode,prompt:input.prompt,negative_prompt:input.negative_prompt,
      duration_seconds:input.duration_seconds,resolution:input.resolution,aspect_ratio:input.aspect_ratio,
      number_of_outputs:input.number_of_outputs,seed:input.seed,motion_strength:input.motion_strength,
      references:running.request.references,client_request_id:currentAttempt.execution_key,
      authorized_credit_price:quote.credit_price,retail_pricing_id:quote.retail_pricing_id,
      pricing_signature_hash:quote.pricing_signature_hash,audio_enabled:input.audio_enabled,
      model_variant:input.model_variant,pricing_options:input.pricing_options,reqHost,idToken,
    });
    const mapped=generationStatusToJobStatus(generation.status);
    const latest=await betaJobRepository.getJobWithVersion(running.job_id,userId);
    if(!latest)return running;
    const timestamp=now();
    const next={...latest.job,status:mapped,linked_generation_id:generation.generation_id,updated_at:timestamp,
      completed_at:mapped==='SUCCEEDED'?timestamp:latest.job.completed_at,
      failed_at:mapped==='FAILED'?timestamp:latest.job.failed_at,
      cancelled_at:mapped==='CANCELLED'?timestamp:latest.job.cancelled_at,
      error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null} as BetaJob;
    if(latest.job.status!==mapped)assertJobTransition(latest.job.status,mapped);
    await betaJobRepository.saveConditional(next,latest.updateTime);
    const attemptStatus=mapped==='SUCCEEDED'?'SUCCEEDED':mapped==='FAILED'?'FAILED':mapped==='CANCELLED'?'CANCELLED':'RUNNING';
    currentAttempt=await markAttempt(running.job_id,userId,currentAttempt,attemptStatus,{generation_id:generation.generation_id,
      completed_at:isTerminalJobStatus(mapped)?timestamp:null,error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null});
    return next;
  }catch(error:any){
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
  if(job.status!=='RUNNING'||!job.linked_generation_id)return job;
  const generation=await generationService.getGeneration(job.linked_generation_id,userId);
  if(!generation)return job;
  const mapped=generationStatusToJobStatus(generation.status);
  if(mapped===job.status)return job;
  const versioned=await betaJobRepository.getJobWithVersion(job.job_id,userId);
  if(!versioned)return job;
  if(versioned.job.status!==job.status)return versioned.job;
  assertJobTransition(versioned.job.status,mapped);
  const timestamp=now();
  const next={...versioned.job,status:mapped,updated_at:timestamp,
    completed_at:mapped==='SUCCEEDED'?timestamp:versioned.job.completed_at,
    failed_at:mapped==='FAILED'?timestamp:versioned.job.failed_at,
    cancelled_at:mapped==='CANCELLED'?timestamp:versioned.job.cancelled_at,
    error_code:(generation as any).error_code||null,error_message:(generation as any).error_message||null} as BetaJob;
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
    await validateRequest(request);
    const timestamp=now();
    const job:BetaJob={
      job_id:makeId('bjob'),user_id:userId,status:'DRAFT',request,quote:null,linked_generation_id:null,current_attempt_id:null,
      attempt_count:0,error_code:null,error_message:null,idempotency_fingerprint:'',created_at:timestamp,updated_at:timestamp,
    };
    return betaJobRepository.createIdempotent({userId,idempotencyKey,job});
  },

  async quote(userId:string,jobId:string,idempotencyKey:string){
    return mutation({userId,jobId,action:'QUOTE',idempotencyKey},async()=>{
      const current=await this.get(userId,jobId,false);
      if(current.status==='QUOTED')return current;
      const {mode}=await validateRequest(current.request);
      const preview=await creditPricingService.preview(pricingInput(userId,current.request,mode));
      const timestamp=now();
      return saveTransition(current,userId,'QUOTED',{
        quote:{credit_price:preview.retail.retail_credit_price,retail_pricing_id:preview.retail.retail_pricing_id,
          retail_pricing_version:preview.retail.version,pricing_signature_hash:preview.signature.hash,quoted_at:timestamp},
        quoted_at:timestamp,error_code:null,error_message:null,
      });
    });
  },

  async queue(userId:string,jobId:string,idempotencyKey:string,reqHost?:string,idToken?:string){
    return mutation({userId,jobId,action:'QUEUE',idempotencyKey},async()=>{
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
      const current=await this.get(userId,jobId,true);
      if(current.status!=='FAILED'&&current.status!=='CANCELLED'){
        throw Object.assign(new Error('Apenas jobs falhos ou cancelados podem ser reenfileirados.'),{code:'JOB_RETRY_UNAVAILABLE'});
      }
      if(!current.quote)throw Object.assign(new Error('Refaça a cotação antes de tentar novamente.'),{code:'JOB_QUOTE_REQUIRED'});
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
