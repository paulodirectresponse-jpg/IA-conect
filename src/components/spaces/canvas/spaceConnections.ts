import type{BetaCapabilityMediaType,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowEdge,FlowNode}from'../../../beta/flowClient.js';
import{spaceNodeInputTypes,spaceNodeOutputTypes}from'../model/spaceNodeModel.js';

export type SpaceDirectConnectionStatus='COMPATIBLE'|'DUPLICATE'|'CYCLE'|'INCOMPATIBLE'|'INVALID';
export interface SpaceDirectConnectionResult{
 status:SpaceDirectConnectionStatus;
 mediaType:BetaCapabilityMediaType|null;
 message:string;
}

function createsCycle(nodes:FlowNode[],edges:FlowEdge[],fromId:string,toId:string){
 const adjacency=new Map(nodes.map(node=>[node.node_id,[] as string[]]));
 for(const edge of edges)adjacency.get(edge.from_node_id)?.push(edge.to_node_id);
 adjacency.get(fromId)?.push(toId);
 const visiting=new Set<string>(),done=new Set<string>();
 const visit=(id:string):boolean=>{
  if(done.has(id))return false;
  if(visiting.has(id))return true;
  visiting.add(id);
  for(const next of adjacency.get(id)||[])if(visit(next))return true;
  visiting.delete(id);done.add(id);return false;
 };
 return nodes.some(node=>visit(node.node_id));
}

export function resolveDirectSpaceConnection(
 models:BetaCapabilityModel[],
 nodes:FlowNode[],
 edges:FlowEdge[],
 fromId:string,
 toId:string,
):SpaceDirectConnectionResult{
 if(!fromId||!toId||fromId===toId)return{status:'INVALID',mediaType:null,message:'Escolha dois nodes diferentes.'};
 const source=nodes.find(node=>node.node_id===fromId),target=nodes.find(node=>node.node_id===toId);
 if(!source||!target)return{status:'INVALID',mediaType:null,message:'Node de origem ou destino não encontrado.'};
 const outputs=spaceNodeOutputTypes(models,source),inputs=spaceNodeInputTypes(models,target);
 const media=outputs.find(type=>inputs.includes(type))||null;
 if(!media)return{status:'INCOMPATIBLE',mediaType:null,message:'Esses nodes não possuem mídia compatível.'};
 if(edges.some(edge=>edge.from_node_id===fromId&&edge.to_node_id===toId&&edge.media_type===media))return{status:'DUPLICATE',mediaType:media,message:'Esses nodes já estão conectados.'};
 if(createsCycle(nodes,edges,fromId,toId))return{status:'CYCLE',mediaType:media,message:'Essa conexão criaria um ciclo no fluxo.'};
 return{status:'COMPATIBLE',mediaType:media,message:`${media} compatível`};
}
