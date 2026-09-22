import{apiRequest}from'./apiClient.js';

export type AiConversationRole='USER'|'ASSISTANT';
export interface AiConversation{
 conversation_id:string;owner_user_id:string;title:string;logical_model_id:string;message_count:number;created_at:string;updated_at:string;deleted_at:string|null;
}
export interface AiConversationMessage{
 message_id:string;conversation_id:string;owner_user_id:string;role:AiConversationRole;content:string;model_id:string|null;created_at:string;
}
export type AiConversationIntent='GENERAL_CONVERSATION'|'IDEATION'|'IMAGE_GENERATION'|'IMAGE_EDIT'|'VIDEO_GENERATION'|'VIDEO_EDIT'|'AUDIO_GENERATION'|'THREE_D_GENERATION'|'BATCH_GENERATION'|'OTHER_TOOL_ACTION';
export type AiIntentReadiness='CONVERSATION'|'NEEDS_CLARIFICATION'|'READY_FOR_ACTION';
export interface AiConversationContext{conversation_id:string;summary:string;creative_state:Record<string,any>;references:Array<{label:string;kind:string;value:string;message_id:string|null;asset_id:string|null}>;last_intent:AiConversationIntent;readiness:AiIntentReadiness;missing_information:string[];revision:number;updated_at:string;}
export interface AiConversationAction{
 action_id:string;conversation_id:string;message_id:string;capability_id:string;tool_label:string;generation_prompt:string;negative_prompt:string|null;model_id:string;quantity:number;controls:Record<string,string|number|boolean|null>;reference_terms:string[];resolved_references:Array<{asset_id:string;slot_type:'INITIAL'|'END'|'GENERAL';role:'SOURCE'|'MASK'|'REFERENCE';alias:string}>;unresolved_references:string[];compatible_model_ids:string[];status:'DRAFT'|'UNAVAILABLE'|'QUOTING'|'AWAITING_CONFIRMATION'|'CONFIRMED'|'QUEUED'|'RUNNING'|'PARTIAL_SUCCESS'|'SUCCEEDED'|'FAILED'|'CANCELLED';unavailable_reason:string|null;job_id:string|null;selected_model_id:string|null;quote_credit_price:number|null;quote_expires_at:string|null;confirmed_at:string|null;result_asset_ids:string[];result_assets:Array<{asset_id:string;type:'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D';name:string;public_url:string;thumbnail_url:string;preview_url:string|null;width:number|null;height:number|null;duration_seconds:number|null}>;execution_jobs:Array<{job_id:string;quantity:number;credit_price:number;status:string;result_asset_ids:string[]}>;parent_action_id:string|null;error_code:string|null;error_message:string|null;created_at:string;updated_at:string;
}
export interface AiConversationDetail{conversation:AiConversation;messages:AiConversationMessage[];context:AiConversationContext;actions:AiConversationAction[]}
export interface AiModelInfo{logical_model_id:string;display_name:string;enabled:boolean}

export const aiConversationClient={
 model:()=>apiRequest<AiModelInfo>('/api/ai/model'),
 list:()=>apiRequest<AiConversation[]>('/api/ai/conversations'),
 create:()=>apiRequest<AiConversation>('/api/ai/conversations',{method:'POST',body:'{}'}),
 get:(id:string)=>apiRequest<AiConversationDetail>(`/api/ai/conversations/${encodeURIComponent(id)}`),
 remove:(id:string)=>apiRequest<AiConversation>(`/api/ai/conversations/${encodeURIComponent(id)}`,{method:'DELETE'}),
 send:(id:string,content:string)=>apiRequest<{conversation:AiConversation;user_message:AiConversationMessage;assistant_message:AiConversationMessage;context:AiConversationContext;intent:{type:AiConversationIntent;readiness:AiIntentReadiness;missing_information:string[]};action:AiConversationAction|null}>(`/api/ai/conversations/${encodeURIComponent(id)}/messages`,{method:'POST',body:JSON.stringify({content})}),
 quoteAction:(conversationId:string,actionId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/quote`,{method:'POST',body:'{}'}),
 confirmAction:(conversationId:string,actionId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/confirm`,{method:'POST',body:'{}'}),
 refreshAction:(conversationId:string,actionId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}`),
 regenerateResult:(conversationId:string,actionId:string,assetId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/regenerate`,{method:'POST',body:JSON.stringify({asset_id:assetId})}),
 retryAction:(conversationId:string,actionId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/retry`,{method:'POST',body:'{}'}),
 cancelAction:(conversationId:string,actionId:string)=>apiRequest<AiConversationAction>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/cancel`,{method:'POST',body:'{}'}),
};
