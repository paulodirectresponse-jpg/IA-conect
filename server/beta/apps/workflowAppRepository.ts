import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { WorkflowAppRecord } from './workflowAppTypes.js';

const COLLECTION='beta_workflow_apps';
const safe=(value:string)=>encodeURIComponent(value);
const now=()=>new Date().toISOString();
const appId=()=>`wapp_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

async function owned(userId:string){
  const rows=await firestoreAdminRest.runQuery({
    from:[{collectionId:COLLECTION}],
    where:{fieldFilter:{field:{fieldPath:'owner_user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit:200,
  });
  return rows.map((row:any)=>row.data as WorkflowAppRecord);
}

export const workflowAppRepository={
  async list(userId:string){
    return (await owned(userId)).filter(row=>!row.deleted_at).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  },
  async get(id:string,userId:string):Promise<WorkflowAppRecord|null>{
    const doc=await firestoreAdminRest.get(`${COLLECTION}/${safe(id)}`);
    if(!doc.exists)return null;
    const row=doc.data as WorkflowAppRecord;
    return row.owner_user_id===userId&&!row.deleted_at?row:null;
  },
  async create(input:Omit<WorkflowAppRecord,'app_id'|'created_at'|'updated_at'|'published_at'|'deleted_at'>){
    const timestamp=now();
    const row:WorkflowAppRecord={...input,app_id:appId(),created_at:timestamp,updated_at:timestamp,published_at:null,deleted_at:null};
    await firestoreAdminRest.set(`${COLLECTION}/${safe(row.app_id)}`,row);
    return row;
  },
  async save(row:WorkflowAppRecord){
    const next={...row,updated_at:now()};
    await firestoreAdminRest.set(`${COLLECTION}/${safe(row.app_id)}`,next);
    return next;
  },
  async remove(row:WorkflowAppRecord){
    const next={...row,deleted_at:now(),updated_at:now()};
    await firestoreAdminRest.set(`${COLLECTION}/${safe(row.app_id)}`,next);
    return next;
  },
};
