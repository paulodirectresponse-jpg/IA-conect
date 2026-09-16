import { generationRepository } from '../../repositories/generationRepository.js';
import { providerRegistry } from '../../adapters/providerRegistry.js';
import { betaJobOrchestrator } from '../jobs/jobOrchestrator.js';
import { publicErrorFromStored } from '../http/publicError.js';
import { BetaTaskStatus, BetaTaskView } from './taskTypes.js';

const TERMINAL_GENERATION=new Set(['SUCCEEDED','FAILED','CANCELLED','REFUNDED']);

export function betaTaskStatusFromJobStatus(jobStatus:string):BetaTaskStatus|null{
  if(jobStatus==='QUEUED')return'QUEUED';
  if(jobStatus==='RUNNING')return'RUNNING';
  if(jobStatus==='SUCCEEDED')return'COMPLETED';
  if(jobStatus==='FAILED')return'FAILED';
  if(jobStatus==='CANCELLED')return'CANCELLED';
  return null;
}

async function cancelSupported(job:any){
  if(job.status==='QUEUED')return true;
  if(job.status!=='RUNNING')return false;
  if(!job.linked_generation_id)return true;
  const generation=await generationRepository.getGeneration(job.linked_generation_id);
  if(!generation||TERMINAL_GENERATION.has(String(generation.status)))return false;
  if(!generation.provider_job_id)return true;
  const adapter=providerRegistry.getAdapter(generation.provider_id);
  return Boolean(adapter?.cancelJob);
}

async function toTask(job:any):Promise<BetaTaskView|null>{
  const status=betaTaskStatusFromJobStatus(job.status);
  if(!status)return null;
  return{
    task_id:job.job_id,
    job_id:job.job_id,
    status,
    capability_id:String(job.request?.capability_id||''),
    model_id:String(job.request?.model_id||''),
    attempt_count:Number(job.attempt_count||0),
    can_retry:(job.status==='FAILED'||job.status==='CANCELLED')&&Boolean(job.quote),
    can_cancel:await cancelSupported(job),
    error:publicErrorFromStored(job.error_code,job.error_message),
    generation_id:job.linked_generation_id||null,
    created_at:job.created_at,
    updated_at:job.updated_at,
    started_at:job.started_at||null,
    completed_at:job.completed_at||job.failed_at||job.cancelled_at||null,
  };
}

async function currentTask(userId:string,jobId:string){
  const job=await betaJobOrchestrator.getPublic(userId,jobId);
  const task=await toTask(job);
  if(!task)throw Object.assign(new Error('Tarefa não encontrada.'),{code:'JOB_NOT_FOUND'});
  return task;
}

export const betaTaskService={
  async list(userId:string,limit=30){
    const jobs=await betaJobOrchestrator.listPublic(userId,Math.min(100,Math.max(1,limit)));
    const tasks=await Promise.all(jobs.map(toTask));
    return tasks.filter((task):task is BetaTaskView=>Boolean(task));
  },

  async get(userId:string,taskId:string){
    return currentTask(userId,taskId);
  },

  async retry(userId:string,taskId:string,idempotencyKey:string,reqHost?:string,idToken?:string){
    const before=await currentTask(userId,taskId);
    if(!before.can_retry)throw Object.assign(new Error('Esta tarefa não está disponível para nova tentativa.'),{code:'JOB_RETRY_UNAVAILABLE'});
    await betaJobOrchestrator.retry(userId,taskId,idempotencyKey,reqHost,idToken);
    return currentTask(userId,taskId);
  },

  async cancel(userId:string,taskId:string,idempotencyKey:string){
    const before=await currentTask(userId,taskId);
    if(!before.can_cancel)throw Object.assign(new Error('Esta tarefa não pode mais ser cancelada.'),{code:'TASK_CANCEL_UNAVAILABLE'});
    await betaJobOrchestrator.cancel(userId,taskId,idempotencyKey);
    return currentTask(userId,taskId);
  },
};
