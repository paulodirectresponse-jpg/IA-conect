import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaFlowRecord,BetaFlowVersionRecord } from './flowTypes.js';

const safe=(v:string)=>encodeURIComponent(v);
const now=()=>new Date().toISOString();
const id=()=>`flow_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
async function owned(userId:string){
  const rows=await firestoreAdminRest.runQuery({
    from:[{collectionId:'beta_flows'}],
    where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit:200,
  });
  return rows.map((row:any)=>row.data as BetaFlowRecord);
}
export const betaFlowRepository={
  async list(userId:string){
    return (await owned(userId)).filter(row=>!row.deleted_at&&!row.system_kind).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  },
  async get(flowId:string,userId:string):Promise<BetaFlowRecord|null>{
    const doc=await firestoreAdminRest.get(`beta_flows/${safe(flowId)}`);
    if(!doc.exists)return null;
    const row=doc.data as BetaFlowRecord;
    return row.user_id===userId&&!row.deleted_at?row:null;
  },
  async create(userId:string,input:Omit<BetaFlowRecord,'flow_id'|'user_id'|'revision'|'created_at'|'updated_at'|'deleted_at'>){
    const timestamp=now();
    const row:BetaFlowRecord={...input,flow_id:id(),user_id:userId,revision:1,created_at:timestamp,updated_at:timestamp,deleted_at:null};
    const version:BetaFlowVersionRecord={version_id:`${row.flow_id}_r1`,flow_id:row.flow_id,user_id:userId,revision:1,graph:row.graph,name:row.name,description:row.description,project_id:row.project_id,created_at:timestamp};
    await firestoreAdminRest.commit([
      {update:{name:firestoreAdminRest.docName(`beta_flows/${safe(row.flow_id)}`),fields:firestoreAdminRest.fields(row)},currentDocument:{exists:false}},
      {update:{name:firestoreAdminRest.docName(`beta_flow_versions/${safe(version.version_id)}`),fields:firestoreAdminRest.fields(version)},currentDocument:{exists:false}},
    ]);
    return row;
  },
  async update(current:BetaFlowRecord,next:Pick<BetaFlowRecord,'name'|'description'|'project_id'|'graph'>){
    const timestamp=now(),revision=current.revision+1;
    const row:BetaFlowRecord={...current,...next,revision,updated_at:timestamp};
    const version:BetaFlowVersionRecord={version_id:`${row.flow_id}_r${revision}`,flow_id:row.flow_id,user_id:row.user_id,revision,graph:row.graph,name:row.name,description:row.description,project_id:row.project_id,created_at:timestamp};
    await firestoreAdminRest.commit([
      {update:{name:firestoreAdminRest.docName(`beta_flows/${safe(row.flow_id)}`),fields:firestoreAdminRest.fields(row)}},
      {update:{name:firestoreAdminRest.docName(`beta_flow_versions/${safe(version.version_id)}`),fields:firestoreAdminRest.fields(version)},currentDocument:{exists:false}},
    ]);
    return row;
  },
  async remove(current:BetaFlowRecord){
    const next={...current,deleted_at:now(),updated_at:now()};
    await firestoreAdminRest.set(`beta_flows/${safe(current.flow_id)}`,next);
    return next;
  },
};
