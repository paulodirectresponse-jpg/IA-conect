import { Generation, GenerationAttemptLog } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';
import crypto from 'crypto';

function clientRequestPath(userId:string,clientRequestId:string){
  const id=crypto.createHash('sha256').update(`${userId}:${clientRequestId}`).digest('hex');
  return `generation_client_requests/${id}`;
}

export const generationRepository={
 async getGeneration(id:string):Promise<Generation|null>{
  const doc=await firestoreAdminRest.get(`generations/${encodeURIComponent(id)}`);
  return doc.exists?doc.data as Generation:null;
 },
 async getGenerations(ids:string[]):Promise<Generation[]>{
  const unique=[...new Set(ids.filter(Boolean))];
  if(!unique.length)return[];
  const paths=unique.map(id=>`generations/${encodeURIComponent(id)}`);
  const docs=await firestoreAdminRest.batchGet(paths);
  return paths.map(path=>docs.get(path)).filter(doc=>doc?.exists).map(doc=>doc!.data as Generation);
 },
 async findByClientRequest(userId:string,clientRequestId:string):Promise<Generation|null>{
  const pointer=await firestoreAdminRest.get(clientRequestPath(userId,clientRequestId));
  if(pointer.exists&&pointer.data?.generation_id)return this.getGeneration(String(pointer.data.generation_id));
  const rows=await firestoreAdminRest.runQuery({
   from:[{collectionId:'generations'}],
   where:{compositeFilter:{op:'AND',filters:[
    {fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
    {fieldFilter:{field:{fieldPath:'client_request_id'},op:'EQUAL',value:{stringValue:clientRequestId}}}
   ]}},
   limit:1
  });
  return rows.length?rows[0].data as Generation:null;
 },
 async saveGeneration(g:Generation):Promise<Generation>{
  await firestoreAdminRest.set(`generations/${encodeURIComponent(g.generation_id)}`,g);
  if(g.client_request_id)await firestoreAdminRest.set(clientRequestPath(g.user_id,g.client_request_id),{
   user_id:g.user_id,client_request_id:g.client_request_id,generation_id:g.generation_id,updated_at:new Date().toISOString(),
  });
  return g;
 },
 async listUserGenerations(userId:string,limit=50):Promise<Generation[]>{
  const rows=await firestoreAdminRest.runQuery({
   from:[{collectionId:'generations'}],
   where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
   orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],
   limit
  });
  return rows.map((r:any)=>r.data as Generation);
 },
 async listAllGenerations(limit=50):Promise<Generation[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'generations'}],orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit});
  return rows.map((r:any)=>r.data as Generation);
 },
 async recordAttemptLog(a:GenerationAttemptLog){
  await firestoreAdminRest.set(`generation_attempts/${encodeURIComponent(a.attempt_id)}`,a);
  return a;
 },
 async getAttemptLogs(generationId:string):Promise<GenerationAttemptLog[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'generation_attempts'}],where:{fieldFilter:{field:{fieldPath:'generation_id'},op:'EQUAL',value:{stringValue:generationId}}}});
  return rows.map((r:any)=>r.data as GenerationAttemptLog).sort((a,b)=>a.attempt_number-b.attempt_number);
 }
};
