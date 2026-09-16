import { apiRequest } from '../services/apiClient.js';

export type BetaJobStatus='DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface BetaJobAttemptView{attempt_id:string;job_id:string;user_id:string;attempt_number:number;status:string;generation_id?:string|null;error_code?:string|null;error_message?:string|null;created_at:string;updated_at:string;started_at?:string|null;completed_at?:string|null;}
export interface BetaJobView{
  job_id:string;user_id:string;status:BetaJobStatus;request:any;quote?:{credit_price:number;retail_pricing_id:string;retail_pricing_version:number;pricing_signature_hash:string;quoted_at:string}|null;
  linked_generation_id?:string|null;current_attempt_id?:string|null;attempt_count:number;error_code?:string|null;error_message?:string|null;
  created_at:string;updated_at:string;quoted_at?:string|null;queued_at?:string|null;started_at?:string|null;completed_at?:string|null;failed_at?:string|null;cancelled_at?:string|null;
  attempts:BetaJobAttemptView[];
}

const STORAGE_KEY='ia-conect:beta:active-jobs:v1';
const terminal=(status:BetaJobStatus)=>['SUCCEEDED','FAILED','CANCELLED'].includes(status);

function makeIdempotencyKey(scope:string){
  const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${id}`;
}

function readRemembered():string[]{
  if(typeof window==='undefined')return[];
  try{const value=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value.map(String).filter(Boolean):[];}catch{return[];}
}
function writeRemembered(ids:string[]){
  if(typeof window==='undefined')return;
  try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(Array.from(new Set(ids)).slice(0,50)));}catch{}
}
export function rememberBetaJob(job:BetaJobView){
  const ids=readRemembered().filter(id=>id!==job.job_id);
  if(!terminal(job.status))ids.unshift(job.job_id);
  writeRemembered(ids);
  return job;
}
export function forgetBetaJob(jobId:string){writeRemembered(readRemembered().filter(id=>id!==jobId));}
export function listRememberedBetaJobIds(){return readRemembered();}

function mutation(jobId:string,path:string,scope:string,idempotencyKey?:string){
  return apiRequest<BetaJobView>(`/api/beta/jobs/${jobId}/${path}`,{
    method:'POST',headers:{'Idempotency-Key':idempotencyKey||makeIdempotencyKey(scope)},
  }).then(rememberBetaJob);
}

export const betaJobClient={
  create(request:any,idempotencyKey=makeIdempotencyKey('create')){
    return apiRequest<BetaJobView>('/api/beta/jobs',{
      method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(request),
    }).then(rememberBetaJob);
  },
  quote(jobId:string,idempotencyKey?:string){return mutation(jobId,'quote','quote',idempotencyKey);},
  queue(jobId:string,idempotencyKey?:string){return mutation(jobId,'queue','queue',idempotencyKey);},
  retry(jobId:string,idempotencyKey?:string){return mutation(jobId,'retry','retry',idempotencyKey);},
  cancel(jobId:string,idempotencyKey?:string){return mutation(jobId,'cancel','cancel',idempotencyKey);},
  get(jobId:string){return apiRequest<BetaJobView>(`/api/beta/jobs/${jobId}`).then(rememberBetaJob);},
  list(limit=50){return apiRequest<BetaJobView[]>(`/api/beta/jobs?limit=${Math.min(100,Math.max(1,limit))}`).then(jobs=>jobs.map(rememberBetaJob));},
  async restoreRemembered(){
    const ids=listRememberedBetaJobIds();
    const settled=await Promise.allSettled(ids.map(id=>this.get(id)));
    return settled.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  },
};
