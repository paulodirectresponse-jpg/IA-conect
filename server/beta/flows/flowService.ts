import { assetRepository } from '../../repositories/assetRepository.js';
import { betaLibraryRepository } from '../library/libraryRepository.js';
import { betaCatalogPolicyService } from '../catalog/catalogPolicyService.js';
import { CapabilityMediaType,getCapabilityDefinition,isCapabilityId,validateModelCapability } from '../capabilityRegistry.js';
import { betaFlowRepository } from './flowRepository.js';
import { BetaFlowEdge,BetaFlowGraph,BetaFlowNode,BetaFlowRecord } from './flowTypes.js';

const MEDIA=new Set<CapabilityMediaType>(['TEXT','IMAGE','VIDEO','AUDIO','MODEL_3D','MASK','STRUCTURED_DATA']);
const clean=(v:any,max:number)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,max);
function fail(code:string,message:string){throw Object.assign(new Error(message),{code});}
function nodeOutputs(node:BetaFlowNode):CapabilityMediaType[]{
  if(node.kind==='INPUT'||node.kind==='ASSET')return node.media_type?[node.media_type]:[];
  if(node.kind==='TOOL'&&node.capability_id)return getCapabilityDefinition(node.capability_id)?.outputs||[];
  return[];
}
function nodeInputs(node:BetaFlowNode):CapabilityMediaType[]{
  if(node.kind==='OUTPUT')return node.media_type?[node.media_type]:[];
  if(node.kind==='TOOL'&&node.capability_id)return getCapabilityDefinition(node.capability_id)?.inputs||[];
  return[];
}
function allowedTargetPorts(node:BetaFlowNode,media:CapabilityMediaType){
  if(node.kind==='OUTPUT')return new Set(['input']);
  if(node.kind!=='TOOL')return new Set([media.toLowerCase()]);
  const cap=String(node.capability_id||'');
  if(media==='TEXT')return new Set(['prompt']);
  if(media==='MASK')return new Set(['mask']);
  if(media==='VIDEO')return new Set(['source_video']);
  if(media==='AUDIO')return new Set(['source_audio']);
  if(media==='MODEL_3D')return new Set(['source_model_3d']);
  if(media==='IMAGE'){
    if(cap==='last-frame')return new Set(['first_frame','last_frame']);
    if(cap==='first-frame'||cap==='image-to-video')return new Set(['first_frame']);
    if(['image-to-image','image-edit','variations','multi-image-to-3d'].includes(cap))return new Set(['reference_image']);
    return new Set(['source_image']);
  }
  return new Set(['data']);
}
function targetPortAllowsMultiple(node:BetaFlowNode,targetPort:string){
  return targetPort==='prompt'||(targetPort==='reference_image'&&node.capability_id==='multi-image-to-3d');
}

