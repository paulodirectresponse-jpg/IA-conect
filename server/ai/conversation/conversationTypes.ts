export type ConversationRole='USER'|'ASSISTANT';

export interface AiConversationRecord{
 conversation_id:string;
 owner_user_id:string;
 title:string;
 logical_model_id:string;
 message_count:number;
 created_at:string;
 updated_at:string;
 deleted_at:string|null;
}

export interface AiConversationMessage{
 message_id:string;
 conversation_id:string;
 owner_user_id:string;
 role:ConversationRole;
 content:string;
 model_id:string|null;
 created_at:string;
}

export interface ConversationalModelConfig{
 logical_model_id:string;
 display_name:string;
 provider:'GOOGLE';
 primary_model:string;
 fallback_model:string|null;
 temperature:number;
 max_output_tokens:number;
 enabled:boolean;
}
