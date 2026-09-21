import{assetRepository}from'../../repositories/assetRepository.js';
import crypto from'crypto';
import type{BetaFlowGraph,BetaFlowNode}from'./flowTypes.js';
import type{BetaFlowNodeRun,BetaFlowRun}from'./flowRuntimeTypes.js';
import{betaFlowRuntimeRepository}from'./flowRuntimeRepository.js';

export type FlowExecutionMode='FULL'|'NODE'|'DOWNSTREAM';
export interface FlowExecutionPlan{mode:FlowExecutionMode;target_node_id:string|null;active_node_ids:string[];seed_runs:Map<string,BetaFlowNodeRun>;}

function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function incoming(graph:BetaFlowGraph,id:string){return graph.edges.filter(edge=>edge.to_node_id===id).map(edge=>edge.from_node_id);}
function outgoing(graph:BetaFlowGraph,id:string){return graph.edges.filter(edge=>edge.from_node_id===id).map(edge=>edge.to_node_id);}
function ancestors(graph:BetaFlowGraph,id:string){const out=new Set<string>();const visit=(nodeId:string)=>{for(const prev of incoming(graph,nodeId)){if(out.has(prev))continue;out.add(prev);visit(prev);}};visit(id);return out;}
function descendants(graph:BetaFlowGraph,id:string){const out=new Set<string>([id]);const visit=(nodeId:string)=>{for(const next of outgoing(graph,nodeId)){if(out.has(next))continue;out.add(next);visit(next);}};visit(id);return out;}
function fullActive(graph:BetaFlowGraph){const outputs=graph.nodes.filter(node=>node.kind==='OUTPUT');if(!outputs.length)fail('FLOW_OUTPUT_REQUIRED','Adicione pelo menos um nó de saída antes de executar o workflow completo.');const active=new Set<string>();const visit=(id:string)=>{if(active.has(id))return;active.add(id);for(const prev of incoming(graph,id))visit(prev);};for(const node of outputs)visit(node.node_id);return active;}
function stableNode(node:BetaFlowNode){return{kind:node.kind,media_type:node.media_type,asset_id:node.asset_id,capability_id:node.capability_id,model_id:node.model_id,prompt:node.prompt,controls:node.controls};}
function subgraphSignature(graph:BetaFlowGraph,nodeId:string){const ids=new Set<string>([nodeId,...ancestors(graph,nodeId)]);if(graph.nodes.some(node=>ids.has(node.node_id)&&node.kind==='INPUT'))return null;const nodes=graph.nodes.filter(node=>ids.has(node.node_id)).map(node=>[node.node_id,stableNode(node)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));const edges=graph.edges.filter(edge=>ids.has(edge.from_node_id)&&ids.has(edge.to_node_id)).map(edge=>[edge.from_node_id,edge.to_node_id,edge.media_type]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return crypto.createHash('sha256').update(JSON.stringify({nodes,edges})).digest('hex');}
function latestCandidates(rows:BetaFlowNodeRun[],flowId:string){const map=new Map<string,BetaFlowNodeRun>();for(const row of rows){if(row.flow_id!==flowId||row.status!=='SUCCEEDED'||map.has(row.node_id))continue;map.set(row.node_id,row);}return map;}

export async function buildFlowExecutionPlan(userId:string,flow:{flow_id:string;graph:BetaFlowGraph},input:any):Promise<FlowExecutionPlan>{
 const mode=String(input?.execution?.mode||'FULL').toUpperCase() as FlowExecutionMode;
 if(!['FULL','NODE','DOWNSTREAM'].includes(mode))fail('FLOW_EXECUTION_MODE_INVALID','Modo de execução inválido.');
 if(mode==='FULL')return{mode,target_node_id:null,active_node_ids:Array.from(fullActive(flow.graph)),seed_runs:new Map()};
 const target=String(input?.execution?.target_node_id||'').trim(),targetNode=flow.graph.nodes.find(node=>node.node_id===target);
 if(!targetNode)fail('FLOW_EXECUTION_TARGET_INVALID','Selecione um node válido para executar.');
 if(targetNode.kind==='ASSET'||targetNode.kind==='INPUT')fail('FLOW_EXECUTION_TARGET_INVALID','Nodes de entrada não precisam ser executados.');
 const desired=mode==='NODE'?new Set([target]):descendants(flow.graph,target);
 const active=new Set<string>(desired),seedRuns=new Map<string,BetaFlowNodeRun>();
 const historical=latestCandidates(await betaFlowRuntimeRepository.listUserNodeRuns(userId,500),flow.flow_id);
 const runCache=new Map<string,BetaFlowRun|null>();
 const canReuse=async(nodeId:string)=>{const candidate=historical.get(nodeId);if(!candidate)return null;let prior=runCache.get(candidate.run_id);if(prior===undefined){prior=await betaFlowRuntimeRepository.getRun(candidate.run_id,userId);runCache.set(candidate.run_id,prior);}if(!prior)return null;const currentSig=subgraphSignature(flow.graph,nodeId),priorSig=subgraphSignature(prior.graph,nodeId);if(!currentSig||!priorSig||currentSig!==priorSig)return null;for(const assetId of candidate.output_asset_ids||[])if(!await assetRepository.getAsset(assetId,userId))return null;return candidate;};
 const requireUpstream=async(nodeId:string):Promise<void>=>{for(const prev of incoming(flow.graph,nodeId)){if(active.has(prev))continue;const reusable=await canReuse(prev);active.add(prev);if(reusable){seedRuns.set(prev,reusable);continue;}await requireUpstream(prev);}};
 for(const id of Array.from(desired))await requireUpstream(id);
 return{mode,target_node_id:target,active_node_ids:Array.from(active),seed_runs:seedRuns};
}