import{betaJobOrchestrator}from'../../beta/jobs/jobOrchestrator.js';
import{routingV2AutoModelSelectionService}from'../../routing-v2/autoModelSelectionService.js';
import{aiConversationRepository}from'./conversationRepository.js';
import{aiConversationToolRegistry}from'./toolRegistry.js';
import type{AiConversationActionDraft}from'./conversationTypes.js';

function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):undefined;
const bool=(value:unknown)=>value===undefined?undefined:Boolean(value);

function requestFor(action:AiConversationActionDraft,modelId:string){
 const controls=action.controls||{};
 const tool=aiConversationToolRegistry.get(action.capability_id);
 const imageOutput=tool?.outputs.includes('IMAGE')===true;
 const outputs=imageOutput?Math.max(1,Math.min(4,Math.round(action.quantity||1))):1;
 return{
  capability_id:action.capability_id,model_id:modelId,prompt:action.generation_prompt,negative_prompt:action.negative_prompt||undefined,references:[],
  controls:{
   ...controls,number_of_outputs:outputs,duration_seconds:number(controls.duration_seconds),resolution:controls.resolution?String(controls.resolution):undefined,
   aspect_ratio:controls.aspect_ratio?String(controls.aspect_ratio):undefined,seed:controls.seed===null?null:number(controls.seed),
   motion_strength:number(controls.motion_strength),audio_enabled:bool(controls.audio_enabled),language:controls.language?String(controls.language):undefined,
   voice:controls.voice?String(controls.voice):undefined,output_format:controls.output_format?String(controls.output_format):undefined,
   style:controls.style?String(controls.style):undefined,instrumental:bool(controls.instrumental),background_mode:controls.background_mode?String(controls.background_mode):undefined,
   variation_strength:number(controls.variation_strength),
  },
 };
}

async function resolveModel(action:AiConversationActionDraft){
 if(action.model_id!=='AUTO')return action.model_id;
 const controls=action.controls||{};
 const tool=aiConversationToolRegistry.get(action.capability_id);
 if(!tool)fail('AI_ACTION_TOOL_INVALID','A ferramenta desta ação não está mais disponível.');
 const imageOutput=tool.outputs.includes('IMAGE');
 const selected=await routingV2AutoModelSelectionService.select({
  capability_id:tool.id,duration_seconds:number(controls.duration_seconds),number_of_outputs:imageOutput?Math.max(1,Math.min(4,Math.round(action.quantity||1))):1,
  character_count:action.generation_prompt.length,negative_prompt_present:Boolean(action.negative_prompt),
  dimensions:{resolution:controls.resolution?String(controls.resolution):undefined,aspect_ratio:controls.aspect_ratio?String(controls.aspect_ratio):undefined},
  parameters:{language:controls.language,voice:controls.voice,output_format:controls.output_format,style:controls.style,instrumental:controls.instrumental,seed:controls.seed,motion_strength:controls.motion_strength,audio_enabled:controls.audio_enabled,background_mode:controls.background_mode,variation_strength:controls.variation_strength},
  reference_types:[],reference_roles:[],
 });
 return selected.model.model_id;
}

function statusFromJob(status:string):AiConversationActionDraft['status']{
 if(status==='QUEUED')return'QUEUED';if(status==='RUNNING')return'RUNNING';if(status==='SUCCEEDED')return'SUCCEEDED';if(status==='FAILED')return'FAILED';if(status==='CANCELLED')return'CANCELLED';
 return'CONFIRMED';
}

