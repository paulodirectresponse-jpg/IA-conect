import{apiRequest}from'./apiClient.js';

export type AiConversationRole='USER'|'ASSISTANT';
export interface AiConversation{
 conversation_id:string;owner_user_id:string;title:string;logical_model_id:string;message_count:number;created_at:string;updated_at:string;deleted_at:string|null;
}
export interface AiConversationMessage{
 message_id:string;conversation_id:string;owner_user_id:string;role:AiConversationRole;content:string;model_id:string|null;created_at:string;
}
export interface AiConversationDetail{conversation:AiConversation;messages:AiConversationMessage[]}
export interface AiModelInfo{logical_model_id:string;display_name:string;enabled:boolean}

export const aiConversationClient={
 model:()=>apiRequest<AiModelInfo>('/api/ai/model'),
 list:()=>apiRequest<AiConversation[]>('/api/ai/conversations'),
 create:()=>apiRequest<AiConversation>('/api/ai/conversations',{method:'POST',body:'{}'}),
 get:(id:string)=>apiRequest<AiConversationDetail>(`/api/ai/conversations/${encodeURIComponent(id)}`),
 remove:(id:string)=>apiRequest<AiConversation>(`/api/ai/conversations/${encodeURIComponent(id)}`,{method:'DELETE'}),
 send:(id:string,content:string)=>apiRequest<{conversation:AiConversation;user_message:AiConversationMessage;assistant_message:AiConversationMessage}>(`/api/ai/conversations/${encodeURIComponent(id)}/messages`,{method:'POST',body:JSON.stringify({content})}),
};
