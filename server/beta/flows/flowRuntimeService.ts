import { assetRepository } from '../../repositories/assetRepository.js';
import { catalogRepository } from '../../repositories/catalogRepository.js';
import { betaJobOrchestrator } from '../jobs/jobOrchestrator.js';
import { BetaJob } from '../jobs/jobTypes.js';
import { CapabilityMediaType,getCapabilityDefinition } from '../capabilityRegistry.js';
import { betaFlowService } from './flowService.js';
import { BetaFlowEdge,BetaFlowGraph,BetaFlowNode } from './flowTypes.js';
import { betaFlowRuntimeRepository } from './flowRuntimeRepository.js';
import { BetaFlowNodeRun,BetaFlowRun,BetaFlowValue } from './flowRuntimeTypes.js';

const now=()=>new Date().toISOString();
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function terminal(status:string){return ['SUCCEEDED','FAILED','CANCELLED'].includes(status);}
function assetMediaMatches(expected:CapabilityMediaType,actual:string){return expected==='MASK'?actual==='IMAGE':expected===actual;}
function runtimeFlags(){return Promise.all([
  catalogRepository.getFeatureFlag('beta.flows'),
  catalogRepository.getFeatureFlag('beta.flow_runtime'),
  catalogRepository.getFeatureFlag('beta.flow_runtime.execution'),
]);}
async function assertRuntimeEnabled(){
  const [flows,runtime,execution]=await runtimeFlags();
  if(!flows?.is_enabled)fail('FLOWS_DISABLED','Fluxos estão temporariamente indisponíveis.');
  if(!runtime?.is_enabled)fail('FLOW_RUNTIME_DISABLED','O runtime de Fluxos está temporariamente indisponível.');
  if(!execution?.is_enabled)fail('FLOW_RUNTIME_EXECUTION_DISABLED','Novas execuções de Fluxos estão temporariamente pausadas.');
}
function activeNodeIds(graph:BetaFlowGraph){
  const outputs=graph.nodes.filter(node=>node.kind==='OUTPUT');
  if(!outputs.length)fail('FLOW_OUTPUT_REQUIRED','Adicione pelo menos um nó de saída antes de executar.');
  const incoming=new Map<string,BetaFlowEdge[]>();
  for(const edge of graph.edges){const list=incoming.get(edge.to_node_id)||[];list.push(edge);incoming.set(edge.to_node_id,list);}
  const active=new Set<string>();
  const visit=(id:string)=>{if(active.has(id))return;active.add(id);for(const edge of incoming.get(id)||[])visit(edge.from_node_id);};
  for(const output of outputs)visit(output.node_id);
  return active;
}
function topological(graph:BetaFlowGraph,active:Set<string>){
  const nodes=graph.nodes.filter(node=>active.has(node.node_id));
  const indegree=new Map(nodes.map(node=>[node.node_id,0]));
  const outgoing=new Map(nodes.map(node=>[node.node_id,[] as string[]]));
  for(const edge of graph.edges){
    if(!active.has(edge.from_node_id)||!active.has(edge.to_node_id))continue;
    indegree.set(edge.to_node_id,(indegree.get(edge.to_node_id)||0)+1);
    outgoing.get(edge.from_node_id)?.push(edge.to_node_id);
  }
  const queue=nodes.filter(node=>(indegree.get(node.node_id)||0)===0).map(node=>node.node_id);
  const result:BetaFlowNode[]=[];
  while(queue.length){
    const id=queue.shift()!,node=nodes.find(item=>item.node_id===id);if(node)result.push(node);
    for(const next of outgoing.get(id)||[]){const value=(indegree.get(next)||0)-1;indegree.set(next,value);if(value===0)queue.push(next);}
  }
  if(result.length!==nodes.length)fail('FLOW_CYCLE','O fluxo contém um ciclo e não pode ser executado.');
  return result;
}
async function normalizeInput(userId:string,node:BetaFlowNode,raw:any):Promise<BetaFlowValue>{
  const type=node.media_type;if(!type)fail('FLOW_INPUT_INVALID','Entrada sem tipo definido.');
  if(type==='TEXT'){
    const text=String(raw?.text??raw??'').trim();
    if(!text)fail('FLOW_INPUT_REQUIRED',`Preencha a entrada "${node.label}".`);
    return{media_type:type,text};
  }
  if(type==='STRUCTURED_DATA'){
    const structured=raw?.structured??raw;
    if(!structured||typeof structured!=='object'||Array.isArray(structured))fail('FLOW_INPUT_INVALID',`A entrada "${node.label}" exige dados estruturados.`);
    return{media_type:type,structured};
  }
  const ids=(Array.isArray(raw?.asset_ids)?raw.asset_ids:raw?.asset_id?[raw.asset_id]:[]).map(String).filter(Boolean).slice(0,16);
  if(!ids.length)fail('FLOW_INPUT_REQUIRED',`Selecione um asset para "${node.label}".`);
  for(const id of ids){
    const asset=await assetRepository.getAsset(id,userId);
    if(!asset||asset.status!=='READY')fail('ASSET_NOT_FOUND','Um asset de entrada não está disponível.');
    if(!assetMediaMatches(type,asset.type))fail('FLOW_INPUT_TYPE_MISMATCH',`O asset conectado a "${node.label}" possui tipo incompatível.`);
  }
  return{media_type:type,asset_ids:ids};
}
async function normalizeInputs(userId:string,graph:BetaFlowGraph,active:Set<string>,raw:any){
  const result:Record<string,BetaFlowValue>={};
  for(const node of graph.nodes.filter(item=>active.has(item.node_id)&&item.kind==='INPUT')){
    result[node.node_id]=await normalizeInput(userId,node,raw?.[node.node_id]);
  }
  return result;
}
function emptyNodeRun(run:BetaFlowRun,node:BetaFlowNode):BetaFlowNodeRun{
  const timestamp=now();
  return{
    node_run_id:betaFlowRuntimeRepository.makeNodeRunId(run.run_id,node.node_id),run_id:run.run_id,flow_id:run.flow_id,user_id:run.user_id,node_id:node.node_id,
    status:'WAITING',job_id:null,retry_count:0,authorized_credit_price:0,inputs:[],outputs:[],input_asset_ids:[],output_asset_ids:[],
    error_code:null,error_message:null,created_at:timestamp,updated_at:timestamp,started_at:null,completed_at:null,
  };
}
function incomingEdges(graph:BetaFlowGraph,nodeId:string,active:Set<string>){return graph.edges.filter(edge=>edge.to_node_id===nodeId&&active.has(edge.from_node_id));}
function valuesForEdges(edges:BetaFlowEdge[],runs:Map<string,BetaFlowNodeRun>){
  const values:BetaFlowValue[]=[];
  for(const edge of edges){
    const source=runs.get(edge.from_node_id);
    if(!source)continue;
    for(const value of source.outputs){
      if(value.media_type===edge.media_type)values.push({...value,source_node_id:edge.from_node_id});
    }
  }
  return values;
}
function inputAssetIds(values:BetaFlowValue[]){return Array.from(new Set(values.flatMap(value=>value.asset_ids||[])));}
function jobControls(node:BetaFlowNode){
  const source=node.controls||{},out:any={};
  for(const [key,value] of Object.entries(source)){
    if(key==='duration')out.duration_seconds=value;
    else if(['reference_image','first_frame','last_frame','guidance'].includes(key))continue;
    else out[key]=value;
  }
  return out;
}
function referencesFor(node:BetaFlowNode,values:BetaFlowValue[]){
  const media=values.flatMap(value=>(value.asset_ids||[]).map(asset_id=>({asset_id,media_type:value.media_type})));
  const cap=String(node.capability_id||'');
  if(cap==='last-frame'){
    const images=media.filter(item=>item.media_type==='IMAGE');
    return images.slice(0,2).map((item,index)=>({asset_id:item.asset_id,slot_type:index===0?'INITIAL':'END',role:index===0?'SOURCE':'REFERENCE'}));
  }
  return media.map((item,index)=>{
    if(item.media_type==='MASK')return{asset_id:item.asset_id,slot_type:'GENERAL',role:'MASK'};
    const initial=['image-to-video','first-frame'].includes(cap)&&item.media_type==='IMAGE';
    return{asset_id:item.asset_id,slot_type:initial?'INITIAL':'GENERAL',role:index===0?'SOURCE':'REFERENCE'};
  });
}
function jobRequest(node:BetaFlowNode,values:BetaFlowValue[]){
  if(node.kind!=='TOOL'||!node.capability_id||!node.model_id)fail('FLOW_NODE_INVALID','Nó de ferramenta incompleto.');
  const incomingText=values.filter(value=>value.media_type==='TEXT').map(value=>String(value.text||'').trim()).filter(Boolean);
  const prompt=[...incomingText,String(node.prompt||'').trim()].filter(Boolean).join('\n\n');
  return{capability_id:node.capability_id,model_id:node.model_id,prompt,references:referencesFor(node,values),controls:jobControls(node)};
}
async function valuesFromJob(userId:string,node:BetaFlowNode,job:BetaJob):Promise<BetaFlowValue[]>{
  const values:BetaFlowValue[]=[];
  for(const assetId of job.result_asset_ids||[]){
    const asset=await assetRepository.getAsset(assetId,userId);
    if(asset)values.push({media_type:asset.type as CapabilityMediaType,asset_ids:[asset.asset_id],source_node_id:node.node_id});
  }
  const def=node.capability_id?getCapabilityDefinition(node.capability_id):null;
  if(job.result_text&&def?.outputs.includes('TEXT'))values.push({media_type:'TEXT',text:job.result_text,source_node_id:node.node_id});
  if(job.result_structured&&def?.outputs.includes('STRUCTURED_DATA'))values.push({media_type:'STRUCTURED_DATA',structured:job.result_structured,source_node_id:node.node_id});
  if(!values.length&&job.status==='SUCCEEDED')fail('FLOW_NODE_OUTPUT_MISSING',`O nó "${node.label}" concluiu sem uma saída utilizável.`);
  return values;
}
function sumAuthorized(runs:Map<string,BetaFlowNodeRun>){return Array.from(runs.values()).reduce((sum,item)=>sum+Math.max(0,Number(item.authorized_credit_price||0)),0);}
async function publicRun(run:BetaFlowRun){
  const nodeRuns=await betaFlowRuntimeRepository.listNodeRuns(run.run_id,run.user_id);
  const {idempotency_fingerprint,...safe}=run;
  return{...safe,node_runs:nodeRuns.sort((a,b)=>a.created_at.localeCompare(b.created_at))};
}
async function saveNodeFailure(run:BetaFlowRun,node:BetaFlowNode,current:BetaFlowNodeRun|undefined,error:any){
  const timestamp=now(),item=current||emptyNodeRun(run,node);
  return betaFlowRuntimeRepository.saveNodeRun({...item,status:'FAILED',error_code:String(error?.code||'FLOW_NODE_FAILED'),error_message:String(error?.message||'Falha ao executar nó.'),updated_at:timestamp,completed_at:timestamp});
}
async function finishRun(run:BetaFlowRun,runs:Map<string,BetaFlowNodeRun>,status:BetaFlowRun['status'],patch:Partial<BetaFlowRun>={}){
  const timestamp=now();
  return betaFlowRuntimeRepository.saveRun({...run,...patch,status,authorized_credits_total:sumAuthorized(runs),updated_at:timestamp,
    completed_at:status==='SUCCEEDED'?timestamp:run.completed_at,failed_at:status==='FAILED'?timestamp:run.failed_at,cancelled_at:status==='CANCELLED'?timestamp:run.cancelled_at});
}

