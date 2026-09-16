import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaJob, BetaJobAttempt, BetaJobMutation } from './jobTypes.js';

const JOBS='beta_jobs';
const ATTEMPTS='beta_job_attempts';
const CREATE_IDEMPOTENCY='beta_job_idempotency';
const MUTATIONS='beta_job_mutations';

const now=()=>new Date().toISOString();
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');

export function idempotencyFingerprint(userId:string,scope:string,key:string){
  return hash(`${userId}:${scope}:${key}`);
}

function ensureIdempotencyKey(key:string){
  const normalized=String(key||'').trim();
  if(normalized.length<8||normalized.length>200){
    throw Object.assign(new Error('Idempotency-Key deve ter entre 8 e 200 caracteres.'),{code:'IDEMPOTENCY_KEY_REQUIRED'});
  }
  return normalized;
}

async function getJobDocument(jobId:string){
  return firestoreAdminRest.get(`${JOBS}/${encodeURIComponent(jobId)}`);
}

export const betaJobRepository={
  async createIdempotent(params:{userId:string;idempotencyKey:string;job:BetaJob}):Promise<BetaJob>{
    const key=ensureIdempotencyKey(params.idempotencyKey);
    const fingerprint=idempotencyFingerprint(params.userId,'CREATE',key);
    const idemPath=`${CREATE_IDEMPOTENCY}/${fingerprint}`;
    const existing=await firestoreAdminRest.get(idemPath);
    if(existing.exists){
      const prior=await this.getJob(String(existing.data.job_id||''),params.userId);
      if(prior)return prior;
      throw Object.assign(new Error('Registro idempotente inconsistente.'),{code:'JOB_IDEMPOTENCY_INCONSISTENT'});
    }

    const job={...params.job,idempotency_fingerprint:fingerprint};
    try{
      await firestoreAdminRest.commit([
        {update:{name:firestoreAdminRest.docName(`${JOBS}/${encodeURIComponent(job.job_id)}`),fields:firestoreAdminRest.fields(job)},currentDocument:{exists:false}},
        {update:{name:firestoreAdminRest.docName(idemPath),fields:firestoreAdminRest.fields({job_id:job.job_id,user_id:params.userId,created_at:now()})},currentDocument:{exists:false}},
      ]);
      return job;
    }catch(error){
      const after=await firestoreAdminRest.get(idemPath);
      if(after.exists){
        const prior=await this.getJob(String(after.data.job_id||''),params.userId);
        if(prior)return prior;
      }
      throw error;
    }
  },

  async getJob(jobId:string,userId:string):Promise<BetaJob|null>{
    const doc=await getJobDocument(jobId);
    if(!doc.exists)return null;
    const job=doc.data as BetaJob;
    return job.user_id===userId?job:null;
  },

  async getJobWithVersion(jobId:string,userId:string){
    const doc=await getJobDocument(jobId);
    if(!doc.exists)return null;
    const job=doc.data as BetaJob;
    if(job.user_id!==userId)return null;
    return{job,updateTime:String(doc.updateTime||'')};
  },

  async listJobs(userId:string,limit=50):Promise<BetaJob[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:JOBS}],
      where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],
      limit:Math.min(100,Math.max(1,limit)),
    });
    return rows.map((row:any)=>row.data as BetaJob);
  },

  async saveConditional(job:BetaJob,updateTime:string):Promise<BetaJob>{
    await firestoreAdminRest.commit([{
      update:{name:firestoreAdminRest.docName(`${JOBS}/${encodeURIComponent(job.job_id)}`),fields:firestoreAdminRest.fields(job)},
      currentDocument:{updateTime},
    }]);
    return job;
  },

  async saveJobAndAttemptConditional(job:BetaJob,updateTime:string,attempt:BetaJobAttempt):Promise<BetaJob>{
    await firestoreAdminRest.commit([
      {update:{name:firestoreAdminRest.docName(`${JOBS}/${encodeURIComponent(job.job_id)}`),fields:firestoreAdminRest.fields(job)},currentDocument:{updateTime}},
      {update:{name:firestoreAdminRest.docName(`${ATTEMPTS}/${encodeURIComponent(attempt.attempt_id)}`),fields:firestoreAdminRest.fields(attempt)},currentDocument:{exists:false}},
    ]);
    return job;
  },

  async saveAttempt(attempt:BetaJobAttempt){
    await firestoreAdminRest.set(`${ATTEMPTS}/${encodeURIComponent(attempt.attempt_id)}`,attempt);
    return attempt;
  },

  async listAttempts(jobId:string,userId:string):Promise<BetaJobAttempt[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:ATTEMPTS}],
      where:{compositeFilter:{op:'AND',filters:[
        {fieldFilter:{field:{fieldPath:'job_id'},op:'EQUAL',value:{stringValue:jobId}}},
        {fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      ]}},
      limit:50,
    });
    return rows.map((row:any)=>row.data as BetaJobAttempt).sort((a,b)=>a.attempt_number-b.attempt_number);
  },

  async claimMutation(params:{userId:string;jobId:string;action:BetaJobMutation['action'];idempotencyKey:string}){
    const key=ensureIdempotencyKey(params.idempotencyKey);
    const mutationId=idempotencyFingerprint(params.userId,`${params.action}:${params.jobId}`,key);
    const path=`${MUTATIONS}/${mutationId}`;
    const existing=await firestoreAdminRest.get(path);
    if(existing.exists)return{claimed:false,mutation:existing.data as BetaJobMutation};

    const timestamp=now();
    const mutation:BetaJobMutation={
      mutation_id:mutationId,user_id:params.userId,job_id:params.jobId,action:params.action,
      status:'RUNNING',created_at:timestamp,updated_at:timestamp,error_code:null,
    };
    try{
      await firestoreAdminRest.commit([{
        update:{name:firestoreAdminRest.docName(path),fields:firestoreAdminRest.fields(mutation)},
        currentDocument:{exists:false},
      }]);
      return{claimed:true,mutation};
    }catch(error){
      const after=await firestoreAdminRest.get(path);
      if(after.exists)return{claimed:false,mutation:after.data as BetaJobMutation};
      throw error;
    }
  },

  async finishMutation(mutation:BetaJobMutation,status:'COMPLETED'|'FAILED',errorCode?:string|null){
    const next={...mutation,status,error_code:errorCode||null,updated_at:now()} as BetaJobMutation;
    await firestoreAdminRest.set(`${MUTATIONS}/${mutation.mutation_id}`,next);
    return next;
  },
};
