import crypto from 'crypto';
import {firestoreAdminRest} from '../../repositories/firestoreAdminRest.js';
import {BatchRecord} from './batchTypes.js';
const COLLECTION='beta_batches',IDEMPOTENCY='beta_batch_idempotency';
const safe=(v:string)=>encodeURIComponent(v),now=()=>new Date().toISOString(),id=()=>`batch_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
async function owned(userId:string){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:COLLECTION}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},limit:100});return rows.map((x:any)=>x.data as BatchRecord);}
export const batchRepository={
 async list(userId:string){return (await owned(userId)).filter(x=>!x.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));},
 async get(batchId:string,userId:string){const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(batchId)}`);if(!doc.exists)return null;const row=doc.data as BatchRecord;return row.user_id===userId&&!row.deleted_at?row:null;},
 async createIdempotent(userId:string,key:string,row:Omit<BatchRecord,'batch_id'|'created_at'|'updated_at'|'started_at'|'completed_at'|'deleted_at'>){const idemKey=crypto.createHash('sha256').update(`${userId}:${key}`).digest('hex'),idem=await firestoreAdminRest.get(`${IDEMPOTENCY}/${idemKey}`);if(idem.exists){const existing=await this.get(String(idem.data?.batch_id||''),userId);if(existing)return existing;}const timestamp=now(),batch:BatchRecord={...row,batch_id:id(),created_at:timestamp,updated_at:timestamp,started_at:null,completed_at:null,deleted_at:null};await firestoreAdminRest.commit([{update:{name:firestoreAdminRest.docName(`${COLLECTION}/${safe(batch.batch_id)}`),fields:firestoreAdminRest.fields(batch)},currentDocument:{exists:false}},{update:{name:firestoreAdminRest.docName(`${IDEMPOTENCY}/${idemKey}`),fields:firestoreAdminRest.fields({batch_id:batch.batch_id,user_id:userId,created_at:timestamp})},currentDocument:{exists:false}}]);return batch;},
 async save(row:BatchRecord){const next={...row,updated_at:now()};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.batch_id)}`,next);return next;}
};
