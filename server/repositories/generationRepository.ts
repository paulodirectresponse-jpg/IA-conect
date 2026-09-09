import { Generation, GenerationAttemptLog } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

export const generationRepository={
 async getGeneration(id:string):Promise<Generation|null>{
  const doc=await firestoreAdminRest.get(`generations/${encodeURIComponent(id)}`);
  return doc.exists?doc.data as Generation:null;
 },
 async findByClientRequest(userId:string,clientRequestId:string):Promise<Generation|null>{
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
