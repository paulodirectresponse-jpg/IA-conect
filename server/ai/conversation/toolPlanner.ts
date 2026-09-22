import{aiConversationRepository}from'./conversationRepository.js';
import{aiConversationToolRegistry}from'./toolRegistry.js';
import type{AiConversationMessage,AiModelTurn,AiToolPlan}from'./conversationTypes.js';

const mediaInputs=new Set(['IMAGE','VIDEO','AUDIO','MASK','MODEL_3D']);
const cleanControls=(input:Record<string,any>,allowed:string[])=>{const out:Record<string,string|number|boolean|null>={};for(const[key,value]of Object.entries(input||{})){if(!allowed.includes(key))continue;if(value===null||['string','number','boolean'].includes(typeof value))out[key]=value as any;}return out;};

export const aiConversationToolPlanner={
 async plan(userId:string,conversationId:string,message:AiConversationMessage,turn:AiModelTurn):Promise<AiToolPlan>{
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
  const unresolved=requiresMedia?refs.length?refs:['referência de '+tool.inputs.filter(input=>mediaInputs.has(input)).join('/')]:[];
  const unavailableReason=!availability.available?availability.reason:null;
  const action=await aiConversationRepository.createAction({
   conversation_id:conversationId,owner_user_id:userId,message_id:message.message_id,
   capability_id:tool.id,tool_label:tool.label,generation_prompt:String(request.generation_prompt||'').trim().slice(0,12000),
   negative_prompt:request.negative_prompt?String(request.negative_prompt).trim().slice(0,4000):null,model_id:modelId,
   quantity:Math.max(1,Math.min(16,Math.round(Number(request.quantity||1)))),
   controls:cleanControls(request.controls||{},tool.controls),reference_terms:refs,unresolved_references:unresolved,
   compatible_model_ids:compatibleModelIds,status:availability.available?'DRAFT':'UNAVAILABLE',unavailable_reason:unavailableReason,
  });
  return{action,tool_request:request};
 },
};
