import{betaJobOrchestrator}from'../../beta/jobs/jobOrchestrator.js';
import{routingV2AutoModelSelectionService}from'../../routing-v2/autoModelSelectionService.js';
import{assetRepository}from'../../repositories/assetRepository.js';
import{creditWalletService}from'../../services/creditWalletService.js';
import{aiConversationRepository}from'./conversationRepository.js';
import{aiConversationContextEngine}from'./contextEngine.js';
import{aiConversationToolRegistry}from'./toolRegistry.js';
import type{AiConversationActionDraft}from'./conversationTypes.js';

function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):undefined;
const bool=(value:unknown)=>value===undefined?undefined:Boolean(value);

function outputChunks(action:AiConversationActionDraft){
 const tool=aiConversationToolRegistry.get(action.capability_id);
 const imageOutput=tool?.outputs.includes('IMAGE')===true;
 const total=Math.max(1,Math.min(16,Math.round(action.quantity||1)));
 if(imageOutput){
  const out:number[]=[];let left=total;
  while(left>0){const size=Math.min(4,left);out.push(size);left-=size;}
  return out;
 }
 return Array.from({length:total},()=>1);
}

function requestFor(action:AiConversationActionDraft,modelId:string,quantity:number){
 const controls=action.controls||{};
 return{
  capability_id:action.capability_id,model_id:modelId,prompt:action.generation_prompt,negative_prompt:action.negative_prompt||undefined,references:action.resolved_references,
  controls:{
   ...controls,number_of_outputs:quantity,duration_seconds:number(controls.duration_seconds),resolution:controls.resolution?String(controls.resolution):undefined,
   aspect_ratio:controls.aspect_ratio?String(controls.aspect_ratio):undefined,seed:controls.seed===null?null:number(controls.seed),
   motion_strength:number(controls.motion_strength),audio_enabled:bool(controls.audio_enabled),language:controls.language?String(controls.language):undefined,
   voice:controls.voice?String(controls.voice):undefined,output_format:controls.output_format?String(controls.output_format):undefined,
   style:controls.style?String(controls.style):undefined,instrumental:bool(controls.instrumental),background_mode:controls.background_mode?String(controls.background_mode):undefined,
   variation_strength:number(controls.variation_strength),
  },
 };
}

async function resolveModel(userId:string,action:AiConversationActionDraft){
 if(action.model_id!=='AUTO')return action.model_id;
 const controls=action.controls||{};
 const tool=aiConversationToolRegistry.get(action.capability_id);
 if(!tool)fail('AI_ACTION_TOOL_INVALID','A ferramenta desta ação não está mais disponível.');
 const imageOutput=tool.outputs.includes('IMAGE');
 const refAssets=await Promise.all(action.resolved_references.map(ref=>assetRepository.getAsset(ref.asset_id,userId)));
 const referenceTypes=refAssets.filter(Boolean).map((asset:any)=>String(asset.type));
 const referenceRoles=action.resolved_references.map(ref=>String(ref.role||'REFERENCE'));
 const selected=await routingV2AutoModelSelectionService.select({
  capability_id:tool.id,duration_seconds:number(controls.duration_seconds),number_of_outputs:imageOutput?Math.max(1,Math.min(4,Math.round(action.quantity||1))):1,
  character_count:action.generation_prompt.length,negative_prompt_present:Boolean(action.negative_prompt),
  dimensions:{resolution:controls.resolution?String(controls.resolution):undefined,aspect_ratio:controls.aspect_ratio?String(controls.aspect_ratio):undefined},
  parameters:{language:controls.language,voice:controls.voice,output_format:controls.output_format,style:controls.style,instrumental:controls.instrumental,seed:controls.seed,motion_strength:controls.motion_strength,audio_enabled:controls.audio_enabled,background_mode:controls.background_mode,variation_strength:controls.variation_strength},
  reference_types:referenceTypes,reference_roles:referenceRoles,
 });
 return selected.model.model_id;
}

function actionStatus(statuses:string[]):AiConversationActionDraft['status']{
 if(statuses.length&&statuses.every(status=>status==='SUCCEEDED'))return'SUCCEEDED';
 const success=statuses.some(status=>status==='SUCCEEDED');
 const active=statuses.some(status=>status==='RUNNING'||status==='QUEUED');
 const failed=statuses.some(status=>status==='FAILED'||status==='CANCELLED');
 if(active)return statuses.some(status=>status==='RUNNING')?'RUNNING':'QUEUED';
 if(success&&failed)return'PARTIAL_SUCCESS';
 if(statuses.some(status=>status==='FAILED'))return'FAILED';
 if(statuses.length&&statuses.every(status=>status==='CANCELLED'))return'CANCELLED';
 return'CONFIRMED';
}

