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


export type AiConversationIntent=
 |'GENERAL_CONVERSATION'
 |'IDEATION'
 |'IMAGE_GENERATION'
 |'IMAGE_EDIT'
 |'VIDEO_GENERATION'
 |'VIDEO_EDIT'
 |'AUDIO_GENERATION'
 |'THREE_D_GENERATION'
 |'BATCH_GENERATION'
 |'OTHER_TOOL_ACTION';

export type AiIntentReadiness='CONVERSATION'|'NEEDS_CLARIFICATION'|'READY_FOR_ACTION';

export interface AiConversationReference{
 label:string;
 kind:'TEXTUAL'|'ASSET'|'MESSAGE'|'UNKNOWN';
 value:string;
 message_id:string|null;
 asset_id:string|null;
}

export interface AiCreativeState{
 objective:string|null;
 product:string|null;
 audience:string|null;
 visual_style:string|null;
 narrative:string|null;
 characters:string[];
 locations:string[];
 continuity_notes:string[];
 approved_decisions:string[];
 rejected_decisions:string[];
}

export interface AiConversationContext{
 conversation_id:string;
 owner_user_id:string;
 summary:string;
 creative_state:AiCreativeState;
 references:AiConversationReference[];
 last_intent:AiConversationIntent;
 readiness:AiIntentReadiness;
 missing_information:string[];
 revision:number;
 created_at:string;
 updated_at:string;
}

export interface AiModelTurn{
 content:string;
 model_id:string;
 logical_model_id:string;
 intent:AiConversationIntent;
 readiness:AiIntentReadiness;
 missing_information:string[];
 conversation_summary:string;
 creative_state_delta:Partial<AiCreativeState>;
 reference_terms:string[];
}
