import type{BetaFlowGraph}from'./flowTypes.js';
import type{BetaFlowNodeRun}from'./flowRuntimeTypes.js';

export function activeTerminalNodeIds(graph:BetaFlowGraph,activeIds:Iterable<string>){
 const active=new Set(activeIds);
 return graph.nodes.filter(node=>active.has(node.node_id)&&!graph.edges.some(edge=>edge.from_node_id===node.node_id&&active.has(edge.to_node_id))).map(node=>node.node_id);
}

export function activeExecutionSucceeded(activeIds:Iterable<string>,runs:Map<string,BetaFlowNodeRun>){
 const ids=Array.from(activeIds);
 return ids.length>0&&ids.every(id=>runs.get(id)?.status==='SUCCEEDED');
}
