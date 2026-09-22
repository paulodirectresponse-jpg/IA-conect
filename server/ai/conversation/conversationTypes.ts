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
 tool_request:AiToolRequest|null;
}


export type AiConversationActionStatus='DRAFT'|'UNAVAILABLE'|'QUOTING'|'AWAITING_CONFIRMATION'|'CONFIRMED'|'QUEUED'|'RUNNING'|'PARTIAL_SUCCESS'|'SUCCEEDED'|'FAILED'|'CANCELLED';

export interface AiToolRequest{
 capability_id:string;
 generation_prompt:string;
 negative_prompt:string|null;
 model_preference:string|null;
 quantity:number;
 controls:Record<string,string|number|boolean|null>;
 reference_terms:string[];
 reason:string;
}

export interface AiConversationActionDraft{
 action_id:string;
 conversation_id:string;
 owner_user_id:string;
 message_id:string;
 capability_id:string;
 tool_label:string;
 generation_prompt:string;
 negative_prompt:string|null;
 model_id:string;
 quantity:number;
 controls:Record<string,string|number|boolean|null>;
 reference_terms:string[];
 resolved_references:Array<{asset_id:string;slot_type:'INITIAL'|'END'|'GENERAL';role:'SOURCE'|'MASK'|'REFERENCE';alias:string}>;
 unresolved_references:string[];
 compatible_model_ids:string[];
 status:AiConversationActionStatus;
 unavailable_reason:string|null;
 job_id:string|null;
 selected_model_id:string|null;
 quote_credit_price:number|null;
 quote_expires_at:string|null;
 confirmed_at:string|null;
 result_asset_ids:string[];
 result_assets:Array<{asset_id:string;type:'IMAGE'|'VIDEO'|'AUDIO'|'MODEL_3D';name:string;public_url:string;thumbnail_url:string;preview_url:string|null;width:number|null;height:number|null;duration_seconds:number|null}>;
 execution_jobs:Array<{job_id:string;quantity:number;credit_price:number;status:string;result_asset_ids:string[]}>;
 parent_action_id:string|null;
 error_code:string|null;
 error_message:string|null;
 created_at:string;
 updated_at:string;
}

export interface AiToolPlan{
 action:AiConversationActionDraft|null;
 tool_request:AiToolRequest|null;
}
