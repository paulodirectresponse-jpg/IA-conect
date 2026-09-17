import { betaLibraryService } from '../library/libraryService.js';
import { betaFlowService } from '../flows/flowService.js';
import { betaTemplateService } from '../templates/templateService.js';
import { workflowAppService } from '../apps/workflowAppService.js';
import { betaContextService } from '../context/contextService.js';
import { copilotProposalRepository } from './copilotRepository.js';
import { CopilotIntent,CopilotMutation } from './copilotTypes.js';
const clean=(v:any,max:number)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,max);
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function requestedName(message:string,fallback:string){const quoted=message.match(/["“”']([^"“”']{2,100})["“”']/)?.[1];if(quoted)return clean(quoted,100);const colon=message.split(':').slice(1).join(':').trim();return clean(colon,100)||fallback;}
function classify(message:string):{intent:CopilotIntent;entity:'PROJECT'|'FLOW'|'TEMPLATE'|'APP'|null;action:'CREATE'|'UPDATE'|'GUIDE'}{
 const m=message.toLowerCase();const entity=m.includes('template')?'TEMPLATE':m.includes('app')||m.includes('aplicativo')?'APP':m.includes('flux')||m.includes('flow')?'FLOW':m.includes('projeto')?'PROJECT':null;
 const create=/(criar|crie|novo|nova|montar|construir)/.test(m),update=/(editar|edite|alterar|mudar|renomear|atualizar|modificar)/.test(m);
 if(!entity)return{intent:'GENERAL_GUIDANCE',entity:null,action:'GUIDE'};
 const action=create?'CREATE':update?'UPDATE':'GUIDE';const intent=(action==='CREATE'?`CREATE_${entity}`:action==='UPDATE'?`UPDATE_${entity}`:'GENERAL_GUIDANCE') as CopilotIntent;return{intent,entity,action};
}
function draftMutations(message:string,resolved:any,classification:ReturnType<typeof classify>):CopilotMutation[]{
 const name=requestedName(message,classification.entity==='PROJECT'?'Novo projeto':classification.entity==='FLOW'?'Novo fluxo':classification.entity==='TEMPLATE'?'Novo template':'Novo app');
 if(classification.action==='CREATE'&&classification.entity==='PROJECT')return[{kind:'CREATE_PROJECT',input:{name,description:clean(message,400)}}];
 if(classification.action==='UPDATE'&&classification.entity==='PROJECT'&&resolved?.project)return[{kind:'UPDATE_PROJECT_METADATA',input:{project_id:resolved.project.project_id,name,description:resolved.project.description}}];
 if(classification.action==='CREATE'&&classification.entity==='FLOW')return[{kind:'CREATE_FLOW_DRAFT',input:{name,description:clean(message,400),project_id:resolved?.project?.project_id||null}}];
 if(classification.action==='UPDATE'&&classification.entity==='FLOW'&&resolved?.flow)return[{kind:'UPDATE_FLOW_METADATA',input:{flow_id:resolved.flow.flow_id,name,description:resolved.flow.description}}];
 if(classification.action==='CREATE'&&classification.entity==='TEMPLATE'&&resolved?.flow)return[{kind:'CREATE_TEMPLATE_FROM_FLOW',input:{flow_id:resolved.flow.flow_id,name,description:clean(message,400)}}];
 if(classification.action==='UPDATE'&&classification.entity==='TEMPLATE'&&resolved?.template)return[{kind:'UPDATE_TEMPLATE_METADATA',input:{template_id:resolved.template.template_id,name,description:resolved.template.description}}];
 if(classification.action==='CREATE'&&classification.entity==='APP'&&(resolved?.flow||resolved?.template)){const source=resolved.template?{source_type:'TEMPLATE',source_id:resolved.template.template_id}:{source_type:'FLOW',source_id:resolved.flow.flow_id};return[{kind:'CREATE_APP_FROM_FLOW',input:{...source,name,description:clean(message,400)}}];}
 if(classification.action==='UPDATE'&&classification.entity==='APP'&&resolved?.app)return[{kind:'UPDATE_APP_METADATA',input:{app_id:resolved.app.app_id,name,description:resolved.app.description}}];
 return[];
}
function stepsFor(intent:CopilotIntent,hasMutation:boolean){const base=['Ler apenas o contexto selecionado e suas revisões fixadas.','Preservar ownership, Stable e abstrações de provider existentes.'];return hasMutation?[...base,'Preparar uma mudança usando o serviço existente da entidade.','Aplicar somente após confirmação explícita.']: [...base,'Entregar orientação sem executar ou cobrar nada.'];}
export const betaCopilotService={
 async plan(userId:string,input:any){const message=clean(input?.message,4000);if(!message)fail('COPILOT_MESSAGE_REQUIRED','Descreva o que você quer fazer.');const contextId=input?.context_id?clean(input.context_id,140):null;const resolved=contextId?await betaContextService.resolve(userId,contextId):null;const c=classify(message),mutations=draftMutations(message,resolved,c);const summary=mutations.length?`Proposta preparada para ${c.intent.toLowerCase().replaceAll('_',' ')}. Revise antes de aplicar.`:'Posso orientar esta tarefa com o contexto atual, mas não há uma mutação segura e inequívoca para aplicar automaticamente.';return copilotProposalRepository.create({owner_user_id:userId,context_id:contextId,context_revision:resolved?.context.revision||null,message,intent:c.intent,summary,steps:stepsFor(c.intent,mutations.length>0),mutations,requires_confirmation:mutations.length>0,status:'PENDING',result:null});},
 async get(userId:string,proposalId:string){const row=await copilotProposalRepository.get(proposalId,userId);if(!row)fail('COPILOT_PROPOSAL_NOT_FOUND','Proposta não encontrada.');return row;},
 async apply(userId:string,proposalId:string,input:any){if(input?.confirm!==true)fail('COPILOT_CONFIRMATION_REQUIRED','Confirmação explícita obrigatória.');const proposal=await this.get(userId,proposalId);if(proposal.status!=='PENDING')fail('COPILOT_PROPOSAL_NOT_PENDING','Esta proposta já foi encerrada.');if(proposal.context_id){const current=await betaContextService.get(userId,proposal.context_id);if(current.revision!==proposal.context_revision)fail('COPILOT_CONTEXT_STALE','O contexto mudou desde a proposta. Gere uma nova proposta.');}
  const results=[];for(const mutation of proposal.mutations){const v:any=mutation.input;if(mutation.kind==='CREATE_PROJECT')results.push(await betaLibraryService.createProject(userId,v));else if(mutation.kind==='UPDATE_PROJECT_METADATA')results.push(await betaLibraryService.updateProject(userId,v.project_id,v));else if(mutation.kind==='CREATE_FLOW_DRAFT')results.push(await betaFlowService.create(userId,{...v,graph:{nodes:[],edges:[]}}));else if(mutation.kind==='UPDATE_FLOW_METADATA'){const flow=await betaFlowService.get(userId,v.flow_id);results.push(await betaFlowService.update(userId,v.flow_id,{name:v.name,description:v.description,project_id:flow.project_id,graph:flow.graph,expected_revision:flow.revision}));}else if(mutation.kind==='CREATE_TEMPLATE_FROM_FLOW')results.push(await betaTemplateService.createFromFlow(userId,v));else if(mutation.kind==='UPDATE_TEMPLATE_METADATA')results.push(await betaTemplateService.update(userId,v.template_id,v));else if(mutation.kind==='CREATE_APP_FROM_FLOW')results.push(await workflowAppService.create(userId,v));else if(mutation.kind==='UPDATE_APP_METADATA')results.push(await workflowAppService.update(userId,v.app_id,v));}
  return copilotProposalRepository.save({...proposal,status:'APPLIED',result:results});
 },
 async cancel(userId:string,proposalId:string){const proposal=await this.get(userId,proposalId);if(proposal.status!=='PENDING')return proposal;return copilotProposalRepository.save({...proposal,status:'CANCELLED'});},
};
