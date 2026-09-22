import{aiConversationRepository}from'./conversationRepository.js';
import{aiConversationToolRegistry}from'./toolRegistry.js';
import type{AiConversationContext,AiConversationMessage,AiModelTurn,AiToolPlan}from'./conversationTypes.js';

const mediaInputs=new Set(['IMAGE','VIDEO','AUDIO','MASK','MODEL_3D']);
const cleanControls=(input:Record<string,any>,allowed:string[])=>{const out:Record<string,string|number|boolean|null>={};for(const[key,value]of Object.entries(input||{})){if(!allowed.includes(key))continue;if(value===null||['string','number','boolean'].includes(typeof value))out[key]=value as any;}return out;};
const normalize=(value:string)=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function resolveAssetReferences(terms:string[],context:AiConversationContext,capabilityId:string){
 const assets=(context.references||[]).filter(ref=>ref.kind==='ASSET'&&ref.asset_id);
 const newest=[...assets].reverse();
 const chosen:any[]=[];const unresolved:string[]=[];
 for(const termRaw of terms){
  const term=normalize(termRaw);
  const pronoun=/^(essa|esse|isto|isso|essa imagem|esse video|esse vídeo|a imagem|o video|o vídeo|ultima|última|ultimo|último|a ultima|a última|o ultimo|o último|anterior|a anterior|o anterior)$/i.test(term);
  let match=pronoun?newest[0]:assets.find(ref=>normalize(ref.label)===term||normalize(ref.value)===term||normalize(ref.label).includes(term));
  if(!match){
   const n=Number(term.match(/\b(\d{1,2})\b/)?.[1]||0);
   if(n>0)match=newest.find(ref=>String(ref.value||'').endsWith(`:result:${n}`));
  }
  if(!match&&/(imagem|frame|resultado|video|vídeo|asset)/.test(term)&&newest.length===1)match=newest[0];
  if(match&&!chosen.some(item=>item.asset_id===match.asset_id))chosen.push(match);else if(!match)unresolved.push(termRaw);
 }
 const mapped=chosen.map((ref,index)=>{
  let slot_type:'INITIAL'|'END'|'GENERAL'='GENERAL',role:'SOURCE'|'MASK'|'REFERENCE'='REFERENCE';
  if(capabilityId==='first-frame'){slot_type='INITIAL';role='SOURCE';}
  else if(capabilityId==='last-frame'){slot_type=index===0?'INITIAL':'END';role='SOURCE';}
  else if(capabilityId==='inpaint-mask'){role=index===0?'SOURCE':'MASK';}
  else if(['image-edit','background-remove-replace','outpaint','upscale','variations','video-edit','video-extend'].includes(capabilityId))role='SOURCE';
  return{asset_id:String(ref.asset_id),slot_type,role,alias:String(ref.label||'referencia')};
 });
 return{resolved:mapped,unresolved};
}

export const aiConversationToolPlanner={
 async plan(userId:string,conversationId:string,message:AiConversationMessage,turn:AiModelTurn,context:AiConversationContext):Promise<AiToolPlan>{
  const request=turn.tool_request;
  if(turn.readiness!=='READY_FOR_ACTION'||!request)return{action:null,tool_request:request};
  const availability=await aiConversationToolRegistry.availability(request.capability_id);
  if(!availability.tool){return{action:null,tool_request:request};}
  const tool=availability.tool;
  const compatibleModelIds=availability.models.map(model=>model.model_id);
  const preference=String(request.model_preference||'').trim().toLowerCase();
  const explicit=preference?availability.models.find(model=>model.model_id.toLowerCase()===preference||model.name.toLowerCase()===preference):null;
  const modelId=explicit?.model_id||'AUTO';
  const refs=Array.from(new Set((request.reference_terms||[]).map(String).map(value=>value.trim()).filter(Boolean))).slice(0,16);
  const requiresMedia=tool.inputs.some(input=>mediaInputs.has(input));
  const resolvedInfo=requiresMedia?resolveAssetReferences(refs,context,tool.id):{resolved:[],unresolved:[]};
  const unresolved=requiresMedia?(refs.length?resolvedInfo.unresolved:['referência de '+tool.inputs.filter(input=>mediaInputs.has(input)).join('/')]):[];
  const unavailableReason=!availability.available?availability.reason:null;
  const action=await aiConversationRepository.createAction({
   conversation_id:conversationId,owner_user_id:userId,message_id:message.message_id,
   capability_id:tool.id,tool_label:tool.label,generation_prompt:String(request.generation_prompt||'').trim().slice(0,12000),
   negative_prompt:request.negative_prompt?String(request.negative_prompt).trim().slice(0,4000):null,model_id:modelId,
   quantity:Math.max(1,Math.min(16,Math.round(Number(request.quantity||1)))),
   controls:cleanControls(request.controls||{},tool.controls),reference_terms:refs,resolved_references:resolvedInfo.resolved,unresolved_references:unresolved,
   compatible_model_ids:compatibleModelIds,status:availability.available?'DRAFT':'UNAVAILABLE',unavailable_reason:unavailableReason,
   job_id:null,selected_model_id:null,quote_credit_price:null,quote_expires_at:null,confirmed_at:null,result_asset_ids:[],result_assets:[],execution_jobs:[],parent_action_id:null,error_code:null,error_message:null,
  });
  return{action,tool_request:request};
 },
};