export const aiConversationActionService={
 async get(userId:string,conversationId:string,actionId:string){
  const action=await aiConversationRepository.getAction(userId,conversationId,actionId);if(!action)fail('AI_ACTION_NOT_FOUND','Ação não encontrada.');return action;
 },
 async quote(userId:string,conversationId:string,actionId:string){
  let action=await this.get(userId,conversationId,actionId);
  if(action.status==='UNAVAILABLE')fail('AI_ACTION_UNAVAILABLE',action.unavailable_reason||'Esta ação está indisponível.');
  if(action.unresolved_references.length)fail('AI_ACTION_REFERENCE_REQUIRED','Resolva as referências necessárias antes de calcular o preço.');
  if(action.quantity>4)fail('AI_ACTION_BATCH_LIMIT','Nesta etapa, uma ação aceita até 4 resultados. O batch ampliado entra na próxima fase.');
  if(['QUEUED','RUNNING','SUCCEEDED','CONFIRMED'].includes(action.status))fail('AI_ACTION_LOCKED','Esta ação já foi confirmada e não pode ser alterada.');
  if(action.status==='AWAITING_CONFIRMATION'&&action.quote_expires_at&&Date.parse(action.quote_expires_at)>Date.now())return action;
  action=await aiConversationRepository.saveAction(userId,{...action,status:'QUOTING',error_code:null,error_message:null});
  try{
   const modelId=await resolveModel(action),request=requestFor(action,modelId);
   const created=await betaJobOrchestrator.create(userId,request,`ai-action-create:${action.action_id}`);
   const quoted=await betaJobOrchestrator.quote(userId,created.job_id,`ai-action-quote:${action.action_id}:${created.job_id}`);
   if(!quoted.quote)fail('AI_ACTION_QUOTE_FAILED','Não foi possível obter uma cotação válida.');
   return aiConversationRepository.saveAction(userId,{...action,status:'AWAITING_CONFIRMATION',job_id:quoted.job_id,selected_model_id:modelId,quote_credit_price:Number(quoted.quote.credit_price),quote_expires_at:quoted.quote.expires_at,error_code:null,error_message:null});
  }catch(error:any){
   await aiConversationRepository.saveAction(userId,{...action,status:'DRAFT',error_code:String(error?.code||'AI_ACTION_QUOTE_FAILED'),error_message:String(error?.message||'Não foi possível calcular o preço.')}).catch(()=>{});throw error;
  }
 },
 async confirm(userId:string,conversationId:string,actionId:string,reqHost?:string,idToken?:string){
  let action=await this.get(userId,conversationId,actionId);
  if(action.status!=='AWAITING_CONFIRMATION'||!action.job_id||!action.quote_credit_price)fail('AI_ACTION_CONFIRMATION_REQUIRED','Calcule o preço antes de confirmar esta ação.');
  if(!action.quote_expires_at||Date.parse(action.quote_expires_at)<=Date.now())fail('AI_ACTION_QUOTE_EXPIRED','A cotação expirou. Calcule o preço novamente.');
  action=await aiConversationRepository.saveAction(userId,{...action,status:'CONFIRMED',confirmed_at:new Date().toISOString()});
  try{
   const job=await betaJobOrchestrator.queue(userId,action.job_id,`ai-action-queue:${action.action_id}:${action.job_id}`,reqHost,idToken);
   return aiConversationRepository.saveAction(userId,{...action,status:statusFromJob(job.status),result_asset_ids:job.result_asset_ids||[],error_code:job.error_code||null,error_message:job.error_message||null});
  }catch(error:any){
   await aiConversationRepository.saveAction(userId,{...action,status:'FAILED',error_code:String(error?.code||'AI_ACTION_EXECUTION_FAILED'),error_message:String(error?.message||'Não foi possível iniciar a geração.')}).catch(()=>{});throw error;
  }
 },
 async refresh(userId:string,conversationId:string,actionId:string){
  let action=await this.get(userId,conversationId,actionId);if(!action.job_id)return action;
  const job=await betaJobOrchestrator.get(userId,action.job_id,true);
  const nextStatus=action.status==='AWAITING_CONFIRMATION'?'AWAITING_CONFIRMATION':statusFromJob(job.status);
  if(nextStatus===action.status&&(job.result_asset_ids||[]).join('|')===action.result_asset_ids.join('|')&&(job.error_code||null)===action.error_code)return action;
  action=await aiConversationRepository.saveAction(userId,{...action,status:nextStatus,result_asset_ids:job.result_asset_ids||[],error_code:job.error_code||null,error_message:job.error_message||null});return action;
 },
};
