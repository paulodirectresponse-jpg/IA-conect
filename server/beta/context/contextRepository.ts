import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaContextPackRecord } from './contextTypes.js';
const COLLECTION='beta_context_packs',safe=(v:string)=>encodeURIComponent(v),now=()=>new Date().toISOString();
const id=()=>`ctx_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
async function owned(userId:string){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:COLLECTION}],where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},limit:100});return rows.map((row:any)=>row.data as BetaContextPackRecord);}
export const betaContextRepository={
 async list(userId:string){return (await owned(userId)).filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));},
 async get(contextId:string,userId:string){const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(contextId)}`);if(!doc.exists)return null;const row=doc.data as BetaContextPackRecord;return row.owner_user_id===userId&&!row.deleted_at?row:null;},
 async create(input:Omit<BetaContextPackRecord,'context_id'|'revision'|'created_at'|'updated_at'|'deleted_at'>){const timestamp=now();const row:BetaContextPackRecord={...input,context_id:id(),revision:1,created_at:timestamp,updated_at:timestamp,deleted_at:null};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.context_id)}`,row);return row;},
 async save(row:BetaContextPackRecord){const next={...row,revision:row.revision+1,updated_at:now()};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.context_id)}`,next);return next;},
 async remove(row:BetaContextPackRecord){const next={...row,deleted_at:now(),updated_at:now()};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.context_id)}`,next);return next;},
};
