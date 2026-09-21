import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';
import { BetaFlowNodeRun,BetaFlowRun } from './flowRuntimeTypes.js';

const RUNS='beta_flow_runs';
const NODES='beta_flow_node_runs';
const IDEM='beta_flow_run_idempotency';
const safe=(value:string)=>encodeURIComponent(value);
const now=()=>new Date().toISOString();
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const runId=()=>`frun_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
const nodeRunId=(run:string,node:string)=>`frnode_${hash(`${run}:${node}`).slice(0,32)}`;

function idemKey(value:string){
  const key=String(value||'').trim();
  if(key.length<8||key.length>200)throw Object.assign(new Error('Idempotency-Key deve ter entre 8 e 200 caracteres.'),{code:'IDEMPOTENCY_KEY_REQUIRED'});
  return key;
}
export const betaFlowRuntimeRepository={
  makeRunId:runId,
  makeNodeRunId:nodeRunId,
  async createIdempotent(params:{userId:string;flowId:string;idempotencyKey:string;run:BetaFlowRun}):Promise<BetaFlowRun>{
    const key=idemKey(params.idempotencyKey),fingerprint=hash(`${params.userId}:${params.flowId}:${key}`);
    const path=`${IDEM}/${fingerprint}`,existing=await firestoreAdminRest.get(path);
    if(existing.exists){
      const prior=await this.getRun(String(existing.data.run_id||''),params.userId);
      if(prior)return prior;
      throw Object.assign(new Error('Registro idempotente do Flow inconsistente.'),{code:'FLOW_IDEMPOTENCY_INCONSISTENT'});
    }
    const run:BetaFlowRun={...params.run,idempotency_fingerprint:fingerprint};
    try{
      await firestoreAdminRest.commit([
        {update:{name:firestoreAdminRest.docName(`${RUNS}/${safe(run.run_id)}`),fields:firestoreAdminRest.fields(run)},currentDocument:{exists:false}},
        {update:{name:firestoreAdminRest.docName(path),fields:firestoreAdminRest.fields({run_id:run.run_id,user_id:params.userId,flow_id:params.flowId,created_at:now()})},currentDocument:{exists:false}},
      ]);
      return run;
    }catch(error){
      const after=await firestoreAdminRest.get(path);
      if(after.exists){
        const prior=await this.getRun(String(after.data.run_id||''),params.userId);
        if(prior)return prior;
      }
      throw error;
    }
  },
  async getRun(id:string,userId:string):Promise<BetaFlowRun|null>{
    const doc=await firestoreAdminRest.get(`${RUNS}/${safe(id)}`);
    if(!doc.exists)return null;
    const run=doc.data as BetaFlowRun;
    return run.user_id===userId?run:null;
  },
  async saveRun(run:BetaFlowRun):Promise<BetaFlowRun>{
    await firestoreAdminRest.set(`${RUNS}/${safe(run.run_id)}`,run);
    return run;
  },
  async listRuns(userId:string,limit=50):Promise<BetaFlowRun[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:RUNS}],
      where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      limit:Math.min(100,Math.max(1,limit)),
    });
    return rows.map((row:any)=>row.data as BetaFlowRun).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  },
  async getNodeRun(run:string,node:string,userId:string):Promise<BetaFlowNodeRun|null>{
    const doc=await firestoreAdminRest.get(`${NODES}/${safe(nodeRunId(run,node))}`);
    if(!doc.exists)return null;
    const item=doc.data as BetaFlowNodeRun;
    return item.user_id===userId&&item.run_id===run?item:null;
  },
  async saveNodeRun(item:BetaFlowNodeRun):Promise<BetaFlowNodeRun>{
    await firestoreAdminRest.set(`${NODES}/${safe(item.node_run_id)}`,item);
    return item;
  },
  async listUserNodeRuns(userId:string,limit=500):Promise<BetaFlowNodeRun[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:NODES}],
      where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      limit:Math.min(500,Math.max(1,limit)),
    });
    return rows.map((row:any)=>row.data as BetaFlowNodeRun).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  },
  async listNodeRuns(run:string,userId:string):Promise<BetaFlowNodeRun[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:NODES}],
      where:{fieldFilter:{field:{fieldPath:'run_id'},op:'EQUAL',value:{stringValue:run}}},
      limit:150,
    });
    return rows.map((row:any)=>row.data as BetaFlowNodeRun).filter((row:BetaFlowNodeRun)=>row.user_id===userId);
  },
};
