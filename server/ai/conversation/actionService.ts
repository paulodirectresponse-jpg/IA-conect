import{betaJobOrchestrator}from'../../beta/jobs/jobOrchestrator.js';
import{routingV2AutoModelSelectionService}from'../../routing-v2/autoModelSelectionService.js';
import{assetRepository}from'../../repositories/assetRepository.js';
import{aiConversationRepository}from'./conversationRepository.js';
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
  capability_id:action.capability_id,model_id:modelId,prompt:action.generation_prompt,negative_prompt:action.negative_prompt||undefined,references:[],
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
   const modelId=await resolveModel(action),chunks=outputChunks(action);
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
   const expiresAt=expiries.sort((a,b)=>Date.parse(a)-Date.parse(b))[0]||null;
   return aiConversationRepository.saveAction(userId,{...action,status:'AWAITING_CONFIRMATION',job_id:executionJobs[0]?.job_id||null,selected_model_id:modelId,quote_credit_price:total,quote_expires_at:expiresAt,execution_jobs:executionJobs,error_code:null,error_message:null});
  }catch(error:any){
   await aiConversationRepository.saveAction(userId,{...action,status:'DRAFT',error_code:String(error?.code||'AI_ACTION_QUOTE_FAILED'),error_message:String(error?.message||'Não foi possível calcular o preço.')}).catch(()=>{});throw error;
  }
 },
 async confirm(userId:string,conversationId:string,actionId:string,reqHost?:string,idToken?:string){
  let action=await this.get(userId,conversationId,actionId);
  if(action.status!=='AWAITING_CONFIRMATION'||!action.execution_jobs.length||!action.quote_credit_price)fail('AI_ACTION_CONFIRMATION_REQUIRED','Calcule o preço antes de confirmar esta ação.');
  if(!action.quote_expires_at||Date.parse(action.quote_expires_at)<=Date.now())fail('AI_ACTION_QUOTE_EXPIRED','A cotação expirou. Calcule o preço novamente.');
  action=await aiConversationRepository.saveAction(userId,{...action,status:'CONFIRMED',confirmed_at:new Date().toISOString()});
  try{
   const jobs=await Promise.all(action.execution_jobs.map(async(item,index)=>{
    const job=await betaJobOrchestrator.queue(userId,item.job_id,`ai-action-queue:${action.action_id}:${index}:${item.job_id}`,reqHost,idToken);
    return{...item,status:job.status,result_asset_ids:job.result_asset_ids||[]};
   }));
   const ids=jobs.flatMap(job=>job.result_asset_ids);
   return aiConversationRepository.saveAction(userId,{...action,status:actionStatus(jobs.map(job=>job.status)),execution_jobs:jobs,result_asset_ids:ids,result_assets:await hydrateAssets(userId,ids),error_code:null,error_message:null});
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
  if(nextStatus===action.status&&ids.join('|')===action.result_asset_ids.join('|')&&JSON.stringify(jobs)===JSON.stringify(action.execution_jobs))return action;
  action=await aiConversationRepository.saveAction(userId,{...action,status:nextStatus,execution_jobs:jobs,result_asset_ids:ids,result_assets:assets,error_code:jobs.some(job=>job.status==='FAILED')?'BATCH_PARTIAL_FAILURE':null,error_message:nextStatus==='PARTIAL_SUCCESS'?'Parte da geração falhou. Os resultados concluídos foram preservados.':null});return action;
 },
 async regenerate(userId:string,conversationId:string,actionId:string,assetId:string){
  const source=await this.get(userId,conversationId,actionId);
  if(!source.result_asset_ids.includes(assetId))fail('AI_ACTION_RESULT_NOT_FOUND','Este resultado não pertence à ação selecionada.');
  const created=await aiConversationRepository.createAction({
   conversation_id:conversationId,owner_user_id:userId,message_id:source.message_id,capability_id:source.capability_id,tool_label:source.tool_label,
   generation_prompt:source.generation_prompt,negative_prompt:source.negative_prompt,model_id:source.model_id,quantity:1,controls:source.controls,
   reference_terms:[`regeneração de ${assetId}`],unresolved_references:[],compatible_model_ids:source.compatible_model_ids,status:'DRAFT',unavailable_reason:null,
   job_id:null,selected_model_id:null,quote_credit_price:null,quote_expires_at:null,confirmed_at:null,result_asset_ids:[],result_assets:[],execution_jobs:[],parent_action_id:source.action_id,error_code:null,error_message:null,
  });
  return this.quote(userId,conversationId,created.action_id);
 },
};
