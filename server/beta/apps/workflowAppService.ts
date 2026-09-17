import crypto from 'crypto';
import { betaFlowRepository } from '../flows/flowRepository.js';
import { betaFlowRuntimeService } from '../flows/flowRuntimeService.js';
import { BetaFlowGraph } from '../flows/flowTypes.js';
import { betaFlowService } from '../flows/flowService.js';
import { betaTemplateService } from '../templates/templateService.js';
import { workflowAppRepository } from './workflowAppRepository.js';
import { WorkflowAppInputField,WorkflowAppOutputField,WorkflowAppRecord,WorkflowAppSourceType } from './workflowAppTypes.js';

const clean=(value:any,max:number)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function sourceType(value:any):WorkflowAppSourceType{return String(value||'FLOW').toUpperCase()==='TEMPLATE'?'TEMPLATE':'FLOW';}
function graphSchemas(graph:BetaFlowGraph){
  const inputs:WorkflowAppInputField[]=graph.nodes.filter(node=>node.kind==='INPUT'&&node.media_type).map((node,index)=>({node_id:node.node_id,label:node.label,media_type:node.media_type!,required:true,placeholder:'',help_text:'',order:index,default_value:null}));
  const outputs:WorkflowAppOutputField[]=graph.nodes.filter(node=>node.kind==='OUTPUT'&&node.media_type).map((node,index)=>({node_id:node.node_id,label:node.label,media_type:node.media_type!,order:index}));
  return{inputs,outputs};
}
function normalizeInputs(graph:BetaFlowGraph,raw:any,base?:WorkflowAppInputField[]){
  const allowed=new Map(graph.nodes.filter(node=>node.kind==='INPUT'&&node.media_type).map(node=>[node.node_id,node]));
  const current=new Map((base||[]).map(field=>[field.node_id,field]));
  const items=Array.isArray(raw)?raw:Array.from(allowed.keys()).map(node_id=>current.get(node_id)||{node_id});
  const seen=new Set<string>();
  return items.map((item:any,index:number)=>{
    const nodeId=clean(item?.node_id,80),node=allowed.get(nodeId);if(!node||seen.has(nodeId))fail('WORKFLOW_APP_INPUT_INVALID','Mapeamento de entrada inválido.');seen.add(nodeId);
    const previous=current.get(nodeId);
    return{node_id:nodeId,label:clean(item?.label,80)||previous?.label||node.label,media_type:node.media_type!,required:item?.required===undefined?(previous?.required??true):Boolean(item.required),placeholder:clean(item?.placeholder,180),help_text:clean(item?.help_text,240),order:Number.isFinite(Number(item?.order))?Number(item.order):index,default_value:item?.default_value===undefined?(previous?.default_value??null):item.default_value};
  }).sort((a,b)=>a.order-b.order);
}
function normalizeOutputs(graph:BetaFlowGraph,raw:any,base?:WorkflowAppOutputField[]){
  const allowed=new Map(graph.nodes.filter(node=>node.kind==='OUTPUT'&&node.media_type).map(node=>[node.node_id,node]));
  const current=new Map((base||[]).map(field=>[field.node_id,field]));
  const items=Array.isArray(raw)?raw:Array.from(allowed.keys()).map(node_id=>current.get(node_id)||{node_id});
  const seen=new Set<string>();
  return items.map((item:any,index:number)=>{const nodeId=clean(item?.node_id,80),node=allowed.get(nodeId);if(!node||seen.has(nodeId))fail('WORKFLOW_APP_OUTPUT_INVALID','Mapeamento de saída inválido.');seen.add(nodeId);return{node_id:nodeId,label:clean(item?.label,80)||current.get(nodeId)?.label||node.label,media_type:node.media_type!,order:Number.isFinite(Number(item?.order))?Number(item.order):index};}).sort((a,b)=>a.order-b.order);
}
async function sourceSnapshot(userId:string,type:WorkflowAppSourceType,id:string){
  if(type==='FLOW'){
    const flow=await betaFlowService.get(userId,id);
    return{source_id:flow.flow_id,source_revision:flow.revision,name:flow.name,description:flow.description,graph:flow.graph,template_id:null as string|null};
  }
  const template:any=await betaTemplateService.get(userId,id);
  return{source_id:template.template_id,source_revision:template.source_flow_revision||1,name:template.name,description:template.description,graph:template.graph,template_id:template.template_id as string|null};
}
async function runtimeSnapshot(userId:string,snapshot:{name:string;description:string;graph:BetaFlowGraph}){
  return betaFlowRepository.create(userId,{name:`App Runtime · ${snapshot.name}`,description:snapshot.description,project_id:null,status:'DRAFT',graph:snapshot.graph,system_kind:'WORKFLOW_APP',source_app_id:null});
}
function idempotency(app:WorkflowAppRecord,key:string){return `wapp:${app.app_id}:r${app.revision}:${clean(key,160)}`;}

