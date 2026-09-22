import type{BetaCapabilityMediaType,BetaCapabilityModel}from'../../../beta/capabilityClient.js';
import type{FlowEdge,FlowNode}from'../../../beta/flowClient.js';
import{spaceNodeInputTypes,spaceNodeOutputTypes}from'../model/spaceNodeModel.js';

export const SPACE_CONNECTION_RESOLVER_VERSION=1;
export type SpaceDirectConnectionStatus='COMPATIBLE'|'DUPLICATE'|'CYCLE'|'INCOMPATIBLE'|'INVALID';
export type SpaceConnectionStrategy='DIRECT'|'REFERENCE'|'FRAME'|'PROMPT'|'MEDIA_SOURCE';

export interface SpaceDirectConnectionResult{
 status:SpaceDirectConnectionStatus;
 mediaType:BetaCapabilityMediaType|null;
 sourcePort:string|null;
 targetPort:string|null;
 strategy:SpaceConnectionStrategy|null;
 resolverVersion:number;
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

const genericPort=(media:BetaCapabilityMediaType)=>media==='TEXT'?'prompt':media==='IMAGE'?'image':media==='VIDEO'?'video':media==='AUDIO'?'audio':media==='MASK'?'mask':media==='MODEL_3D'?'model_3d':'data';

function targetPortFor(
 target:FlowNode,
 media:BetaCapabilityMediaType,
 edges:FlowEdge[],
):{port:string;strategy:SpaceConnectionStrategy;multi:boolean}{
 if(target.kind==='OUTPUT')return{port:'input',strategy:'DIRECT',multi:false};
 if(target.kind!=='TOOL')return{port:genericPort(media),strategy:'DIRECT',multi:false};
 const cap=String(target.capability_id||'');
 if(media==='TEXT')return{port:'prompt',strategy:'PROMPT',multi:true};
 if(media==='MASK')return{port:'mask',strategy:'REFERENCE',multi:false};
 if(media==='VIDEO')return{port:'source_video',strategy:'MEDIA_SOURCE',multi:false};
 if(media==='AUDIO')return{port:'source_audio',strategy:'MEDIA_SOURCE',multi:false};
 if(media==='MODEL_3D')return{port:'source_model_3d',strategy:'MEDIA_SOURCE',multi:false};
 if(media==='IMAGE'){
  if(cap==='last-frame'){
   const targetEdges=edges.filter(edge=>edge.to_node_id===target.node_id&&edge.media_type==='IMAGE');
   const used=new Set(targetEdges.map(edge=>edge.target_port).filter(Boolean));
   let legacy=targetEdges.filter(edge=>!edge.target_port).length;
   if(legacy>0&&!used.has('first_frame')){used.add('first_frame');legacy--;}
   if(legacy>0&&!used.has('last_frame'))used.add('last_frame');
   if(!used.has('first_frame'))return{port:'first_frame',strategy:'FRAME',multi:false};
   return{port:'last_frame',strategy:'FRAME',multi:false};
  }
  if(cap==='first-frame')return{port:'first_frame',strategy:'FRAME',multi:false};
  if(cap==='image-to-video')return{port:'first_frame',strategy:'FRAME',multi:false};
  if(['image-to-image','image-edit','variations','multi-image-to-3d'].includes(cap))return{port:'reference_image',strategy:'REFERENCE',multi:cap==='multi-image-to-3d'};
  return{port:'source_image',strategy:'MEDIA_SOURCE',multi:false};
 }
 return{port:genericPort(media),strategy:'DIRECT',multi:false};
}

export function resolveDirectSpaceConnection(
 models:BetaCapabilityModel[],
 nodes:FlowNode[],
 edges:FlowEdge[],
 fromId:string,
 toId:string,
):SpaceDirectConnectionResult{
 const base={sourcePort:null,targetPort:null,strategy:null,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION};
 if(!fromId||!toId||fromId===toId)return{...base,status:'INVALID',mediaType:null,message:'Escolha dois nodes diferentes.'};
 const source=nodes.find(node=>node.node_id===fromId),target=nodes.find(node=>node.node_id===toId);
 if(!source||!target)return{...base,status:'INVALID',mediaType:null,message:'Node de origem ou destino não encontrado.'};
 const outputs=spaceNodeOutputTypes(models,source),inputs=spaceNodeInputTypes(models,target);
 const compatible=outputs.filter(type=>inputs.includes(type));
 if(!compatible.length)return{...base,status:'INCOMPATIBLE',mediaType:null,message:'Esses nodes não possuem mídia compatível.'};
 for(const media of compatible){
  if(edges.some(edge=>edge.from_node_id===fromId&&edge.to_node_id===toId&&edge.media_type===media&&!edge.target_port)){
   return{status:'DUPLICATE',mediaType:media,sourcePort:genericPort(media),targetPort:null,strategy:null,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION,message:'Esses nodes já estão conectados nessa entrada.'};
  }
 }
 if(createsCycle(nodes,edges,fromId,toId)){
  const media=compatible[0];
  return{status:'CYCLE',mediaType:media,sourcePort:genericPort(media),targetPort:null,strategy:null,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION,message:'Essa conexão criaria um ciclo no fluxo.'};
 }
 let selected:{media:BetaCapabilityMediaType;binding:ReturnType<typeof targetPortFor>}|null=null;
 for(const media of compatible){
  const binding=targetPortFor(target,media,edges);
  const occupied=edges.some(edge=>edge.to_node_id===toId&&(edge.target_port===binding.port||(!edge.target_port&&edge.media_type===media)));
  if(binding.multi||!occupied){selected={media,binding};break;}
 }
 if(!selected){
  const media=compatible[0],binding=targetPortFor(target,media,edges),sourcePort=genericPort(media);
  return{status:'INCOMPATIBLE',mediaType:media,sourcePort,targetPort:binding.port,strategy:binding.strategy,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION,message:'A entrada compatível deste node já está ocupada.'};
 }
 const{media,binding}=selected,sourcePort=genericPort(media);
 if(edges.some(edge=>edge.from_node_id===fromId&&edge.to_node_id===toId&&edge.media_type===media&&(!edge.target_port||edge.target_port===binding.port))){
  return{status:'DUPLICATE',mediaType:media,sourcePort,targetPort:binding.port,strategy:binding.strategy,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION,message:'Esses nodes já estão conectados nessa entrada.'};
 }

 const label=binding.port.replaceAll('_',' ');
 return{status:'COMPATIBLE',mediaType:media,sourcePort,targetPort:binding.port,strategy:binding.strategy,resolverVersion:SPACE_CONNECTION_RESOLVER_VERSION,message:`${media} → ${label}`};
}

export const resolveSpaceConnection=resolveDirectSpaceConnection;
