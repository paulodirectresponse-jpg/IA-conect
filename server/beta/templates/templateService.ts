import { betaFlowService } from '../flows/flowService.js';
import { BetaFlowGraph,BetaFlowNode } from '../flows/flowTypes.js';
import { betaTemplateRepository } from './templateRepository.js';
import { BetaTemplateCategory,BetaTemplateRecord } from './templateTypes.js';

const CATEGORIES=new Set<BetaTemplateCategory>(['GENERIC','IMAGE','VIDEO','AUDIO','THREE_D','MULTIMODAL']);
const clean=(v:any,max:number)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,max);
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function tags(input:any){const raw=Array.isArray(input)?input:String(input||'').split(',');return Array.from(new Set(raw.map((v:any)=>clean(v,32).toLowerCase()).filter(Boolean))).slice(0,12);}
function category(input:any):BetaTemplateCategory{const value=String(input||'GENERIC').toUpperCase() as BetaTemplateCategory;return CATEGORIES.has(value)?value:'GENERIC';}
function portableGraph(graph:BetaFlowGraph):BetaFlowGraph{
  const nodes=graph.nodes.map((node):BetaFlowNode=>node.kind==='ASSET'
    ?{...node,kind:'INPUT',label:`Entrada · ${node.label}`,asset_id:null,media_type:node.media_type||null}
    :{...node,asset_id:node.kind==='ASSET'?null:node.asset_id});
  return{nodes,edges:graph.edges.map(edge=>({...edge}))};
}
export const betaTemplateService={
  async list(userId:string){return betaTemplateRepository.list(userId);},
  async get(userId:string,templateId:string){const row=await betaTemplateRepository.get(templateId,userId);if(!row)fail('TEMPLATE_NOT_FOUND','Template não encontrado.');return row;},
  async createFromFlow(userId:string,input:any){
    const flow=await betaFlowService.get(userId,clean(input?.flow_id,120));
    const name=clean(input?.name,100)||flow.name,description=clean(input?.description,400)||flow.description;
    const graph=portableGraph(flow.graph);
    if(!graph.nodes.length)fail('TEMPLATE_EMPTY_FLOW','Salve um Flow com nós antes de criar um template.');
    return betaTemplateRepository.create({owner_user_id:userId,name,description,category:category(input?.category),tags:tags(input?.tags),graph,source_flow_id:flow.flow_id,source_flow_revision:flow.revision,visibility:'PRIVATE',use_count:0});
  },
  async update(userId:string,templateId:string,input:any){
    const current=await this.get(userId,templateId) as BetaTemplateRecord;
    return betaTemplateRepository.save({...current,name:input?.name===undefined?current.name:(clean(input.name,100)||current.name),description:input?.description===undefined?current.description:clean(input.description,400),category:input?.category===undefined?current.category:category(input.category),tags:input?.tags===undefined?current.tags:tags(input.tags)});
  },
  async instantiate(userId:string,templateId:string,input:any){
    const template=await this.get(userId,templateId) as BetaTemplateRecord;
    const flow=await betaFlowService.create(userId,{name:clean(input?.name,100)||`${template.name} — cópia`,description:template.description,project_id:input?.project_id||null,graph:template.graph});
    await betaTemplateRepository.save({...template,use_count:template.use_count+1});
    return flow;
  },
  async remove(userId:string,templateId:string){return betaTemplateRepository.remove(await this.get(userId,templateId) as BetaTemplateRecord);},
};