export const workflowAppService={
  async list(userId:string){return workflowAppRepository.list(userId);},
  async get(userId:string,appId:string){const app=await workflowAppRepository.get(appId,userId);if(!app)fail('WORKFLOW_APP_NOT_FOUND','App não encontrado.');return app;},
  async create(userId:string,input:any){
    const type=sourceType(input?.source_type),sourceId=clean(input?.source_id||input?.flow_id||input?.template_id,120);if(!sourceId)fail('WORKFLOW_APP_SOURCE_REQUIRED','Selecione um Flow ou Template.');
    const source=await sourceSnapshot(userId,type,sourceId),runtime=await runtimeSnapshot(userId,source),schemas=graphSchemas(source.graph);
    return workflowAppRepository.create({owner_user_id:userId,name:clean(input?.name,100)||source.name,description:clean(input?.description,400)||source.description,source_type:type,source_id:source.source_id,flow_id:type==='FLOW'?source.source_id:runtime.flow_id,flow_revision:source.source_revision,template_id:source.template_id,runtime_flow_id:runtime.flow_id,runtime_flow_revision:runtime.revision,status:'DRAFT',visibility:'PRIVATE',revision:1,input_schema:schemas.inputs,output_schema:schemas.outputs});
  },
  async update(userId:string,appId:string,input:any){
    const app=await this.get(userId,appId),runtime=await betaFlowService.get(userId,app.runtime_flow_id);
    if(app.status==='PUBLISHED'&&input?.source_id)fail('WORKFLOW_APP_PUBLISHED_PINNED','Atualize a revisão pelo comando explícito de atualização.');
    return workflowAppRepository.save({...app,name:input?.name===undefined?app.name:(clean(input.name,100)||app.name),description:input?.description===undefined?app.description:clean(input.description,400),input_schema:input?.input_schema===undefined?app.input_schema:normalizeInputs(runtime.graph,input.input_schema,app.input_schema),output_schema:input?.output_schema===undefined?app.output_schema:normalizeOutputs(runtime.graph,input.output_schema,app.output_schema)});
  },
  async publish(userId:string,appId:string){const app=await this.get(userId,appId);if(!app.input_schema.length&&!app.output_schema.length)fail('WORKFLOW_APP_SCHEMA_REQUIRED','Configure entradas ou saídas antes de publicar.');return workflowAppRepository.save({...app,status:'PUBLISHED',published_at:app.published_at||new Date().toISOString()});},
  async refreshRevision(userId:string,appId:string){
    const app=await this.get(userId,appId),source=await sourceSnapshot(userId,app.source_type,app.source_id),runtime=await runtimeSnapshot(userId,source);
    return workflowAppRepository.save({...app,flow_revision:source.source_revision,runtime_flow_id:runtime.flow_id,runtime_flow_revision:runtime.revision,revision:app.revision+1,input_schema:normalizeInputs(source.graph,undefined,app.input_schema),output_schema:normalizeOutputs(source.graph,undefined,app.output_schema)});
  },
  async run(userId:string,appId:string,input:any,idempotencyKey:string,reqHost?:string,idToken?:string){
    const app=await this.get(userId,appId);if(app.status!=='PUBLISHED')fail('WORKFLOW_APP_NOT_PUBLISHED','Publique o App antes de executar.');
    if(!idempotencyKey)fail('IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key obrigatório.');
    const provided=input?.inputs||{},mapped:Record<string,any>={};
    for(const field of app.input_schema){const value=provided[field.node_id]??provided[field.label]??field.default_value;if(field.required&&(value===undefined||value===null||value===''))fail('WORKFLOW_APP_INPUT_REQUIRED',`Preencha “${field.label}”.`);if(value!==undefined&&value!==null&&value!=='')mapped[field.node_id]=value;}
    const run:any=await betaFlowRuntimeService.start(userId,app.runtime_flow_id,{inputs:mapped},idempotency(app,idempotencyKey),reqHost,idToken);
    const visibleOutputs:Record<string,any>={};for(const field of app.output_schema){if(run.outputs?.[field.node_id]!==undefined)visibleOutputs[field.node_id]=run.outputs[field.node_id];}
    return{app_id:app.app_id,app_revision:app.revision,flow_run:run,outputs:visibleOutputs};
  },
  async remove(userId:string,appId:string){return workflowAppRepository.remove(await this.get(userId,appId));},
};
