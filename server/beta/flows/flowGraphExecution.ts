import type{BetaFlowGraph,BetaFlowNode}from'./flowTypes.js';

function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}

export function flowIncomingIds(graph:BetaFlowGraph,id:string){
 return graph.edges.filter(edge=>edge.to_node_id===id).map(edge=>edge.from_node_id);
}

export function flowOutgoingIds(graph:BetaFlowGraph,id:string){
 return graph.edges.filter(edge=>edge.from_node_id===id).map(edge=>edge.to_node_id);
}

export function flowAncestors(graph:BetaFlowGraph,id:string){
 const out=new Set<string>();
 const visit=(nodeId:string)=>{for(const prev of flowIncomingIds(graph,nodeId)){if(out.has(prev))continue;out.add(prev);visit(prev);}};
 visit(id);
 return out;
}

export function flowDescendants(graph:BetaFlowGraph,id:string){
 const out=new Set<string>([id]);
 const visit=(nodeId:string)=>{for(const next of flowOutgoingIds(graph,nodeId)){if(out.has(next))continue;out.add(next);visit(next);}};
 visit(id);
 return out;
}

export function flowTopologicalOrder(graph:BetaFlowGraph,activeIds:Iterable<string>){
 const active=new Set(activeIds),nodes=graph.nodes.filter(node=>active.has(node.node_id));
 const indegree=new Map(nodes.map(node=>[node.node_id,0]));
 const outgoing=new Map(nodes.map(node=>[node.node_id,[] as string[]]));
 for(const edge of graph.edges){
  if(!active.has(edge.from_node_id)||!active.has(edge.to_node_id))continue;
  indegree.set(edge.to_node_id,(indegree.get(edge.to_node_id)||0)+1);
  outgoing.get(edge.from_node_id)?.push(edge.to_node_id);
 }
 const index=new Map(graph.nodes.map((node,i)=>[node.node_id,i]));
 const queue=nodes.filter(node=>(indegree.get(node.node_id)||0)===0).sort((a,b)=>(index.get(a.node_id)||0)-(index.get(b.node_id)||0)).map(node=>node.node_id);
 const result:BetaFlowNode[]=[];
 while(queue.length){
  const id=queue.shift()!,node=nodes.find(item=>item.node_id===id);if(node)result.push(node);
  for(const next of outgoing.get(id)||[]){
   const value=(indegree.get(next)||0)-1;indegree.set(next,value);
   if(value===0){queue.push(next);queue.sort((a,b)=>(index.get(a)||0)-(index.get(b)||0));}
  }
 }
 if(result.length!==nodes.length)fail('FLOW_CYCLE','O fluxo contém um ciclo e não pode ser executado.');
 return result;
}

export function flowExecutionLayers(graph:BetaFlowGraph,activeIds:Iterable<string>){
 const active=new Set(activeIds),order=flowTopologicalOrder(graph,active),depth=new Map<string,number>();
 for(const node of order){
  const parents=flowIncomingIds(graph,node.node_id).filter(id=>active.has(id));
  depth.set(node.node_id,parents.length?Math.max(...parents.map(id=>depth.get(id)||0))+1:0);
 }
 const layers:string[][]=[];
 for(const node of order){
  const level=depth.get(node.node_id)||0;
  (layers[level]||(layers[level]=[])).push(node.node_id);
 }
 return layers;
}

export function flowTerminalNodeIds(graph:BetaFlowGraph,activeIds:Iterable<string>){
 const active=new Set(activeIds);
 return graph.nodes.filter(node=>active.has(node.node_id)&&!graph.edges.some(edge=>edge.from_node_id===node.node_id&&active.has(edge.to_node_id))).map(node=>node.node_id);
}

export function fullGraphActiveIds(graph:BetaFlowGraph){
 if(!graph.nodes.length)fail('FLOW_GRAPH_EMPTY','Adicione pelo menos um node antes de executar o Space.');
 return new Set(graph.nodes.map(node=>node.node_id));
}
