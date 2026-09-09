import { collection, doc, getDoc, getDocs, limit as limitQuery, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { Generation, GenerationRequestDraft } from '../types/index.js';

function normalizeReferences(draft:GenerationRequestDraft){
 const refs=draft.references||[];
 return refs.map((r,index)=>({asset_id:r.asset_id,slot_type:draft.mode==='IMAGE_TO_VIDEO'?(index===0?'INITIAL':index===1?'END':'GENERAL'):'GENERAL'}));
}
export const generationClient={
 async create(draft:GenerationRequestDraft):Promise<Generation>{return apiRequest<Generation>('/api/generations',{method:'POST',body:JSON.stringify({model_id:draft.model_id,prompt:draft.prompt,negative_prompt:undefined,duration_seconds:draft.settings.duration_seconds,resolution:draft.settings.resolution,aspect_ratio:draft.settings.aspect_ratio,number_of_outputs:draft.settings.number_of_outputs,seed:draft.settings.seed,motion_strength:draft.settings.motion_strength,references:normalizeReferences(draft),client_request_id:draft.request_id})});},
 async get(id:string):Promise<Generation>{
   const user=auth.currentUser; if(!user) throw new Error('Usuário não autenticado.');
   const snap=await getDoc(doc(db,'generations',id));
   if(!snap.exists()) throw new Error('Geração não encontrada.');
   const data=snap.data() as Generation;
   if((data as any).user_id!==user.uid) throw new Error('Acesso negado.');
   return data;
 },
 async list(max=50):Promise<Generation[]>{
   const user=auth.currentUser; if(!user) return [];
   const q=query(collection(db,'generations'),where('user_id','==',user.uid),orderBy('created_at','desc'),limitQuery(Math.min(100,max)));
   const snap=await getDocs(q);
   return snap.docs.map(d=>d.data() as Generation);
 },
 async cancel(id:string):Promise<Generation>{return apiRequest<Generation>(`/api/generations/${id}/cancel`,{method:'POST'});}
};
