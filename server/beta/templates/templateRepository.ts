import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaTemplateRecord } from './templateTypes.js';

const COLLECTION='beta_flow_templates';
const safe=(v:string)=>encodeURIComponent(v);
const now=()=>new Date().toISOString();
const id=()=>`btpl_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
async function owned(userId:string){
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:COLLECTION}],where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},limit:200});
  return rows.map((row:any)=>row.data as BetaTemplateRecord);
}
export const betaTemplateRepository={
  async list(userId:string){return (await owned(userId)).filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));},
  async get(templateId:string,userId:string){const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(templateId)}`);if(!doc.exists)return null;const row=doc.data as BetaTemplateRecord;return row.owner_user_id===userId&&!row.deleted_at?row:null;},
  async create(input:Omit<BetaTemplateRecord,'template_id'|'created_at'|'updated_at'|'deleted_at'>){const timestamp=now();const row:BetaTemplateRecord={...input,template_id:id(),created_at:timestamp,updated_at:timestamp,deleted_at:null};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.template_id)}`,row);return row;},
  async save(row:BetaTemplateRecord){const next={...row,updated_at:now()};await firestoreAdminRest.set(`${COLLECTION}/${safe(row.template_id)}`,next);return next;},
  async remove(row:BetaTemplateRecord){return this.save({...row,deleted_at:now()});},
};
