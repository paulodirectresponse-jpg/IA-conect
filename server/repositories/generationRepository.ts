import { Generation, GenerationAttemptLog } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';
function db(){const d=getAdminDb();if(!d)throw new Error('Firestore Admin indisponível.');return d;}
export const generationRepository={
 async getGeneration(id:string):Promise<Generation|null>{const doc=await db().collection('generations').doc(id).get();return doc.exists?doc.data() as Generation:null;},
 async findByClientRequest(userId:string,clientRequestId:string):Promise<Generation|null>{const snap=await db().collection('generations').where('user_id','==',userId).where('client_request_id','==',clientRequestId).limit(1).get();return snap.empty?null:snap.docs[0].data() as Generation;},
 async saveGeneration(g:Generation):Promise<Generation>{await db().collection('generations').doc(g.generation_id).set(g,{merge:true});return g;},
 async listUserGenerations(userId:string,limit=50):Promise<Generation[]>{const snap=await db().collection('generations').where('user_id','==',userId).orderBy('created_at','desc').limit(limit).get();return snap.docs.map(d=>d.data() as Generation);},
 async listAllGenerations(limit=50):Promise<Generation[]>{const snap=await db().collection('generations').orderBy('created_at','desc').limit(limit).get();return snap.docs.map(d=>d.data() as Generation);},
 async recordAttemptLog(a:GenerationAttemptLog){await db().collection('generation_attempts').doc(a.attempt_id).set(a,{merge:true});return a;},
 async getAttemptLogs(generationId:string):Promise<GenerationAttemptLog[]>{const snap=await db().collection('generation_attempts').where('generation_id','==',generationId).get();return snap.docs.map(d=>d.data() as GenerationAttemptLog).sort((a,b)=>a.attempt_number-b.attempt_number);}
};