function assertAcyclic(nodes:BetaFlowNode[],edges:BetaFlowEdge[]){
  const adjacency=new Map(nodes.map(node=>[node.node_id,[] as string[]]));
  for(const edge of edges)adjacency.get(edge.from_node_id)?.push(edge.to_node_id);
  const visiting=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{if(done.has(id))return;if(visiting.has(id))fail('FLOW_CYCLE','Fluxos V1 não permitem ciclos.');visiting.add(id);for(const next of adjacency.get(id)||[])visit(next);visiting.delete(id);done.add(id);};
  for(const node of nodes)visit(node.node_id);
}
async function validateGraph(userId:string,input:any):Promise<BetaFlowGraph>{
  const rawNodes=Array.isArray(input?.nodes)?input.nodes:[];
  const rawEdges=Array.isArray(input?.edges)?input.edges:[];
  if(rawNodes.length>100||rawEdges.length>200)fail('FLOW_GRAPH_TOO_LARGE','O fluxo excede o limite do editor.');
  const ids=new Set<string>();
  const nodes:BetaFlowNode[]=[];
  for(const raw of rawNodes){
    const nodeId=clean(raw?.node_id,80);if(!nodeId||ids.has(nodeId))fail('FLOW_GRAPH_INVALID','Nós duplicados ou inválidos.');ids.add(nodeId);
    const kind=String(raw?.kind||'');if(!['INPUT','ASSET','TOOL','OUTPUT'].includes(kind))fail('FLOW_GRAPH_INVALID','Tipo de nó inválido.');
    const x=Number(raw?.x),y=Number(raw?.y);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>20000||Math.abs(y)>20000)fail('FLOW_GRAPH_INVALID','Posição de nó inválida.');
    const media=raw?.media_type?String(raw.media_type) as CapabilityMediaType:null;if(media&&!MEDIA.has(media))fail('FLOW_GRAPH_INVALID','Tipo de mídia inválido.');
    const rawUi=raw?.ui&&typeof raw.ui==='object'&&!Array.isArray(raw.ui)?raw.ui:{};
    const ui:any={fit:rawUi.fit==='contain'?'contain':'cover'};
    const uiWidth=Number(rawUi.width),uiHeight=Number(rawUi.height);
    if(Number.isFinite(uiWidth)&&uiWidth>=120&&uiWidth<=1200)ui.width=uiWidth;
    if(Number.isFinite(uiHeight)&&uiHeight>=120&&uiHeight<=1600)ui.height=uiHeight;
    const uiAspect=Number(rawUi.media_aspect_ratio);
    if(Number.isFinite(uiAspect)&&uiAspect>=0.2&&uiAspect<=5)ui.media_aspect_ratio=uiAspect;
    const node:BetaFlowNode={node_id:nodeId,schema_version:2,kind:kind as any,label:clean(raw?.label,80)||'Nó',x,y,media_type:media,asset_id:raw?.asset_id?clean(raw.asset_id,120):null,capability_id:raw?.capability_id?String(raw.capability_id) as any:null,model_id:raw?.model_id?clean(raw.model_id,120):null,prompt:String(raw?.prompt||'').slice(0,12000),controls:raw?.controls&&typeof raw.controls==='object'?raw.controls:{},ui};
    if(node.kind==='ASSET'){
      if(!node.asset_id)fail('FLOW_ASSET_REQUIRED','Selecione um asset para este nó.');
      const asset=await assetRepository.getAsset(node.asset_id,userId);if(!asset)fail('ASSET_NOT_FOUND','Asset não encontrado.');
      node.media_type=asset.type as CapabilityMediaType;
    }
    if(node.kind==='INPUT'||node.kind==='OUTPUT'){if(!node.media_type)fail('FLOW_GRAPH_INVALID','Defina o tipo de mídia do nó.');}
    if(node.kind==='TOOL'){
      if(!node.capability_id||!isCapabilityId(node.capability_id))fail('FLOW_GRAPH_INVALID','Capability inválida no nó.');
      if(!node.model_id)fail('FLOW_GRAPH_INVALID','Modelo obrigatório no nó de ferramenta.');
      const requestedControls=Object.keys(node.controls||{});
      if(node.model_id==='AUTO'){
        // Draft Spaces must stay editable even when provider/model availability is temporarily degraded.
        // AUTO is resolved and economically validated again by the runtime when the flow is executed.
        await betaCatalogPolicyService.eligibleModels(node.capability_id,requestedControls);
      }else{
        const resolved=await betaCatalogPolicyService.resolveModel(node.model_id,node.capability_id,false);
        const validation=validateModelCapability(resolved.model,node.capability_id,requestedControls);
        if(!validation.valid)fail(validation.code||'CAPABILITY_NOT_SUPPORTED',validation.message||'Capability incompatível.');
      }
    }
    nodes.push(node);
  }
  const edgeIds=new Set<string>(),edges:BetaFlowEdge[]=[];
  for(const raw of rawEdges){
    const edgeId=clean(raw?.edge_id,100),from=clean(raw?.from_node_id,80),to=clean(raw?.to_node_id,80),media=String(raw?.media_type||'') as CapabilityMediaType;
    if(!edgeId||edgeIds.has(edgeId)||!ids.has(from)||!ids.has(to)||from===to||!MEDIA.has(media))fail('FLOW_GRAPH_INVALID','Conexão inválida.');edgeIds.add(edgeId);
    const source=nodes.find(node=>node.node_id===from)!,target=nodes.find(node=>node.node_id===to)!;
    if(!nodeOutputs(source).includes(media)||!nodeInputs(target).includes(media))fail('FLOW_EDGE_TYPE_MISMATCH','Os tipos de mídia dos nós conectados são incompatíveis.');
    const sourcePort=raw?.source_port?clean(raw.source_port,40):null,targetPort=raw?.target_port?clean(raw.target_port,40):null,resolverVersion=Number(raw?.resolver_version);
    if(targetPort&&!allowedTargetPorts(target,media).has(targetPort))fail('FLOW_EDGE_PORT_MISMATCH','A porta de destino não corresponde à capability deste node.');
    if(targetPort&&!targetPortAllowsMultiple(target,targetPort)&&edges.some(edge=>edge.to_node_id===to&&(edge.target_port===targetPort||(!edge.target_port&&edge.media_type===media))))fail('FLOW_EDGE_PORT_OCCUPIED','A entrada selecionada deste node já está ocupada.');
    edges.push({edge_id:edgeId,from_node_id:from,to_node_id:to,media_type:media,source_port:sourcePort,target_port:targetPort,resolver_version:Number.isInteger(resolverVersion)&&resolverVersion>0&&resolverVersion<=100?resolverVersion:undefined});
  }
  assertAcyclic(nodes,edges);
  const rawViewport=input?.viewport&&typeof input.viewport==='object'?input.viewport:{x:160,y:100,zoom:.9};
  const vx=Number(rawViewport.x),vy=Number(rawViewport.y),vz=Number(rawViewport.zoom);
  const viewport={
    x:Number.isFinite(vx)&&Math.abs(vx)<=50000?vx:160,
    y:Number.isFinite(vy)&&Math.abs(vy)<=50000?vy:100,
    zoom:Number.isFinite(vz)&&vz>=.2&&vz<=3?vz:.9,
  };
  const rawMetadata=input?.metadata&&typeof input.metadata==='object'&&!Array.isArray(input.metadata)?input.metadata:{};
  let metadata:Record<string,unknown>={};
  try{
    const serialized=JSON.stringify(rawMetadata);
    if(serialized.length<=50000)metadata=JSON.parse(serialized);
  }catch{}
  return{nodes,edges,viewport,metadata};
}
async function normalize(userId:string,input:any){
  const name=clean(input?.name,100)||'Novo fluxo',description=clean(input?.description,400),projectId=input?.project_id?clean(input.project_id,120):null;
  if(projectId&&!await betaLibraryRepository.getProject(projectId,userId))fail('PROJECT_NOT_FOUND','Projeto não encontrado.');
  return{name,description,project_id:projectId,status:'DRAFT' as const,graph:await validateGraph(userId,input?.graph||{})};
}
export const betaFlowService={
  async list(userId:string){return betaFlowRepository.list(userId);},
  async get(userId:string,flowId:string){const flow=await betaFlowRepository.get(flowId,userId);if(!flow)fail('FLOW_NOT_FOUND','Fluxo não encontrado.');return flow;},
  async create(userId:string,input:any){return betaFlowRepository.create(userId,await normalize(userId,input));},
  async update(userId:string,flowId:string,input:any){
    const current=await this.get(userId,flowId) as BetaFlowRecord;
    const expected=Number(input?.expected_revision);if(!Number.isInteger(expected)||expected!==current.revision)fail('FLOW_REVISION_CONFLICT','Este fluxo foi alterado em outra sessão. Recarregue antes de salvar.');
    const next=await normalize(userId,{...current,...input});
    return betaFlowRepository.update(current,{name:next.name,description:next.description,project_id:next.project_id,graph:next.graph});
  },
  async remove(userId:string,flowId:string){return betaFlowRepository.remove(await this.get(userId,flowId) as BetaFlowRecord);},
};