export const betaFlowRuntimeService={
  async start(userId:string,flowId:string,input:any,idempotencyKey:string,reqHost?:string,idToken?:string){
    await assertRuntimeEnabled();
    const flow=await betaFlowService.get(userId,flowId);
    const active=activeNodeIds(flow.graph),inputs=await normalizeInputs(userId,flow.graph,active,input?.inputs||{});
    const timestamp=now(),run:BetaFlowRun={
      run_id:betaFlowRuntimeRepository.makeRunId(),flow_id:flow.flow_id,flow_revision:flow.revision,user_id:userId,status:'RUNNING',
      graph:flow.graph,active_node_ids:Array.from(active),inputs,outputs:{},authorized_credits_total:0,error_code:null,error_message:null,idempotency_fingerprint:'',
      created_at:timestamp,updated_at:timestamp,started_at:timestamp,completed_at:null,failed_at:null,cancelled_at:null,
    };
    const created=await betaFlowRuntimeRepository.createIdempotent({userId,flowId,idempotencyKey,run});
    return this.advance(userId,created.run_id,reqHost,idToken);
  },

  async advance(userId:string,runId:string,reqHost?:string,idToken?:string){
    await assertRuntimeEnabled();
    let run=await betaFlowRuntimeRepository.getRun(runId,userId);
    if(!run)fail('FLOW_RUN_NOT_FOUND','Execução de fluxo não encontrada.');
    if(terminal(run.status))return publicRun(run);
    const active=new Set(run.active_node_ids),order=topological(run.graph,active);
    const existing=await betaFlowRuntimeRepository.listNodeRuns(run.run_id,userId);
    const runs=new Map(existing.map(item=>[item.node_id,item]));

    for(const node of order){
      let nodeRun=runs.get(node.node_id);
      if(nodeRun?.status==='SUCCEEDED')continue;
      if(nodeRun?.status==='FAILED'){
        run=await finishRun(run,runs,'FAILED',{error_code:nodeRun.error_code||'FLOW_NODE_FAILED',error_message:nodeRun.error_message||'Um nó do fluxo falhou.'});
        return publicRun(run);
      }

      if(node.kind==='INPUT'){
        if(!nodeRun){
          const value=run.inputs[node.node_id];if(!value)fail('FLOW_INPUT_REQUIRED',`Entrada ausente: ${node.label}.`);
          const timestamp=now();nodeRun={...emptyNodeRun(run,node),status:'SUCCEEDED',outputs:[{...value,source_node_id:node.node_id}],output_asset_ids:value.asset_ids||[],updated_at:timestamp,started_at:timestamp,completed_at:timestamp};
          await betaFlowRuntimeRepository.saveNodeRun(nodeRun);runs.set(node.node_id,nodeRun);
        }
        continue;
      }

      if(node.kind==='ASSET'){
        if(!nodeRun){
          const asset=node.asset_id?await assetRepository.getAsset(node.asset_id,userId):null;
          if(!asset||asset.status!=='READY')fail('ASSET_NOT_FOUND',`Asset indisponível no nó "${node.label}".`);
          const value:BetaFlowValue={media_type:asset.type as CapabilityMediaType,asset_ids:[asset.asset_id],source_node_id:node.node_id};
          const timestamp=now();nodeRun={...emptyNodeRun(run,node),status:'SUCCEEDED',outputs:[value],output_asset_ids:[asset.asset_id],updated_at:timestamp,started_at:timestamp,completed_at:timestamp};
          await betaFlowRuntimeRepository.saveNodeRun(nodeRun);runs.set(node.node_id,nodeRun);
        }
        continue;
      }

      const incoming=incomingEdges(run.graph,node.node_id,active);
      if(incoming.some(edge=>runs.get(edge.from_node_id)?.status!=='SUCCEEDED'))continue;
      const values=valuesForEdges(incoming,runs);

      if(node.kind==='OUTPUT'){
        const accepted=values.filter(value=>value.media_type===node.media_type);
        if(!accepted.length)fail('FLOW_NODE_OUTPUT_MISSING',`A saída "${node.label}" não recebeu dados.`);
        const timestamp=now();nodeRun={...(nodeRun||emptyNodeRun(run,node)),status:'SUCCEEDED',inputs:values,outputs:accepted,input_asset_ids:inputAssetIds(values),output_asset_ids:inputAssetIds(accepted),updated_at:timestamp,started_at:nodeRun?.started_at||timestamp,completed_at:timestamp,error_code:null,error_message:null};
        await betaFlowRuntimeRepository.saveNodeRun(nodeRun);runs.set(node.node_id,nodeRun);
        continue;
      }

      if(node.kind==='TOOL'){
        try{
          if(nodeRun?.job_id){
            const job=await betaJobOrchestrator.get(userId,nodeRun.job_id,true);
            if(job.status==='RUNNING'||job.status==='QUEUED'){
              const next={...nodeRun,status:'RUNNING' as const,updated_at:now()};await betaFlowRuntimeRepository.saveNodeRun(next);runs.set(node.node_id,next);continue;
            }
            if(job.status==='FAILED'||job.status==='CANCELLED'){
              const failed=await saveNodeFailure(run,node,nodeRun,{code:job.error_code||'FLOW_NODE_FAILED',message:job.error_message||'O job do nó falhou.'});runs.set(node.node_id,failed);
              run=await finishRun(run,runs,'FAILED',{error_code:failed.error_code,error_message:failed.error_message});return publicRun(run);
            }
            if(job.status==='SUCCEEDED'){
              const output=await valuesFromJob(userId,node,job),timestamp=now();
              const done={...nodeRun,status:'SUCCEEDED' as const,outputs:output,output_asset_ids:inputAssetIds(output),updated_at:timestamp,completed_at:timestamp,error_code:null,error_message:null};
              await betaFlowRuntimeRepository.saveNodeRun(done);runs.set(node.node_id,done);continue;
            }
          }

          const timestamp=now();
          nodeRun=nodeRun||{...emptyNodeRun(run,node),inputs:values,input_asset_ids:inputAssetIds(values),started_at:timestamp,updated_at:timestamp};
          const attemptIndex=Math.max(0,Number(nodeRun?.retry_count||0));
          const createKey=`flow:${run.run_id}:node:${node.node_id}:attempt:${attemptIndex}:create`;
          const job=await betaJobOrchestrator.create(userId,jobRequest(node,values),createKey);
          nodeRun={...nodeRun,job_id:job.job_id,status:'RUNNING',inputs:values,input_asset_ids:inputAssetIds(values),started_at:nodeRun.started_at||timestamp,updated_at:now(),error_code:null,error_message:null};
          await betaFlowRuntimeRepository.saveNodeRun(nodeRun);runs.set(node.node_id,nodeRun);

          const quoted=await betaJobOrchestrator.quote(userId,job.job_id,`flow:${run.run_id}:node:${node.node_id}:attempt:${attemptIndex}:quote`);
          nodeRun={...nodeRun,authorized_credit_price:Number(quoted.quote?.credit_price||0),updated_at:now()};
          await betaFlowRuntimeRepository.saveNodeRun(nodeRun);runs.set(node.node_id,nodeRun);

          const queued=await betaJobOrchestrator.queue(userId,job.job_id,`flow:${run.run_id}:node:${node.node_id}:attempt:${attemptIndex}:queue`,reqHost,idToken);
          if(queued.status==='SUCCEEDED'){
            const output=await valuesFromJob(userId,node,queued),done={...nodeRun,status:'SUCCEEDED' as const,outputs:output,output_asset_ids:inputAssetIds(output),updated_at:now(),completed_at:now()};
            await betaFlowRuntimeRepository.saveNodeRun(done);runs.set(node.node_id,done);
          }else if(queued.status==='FAILED'||queued.status==='CANCELLED'){
            const failed=await saveNodeFailure(run,node,nodeRun,{code:queued.error_code||'FLOW_NODE_FAILED',message:queued.error_message||'O job do nó falhou.'});runs.set(node.node_id,failed);
            run=await finishRun(run,runs,'FAILED',{error_code:failed.error_code,error_message:failed.error_message});return publicRun(run);
          }else{
            const running={...nodeRun,status:'RUNNING' as const,updated_at:now()};await betaFlowRuntimeRepository.saveNodeRun(running);runs.set(node.node_id,running);
          }
        }catch(error:any){
          const failed=await saveNodeFailure(run,node,nodeRun,error);runs.set(node.node_id,failed);
          run=await finishRun(run,runs,'FAILED',{error_code:failed.error_code,error_message:failed.error_message});
          return publicRun(run);
        }
      }
    }

    const outputNodes=order.filter(node=>node.kind==='OUTPUT');
    if(outputNodes.every(node=>runs.get(node.node_id)?.status==='SUCCEEDED')){
      const outputs:Record<string,BetaFlowValue[]>={};
      for(const node of outputNodes)outputs[node.node_id]=runs.get(node.node_id)?.outputs||[];
      run=await finishRun(run,runs,'SUCCEEDED',{outputs,error_code:null,error_message:null});
    }else{
      run=await betaFlowRuntimeRepository.saveRun({...run,status:'RUNNING',authorized_credits_total:sumAuthorized(runs),updated_at:now(),error_code:null,error_message:null});
    }
    return publicRun(run);
  },

  async retry(userId:string,runId:string,reqHost?:string,idToken?:string){
    await assertRuntimeEnabled();
    let run=await betaFlowRuntimeRepository.getRun(runId,userId);
    if(!run)fail('FLOW_RUN_NOT_FOUND','Execução de fluxo não encontrada.');
    if(run.status!=='FAILED')fail('FLOW_RUN_RETRY_UNAVAILABLE','Apenas execuções falhas podem ser retomadas.');
    const nodeRuns=await betaFlowRuntimeRepository.listNodeRuns(runId,userId),failed=nodeRuns.filter(item=>item.status==='FAILED');
    if(!failed.length)fail('FLOW_RUN_RETRY_UNAVAILABLE','Nenhum nó falho foi encontrado.');
    for(const item of failed){
      if(item.retry_count>=3)fail('FLOW_NODE_RETRY_LIMIT','O limite de tentativas deste nó foi atingido.');
      const next={...item,status:'WAITING' as const,job_id:null,retry_count:item.retry_count+1,authorized_credit_price:0,outputs:[],output_asset_ids:[],error_code:null,error_message:null,completed_at:null,updated_at:now()};
      await betaFlowRuntimeRepository.saveNodeRun(next);
    }
    run=await betaFlowRuntimeRepository.saveRun({...run,status:'RUNNING',failed_at:null,error_code:null,error_message:null,updated_at:now()});
    return this.advance(userId,runId,reqHost,idToken);
  },

  async cancel(userId:string,runId:string){
    const run=await betaFlowRuntimeRepository.getRun(runId,userId);
    if(!run)fail('FLOW_RUN_NOT_FOUND','Execução de fluxo não encontrada.');
    if(terminal(run.status))return publicRun(run);
    const nodeRuns=await betaFlowRuntimeRepository.listNodeRuns(runId,userId),map=new Map(nodeRuns.map(item=>[item.node_id,item]));
    for(const item of nodeRuns.filter(row=>row.status==='RUNNING'&&row.job_id)){
      await betaJobOrchestrator.cancel(userId,item.job_id!,`flow:${runId}:node:${item.node_id}:cancel`).catch(()=>{});
      const cancelled={...item,status:'CANCELLED' as const,updated_at:now(),completed_at:now()};await betaFlowRuntimeRepository.saveNodeRun(cancelled);map.set(item.node_id,cancelled);
    }
    const cancelled=await finishRun(run,map,'CANCELLED',{error_code:null,error_message:null});
    return publicRun(cancelled);
  },

  async getPublic(userId:string,runId:string){
    const run=await betaFlowRuntimeRepository.getRun(runId,userId);
    if(!run)fail('FLOW_RUN_NOT_FOUND','Execução de fluxo não encontrada.');
    return publicRun(run);
  },
  async listPublic(userId:string,limit=30){
    const runs=await betaFlowRuntimeRepository.listRuns(userId,limit);
    return Promise.all(runs.map(publicRun));
  },
  async listFlowPublic(userId:string,flowId:string,limit=50){
    const runs=await betaFlowRuntimeRepository.listRuns(userId,100);
    return Promise.all(runs.filter(run=>run.flow_id===flowId).slice(0,Math.min(100,Math.max(1,limit))).map(publicRun));
  },
};
