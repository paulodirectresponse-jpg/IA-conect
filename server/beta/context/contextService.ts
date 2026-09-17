import { assetRepository } from '../../repositories/assetRepository.js';
import { betaFlowService } from '../flows/flowService.js';
import { betaLibraryRepository } from '../library/libraryRepository.js';
import { betaLibraryService } from '../library/libraryService.js';
import { betaTemplateService } from '../templates/templateService.js';
import { workflowAppService } from '../apps/workflowAppService.js';
import { betaContextRepository } from './contextRepository.js';
import { BetaContextPackRecord,BetaContextResolved } from './contextTypes.js';
const clean=(v:any,max:number)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,max);
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
async function normalize(userId:string,input:any,current?:BetaContextPackRecord){
 const projectId=input?.project_id===undefined?(current?.project_id||null):(input.project_id?clean(input.project_id,120):null);
 if(projectId&&!await betaLibraryRepository.getProject(projectId,userId))fail('PROJECT_NOT_FOUND','Projeto não encontrado.');
 const assetIds=input?.asset_ids===undefined?(current?.asset_ids||[]):Array.from(new Set((Array.isArray(input.asset_ids)?input.asset_ids:[]).map((v:any)=>clean(v,140)).filter(Boolean))).slice(0,24);
 for(const assetId of assetIds){if(!await assetRepository.getAsset(assetId,userId))fail('ASSET_NOT_FOUND','Asset não encontrado.');}
 let flow=current?.flow||null;if(input?.flow_id!==undefined){flow=null;if(input.flow_id){const row=await betaFlowService.get(userId,clean(input.flow_id,120));flow={id:row.flow_id,revision:row.revision};}}
 let template=current?.template||null;if(input?.template_id!==undefined){template=null;if(input.template_id){const row:any=await betaTemplateService.get(userId,clean(input.template_id,120));template={id:row.template_id,revision:Number(row.source_flow_revision||1)};}}
 let app=current?.app||null;if(input?.app_id!==undefined){app=null;if(input.app_id){const row:any=await workflowAppService.get(userId,clean(input.app_id,120));app={id:row.app_id,revision:row.revision};}}
 return{name:clean(input?.name===undefined?current?.name:input.name,100)||'Contexto',project_id:projectId,asset_ids:assetIds,flow,template,app,notes:String(input?.notes===undefined?(current?.notes||''):input.notes||'').slice(0,6000)};
}
export const betaContextService={
 async list(userId:string){return betaContextRepository.list(userId);},
 async get(userId:string,contextId:string){const row=await betaContextRepository.get(contextId,userId);if(!row)fail('CONTEXT_NOT_FOUND','Contexto não encontrado.');return row;},
 async create(userId:string,input:any){return betaContextRepository.create({owner_user_id:userId,...await normalize(userId,input)});},
 async update(userId:string,contextId:string,input:any){const current=await this.get(userId,contextId);const expected=Number(input?.expected_revision);if(!Number.isInteger(expected)||expected!==current.revision)fail('CONTEXT_REVISION_CONFLICT','O contexto mudou. Recarregue antes de salvar.');return betaContextRepository.save({...current,...await normalize(userId,input,current)});},
 async remove(userId:string,contextId:string){return betaContextRepository.remove(await this.get(userId,contextId));},
 async resolve(userId:string,contextId:string):Promise<BetaContextResolved>{
  const context=await this.get(userId,contextId);const projects=await betaLibraryService.projects(userId);const project=context.project_id?projects.find(row=>row.project_id===context.project_id)||null:null;
  const assets=[] as Array<{asset_id:string;type:string;created_at:string}>;for(const assetId of context.asset_ids){const asset:any=await assetRepository.getAsset(assetId,userId);if(asset)assets.push({asset_id:asset.asset_id,type:String(asset.type),created_at:String(asset.created_at||'')});}
  const flow=context.flow?await betaFlowService.get(userId,context.flow.id):null;const template:any=context.template?await betaTemplateService.get(userId,context.template.id):null;const app:any=context.app?await workflowAppService.get(userId,context.app.id):null;
  return{context,project:project?{project_id:project.project_id,name:project.name,description:project.description}:null,assets,flow:flow?{flow_id:flow.flow_id,name:flow.name,description:flow.description,revision:flow.revision}:null,template:template?{template_id:template.template_id,name:template.name,description:template.description,revision:Number(template.source_flow_revision||1)}:null,app:app?{app_id:app.app_id,name:app.name,description:app.description,revision:app.revision,status:app.status}:null};
 },
 async options(userId:string){const [projects,flows,templates,apps,assets]=await Promise.all([betaLibraryService.projects(userId),betaFlowService.list(userId),betaTemplateService.list(userId),workflowAppService.list(userId),betaLibraryService.listPage(userId,{limit:24})]);return{projects,flows,templates,apps,assets:assets.items};},
};