async function hydrateAssets(userId:string,ids:string[]){
 const assets=await Promise.all(ids.map(id=>assetRepository.getAsset(id,userId)));
 return assets.filter(Boolean).map((asset:any)=>({
  asset_id:asset.asset_id,type:asset.type,name:asset.name,
  public_url:String(asset.public_url||''),thumbnail_url:String(asset.thumbnail_url||asset.public_url||''),
  preview_url:asset.preview_url||asset.thumbnail_url||asset.public_url||null,
  width:asset.width??null,height:asset.height??null,duration_seconds:asset.duration_seconds??null,
 }));
}

export const aiConversationActionService={
 async get(userId:string,conversationId:string,actionId:string){
  const action=await aiConversationRepository.getAction(userId,conversationId,actionId);if(!action)fail('AI_ACTION_NOT_FOUND','Ação não encontrada.');return action;
 },
 async quote(userId:string,conversationId:string,actionId:string){
  let action=await this.get(userId,conversationId,actionId);
  if(action.status==='UNAVAILABLE')fail('AI_ACTION_UNAVAILABLE',action.unavailable_reason||'Esta ação está indisponível.');
  if(action.unresolved_references.length)fail('AI_ACTION_REFERENCE_REQUIRED','Resolva as referências necessárias antes de calcular o preço.');
  if(['QUEUED','RUNNING','PARTIAL_SUCCESS','SUCCEEDED','CONFIRMED'].includes(action.status))fail('AI_ACTION_LOCKED','Esta ação já foi confirmada e não pode ser alterada.');
  if(action.status==='AWAITING_CONFIRMATION'&&action.quote_expires_at&&Date.parse(action.quote_expires_at)>Date.now())return action;
  action=await aiConversationRepository.saveAction(userId,{...action,status:'QUOTING',error_code:null,error_message:null});
  try{
   const modelId=await resolveModel(userId,action),chunks=outputChunks(action);
   const executionJobs=[] as AiConversationActionDraft['execution_jobs'];
   const expiries:string[]=[];
   for(let index=0;index<chunks.length;index++){
    const quantity=chunks[index];
    const created=await betaJobOrchestrator.create(userId,requestFor(action,modelId,quantity),`ai-action-create:${action.action_id}:${index}`);
    const quoted=await betaJobOrchestrator.quote(userId,created.job_id,`ai-action-quote:${action.action_id}:${index}:${created.job_id}`);
    if(!quoted.quote)fail('AI_ACTION_QUOTE_FAILED','Não foi possível obter uma cotação válida.');
    executionJobs.push({job_id:quoted.job_id,quantity,credit_price:Number(quoted.quote.credit_price),status:'QUOTED',result_asset_ids:[]});
    expiries.push(quoted.quote.expires_at);
   }
   const total=executionJobs.reduce((sum,item)=>sum+item.credit_price,0);
   const funds=await creditWalletService.simulateReserve(userId,total);
   if(!funds.has_sufficient_credits)throw Object.assign(new Error(`Créditos insuficientes. Faltam ${funds.missing_credits} créditos para este batch.`),{code:'CREDIT_INSUFFICIENT_FUNDS',missing_credits:funds.missing_credits});
   const expiresAt=expiries.sort((a,b)=>Date.parse(a)-Date.parse(b))[0]||null;
   return aiConversationRepository.saveAction(userId,{...action,status:'AWAITING_CONFIRMATION',job_id:executionJobs[0]?.job_id||null,selected_model_id:modelId,quote_credit_price:total,quote_expires_at:expiresAt,execution_jobs:executionJobs,error_code:null,error_message:null});
  }catch(error:any){
   await aiConversationRepository.saveAction(userId,{...action,status:'DRAFT',error_code:String(error?.code||'AI_ACTION_QUOTE_FAILED'),error_message:String(error?.message||'Não foi possível calcular o preço.')}).catch(()=>{});throw error;
  }
 },
 async confirm(userId:string,conversationId:string,actionId:string,reqHost?:string,idToken?:string){
  let action=await this.get(userId,conversationId,actionId);
  if(action.status!=='AWAITING_CONFIRMATION'||!action.execution_jobs.length||!action.quote_credit_price)fail('AI_ACTION_CONFIRMATION_REQUIRED','Calcule o preço antes de confirmar esta ação.');
  if(!action.quote_expires_at||Date.parse(action.quote_expires_at)<=Date.now())return this.quote(userId,conversationId,actionId);
  action=await aiConversationRepository.saveAction(userId,{...action,status:'CONFIRMED',confirmed_at:new Date().toISOString()});
  try{
   const queued=await Promise.allSettled(action.execution_jobs.map(async(item,index)=>{
    const job=await betaJobOrchestrator.queue(userId,item.job_id,`ai-action-queue:${action.action_id}:${index}:${item.job_id}`,reqHost,idToken);
    return{...item,status:job.status,result_asset_ids:job.result_asset_ids||[]};
   }));
   const jobs=queued.map((entry,index)=>entry.status==='fulfilled'?entry.value:{...action.execution_jobs[index],status:'FAILED',result_asset_ids:[]});
   const ids=jobs.flatMap(job=>job.result_asset_ids);
   const resultAssets=await hydrateAssets(userId,ids);
   if(resultAssets.length)await aiConversationContextEngine.registerAssets(userId,conversationId,action.action_id,resultAssets).catch(()=>{});
   const status=actionStatus(jobs.map(job=>job.status));
   return aiConversationRepository.saveAction(userId,{...action,status,execution_jobs:jobs,result_asset_ids:ids,result_assets:resultAssets,error_code:status==='FAILED'?'AI_ACTION_EXECUTION_FAILED':status==='PARTIAL_SUCCESS'?'BATCH_PARTIAL_FAILURE':null,error_message:status==='PARTIAL_SUCCESS'?'Parte da geração não iniciou. Os jobs aceitos continuaram normalmente.':null});
  }catch(error:any){
   await aiConversationRepository.saveAction(userId,{...action,status:'FAILED',error_code:String(error?.code||'AI_ACTION_EXECUTION_FAILED'),error_message:String(error?.message||'Não foi possível iniciar a geração.')}).catch(()=>{});throw error;
  }
 },
 async refresh(userId:string,conversationId:string,actionId:string){
  let action=await this.get(userId,conversationId,actionId);
  if(!action.execution_jobs.length&&action.job_id){
   action={...action,execution_jobs:[{job_id:action.job_id,quantity:Math.min(4,action.quantity),credit_price:action.quote_credit_price||0,status:action.status,result_asset_ids:action.result_asset_ids||[]}]};
  }
  if(!action.execution_jobs.length)return action;
  const jobs=await Promise.all(action.execution_jobs.map(async item=>{
   const job=await betaJobOrchestrator.get(userId,item.job_id,true);
   return{...item,status:job.status,result_asset_ids:job.result_asset_ids||[]};
  }));
  const ids=Array.from(new Set(jobs.flatMap(job=>job.result_asset_ids)));
  const nextStatus=action.status==='AWAITING_CONFIRMATION'?'AWAITING_CONFIRMATION':actionStatus(jobs.map(job=>job.status));
  const assets=ids.length?await hydrateAssets(userId,ids):action.result_assets;
  if(assets.length&&ids.join('|')!==action.result_asset_ids.join('|'))await aiConversationContextEngine.registerAssets(userId,conversationId,action.action_id,assets).catch(()=>{});
  if(nextStatus===action.status&&ids.join('|')===action.result_asset_ids.join('|')&&JSON.stringify(jobs)===JSON.stringify(action.execution_jobs))return action;
  action=await aiConversationRepository.saveAction(userId,{...action,status:nextStatus,execution_jobs:jobs,result_asset_ids:ids,result_assets:assets,error_code:jobs.some(job=>job.status==='FAILED')?'BATCH_PARTIAL_FAILURE':null,error_message:nextStatus==='PARTIAL_SUCCESS'?'Parte da geração falhou. Os resultados concluídos foram preservados.':null});return action;
 },
 async cancel(userId:string,conversationId:string,actionId:string){
  let action=await this.get(userId,conversationId,actionId);
  if(['SUCCEEDED','FAILED','CANCELLED','PARTIAL_SUCCESS'].includes(action.status))return action;
  if(!action.execution_jobs.length)return aiConversationRepository.saveAction(userId,{...action,status:'CANCELLED'});
  const jobs=await Promise.all(action.execution_jobs.map(async item=>{
   try{
    const job=await betaJobOrchestrator.cancel(userId,item.job_id,`ai-action-cancel:${action.action_id}:${item.job_id}`);
    return{...item,status:job.status,result_asset_ids:job.result_asset_ids||item.result_asset_ids||[]};
   }catch{return item;}
  }));
  const ids=Array.from(new Set(jobs.flatMap(job=>job.result_asset_ids||[])));
  const assets=ids.length?await hydrateAssets(userId,ids):action.result_assets;
  action=await aiConversationRepository.saveAction(userId,{...action,status:actionStatus(jobs.map(job=>job.status)),execution_jobs:jobs,result_asset_ids:ids,result_assets:assets,error_code:null,error_message:null});
  return action;
 },
 async retryFailed(userId:string,conversationId:string,actionId:string){
  const source=await this.get(userId,conversationId,actionId);
  if(!['FAILED','PARTIAL_SUCCESS','CANCELLED'].includes(source.status))fail('AI_ACTION_RETRY_UNAVAILABLE','Só é possível tentar novamente uma ação falha, parcial ou cancelada.');
  const failedJobs=source.execution_jobs.filter(job=>['FAILED','CANCELLED'].includes(job.status));
  const retryQuantity=failedJobs.reduce((sum,job)=>sum+Math.max(1,Number(job.quantity||1)),0)||Math.max(1,source.quantity-source.result_asset_ids.length);
  const existing=(await aiConversationRepository.listActions(userId,conversationId)).find(action=>action.parent_action_id===source.action_id&&action.reference_terms.includes('retry-failed')&&!['FAILED','CANCELLED','SUCCEEDED'].includes(action.status)&&Date.now()-Date.parse(action.created_at)<10*60_000);
  if(existing)return existing;
  const created=await aiConversationRepository.createAction({
   conversation_id:conversationId,owner_user_id:userId,message_id:source.message_id,capability_id:source.capability_id,tool_label:source.tool_label,
   generation_prompt:source.generation_prompt,negative_prompt:source.negative_prompt,model_id:source.model_id,quantity:Math.max(1,Math.min(16,retryQuantity)),controls:source.controls,
   reference_terms:['retry-failed'],resolved_references:source.resolved_references,unresolved_references:[],compatible_model_ids:source.compatible_model_ids,status:'DRAFT',unavailable_reason:null,
   job_id:null,selected_model_id:null,quote_credit_price:null,quote_expires_at:null,confirmed_at:null,result_asset_ids:[],result_assets:[],execution_jobs:[],parent_action_id:source.action_id,error_code:null,error_message:null,
  });
  return this.quote(userId,conversationId,created.action_id);
 },
 async recover(userId:string,conversationId:string,action:AiConversationActionDraft){
  const age=Date.now()-Date.parse(action.updated_at||action.created_at);
  if(action.status==='QUOTING'&&age>90_000){
   const reset=await aiConversationRepository.saveAction(userId,{...action,status:'DRAFT',error_code:'AI_ACTION_RECOVERED',error_message:'A preparação anterior foi interrompida e será refeita.'});
   if(!reset.unresolved_references.length)return this.quote(userId,conversationId,reset.action_id).catch(()=>reset);
   return reset;
  }
  if(action.status==='AWAITING_CONFIRMATION'&&action.quote_expires_at&&Date.parse(action.quote_expires_at)<=Date.now()){
   return this.quote(userId,conversationId,action.action_id).catch(()=>action);
  }
  if(['CONFIRMED','QUEUED','RUNNING'].includes(action.status))return this.refresh(userId,conversationId,action.action_id).catch(()=>action);
  return action;
 },
 async regenerate(userId:string,conversationId:string,actionId:string,assetId:string){
  const source=await this.get(userId,conversationId,actionId);
  if(!source.result_asset_ids.includes(assetId))fail('AI_ACTION_RESULT_NOT_FOUND','Este resultado não pertence à ação selecionada.');
  const existing=(await aiConversationRepository.listActions(userId,conversationId)).find(action=>action.parent_action_id===source.action_id&&action.reference_terms.includes(`regeneração de ${assetId}`)&&!['FAILED','CANCELLED','SUCCEEDED'].includes(action.status)&&Date.now()-Date.parse(action.created_at)<10*60_000);
  if(existing)return existing;
  const created=await aiConversationRepository.createAction({
   conversation_id:conversationId,owner_user_id:userId,message_id:source.message_id,capability_id:source.capability_id,tool_label:source.tool_label,
   generation_prompt:source.generation_prompt,negative_prompt:source.negative_prompt,model_id:source.model_id,quantity:1,controls:source.controls,
   reference_terms:[`regeneração de ${assetId}`],resolved_references:source.resolved_references,unresolved_references:[],compatible_model_ids:source.compatible_model_ids,status:'DRAFT',unavailable_reason:null,
   job_id:null,selected_model_id:null,quote_credit_price:null,quote_expires_at:null,confirmed_at:null,result_asset_ids:[],result_assets:[],execution_jobs:[],parent_action_id:source.action_id,error_code:null,error_message:null,
  });
  return this.quote(userId,conversationId,created.action_id);
 },
};
