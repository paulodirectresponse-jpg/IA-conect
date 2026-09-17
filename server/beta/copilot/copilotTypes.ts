export type CopilotIntent='CREATE_PROJECT'|'UPDATE_PROJECT'|'CREATE_FLOW'|'UPDATE_FLOW'|'CREATE_TEMPLATE'|'UPDATE_TEMPLATE'|'CREATE_APP'|'UPDATE_APP'|'GENERAL_GUIDANCE';
export type CopilotMutationKind='CREATE_PROJECT'|'UPDATE_PROJECT_METADATA'|'CREATE_FLOW_DRAFT'|'UPDATE_FLOW_METADATA'|'CREATE_TEMPLATE_FROM_FLOW'|'UPDATE_TEMPLATE_METADATA'|'CREATE_APP_FROM_FLOW'|'UPDATE_APP_METADATA';
export interface CopilotMutation{kind:CopilotMutationKind;input:Record<string,any>;}
export interface CopilotProposalRecord{
 proposal_id:string;owner_user_id:string;context_id:string|null;context_revision:number|null;message:string;intent:CopilotIntent;
 summary:string;steps:string[];mutations:CopilotMutation[];requires_confirmation:boolean;status:'PENDING'|'APPLIED'|'CANCELLED';
 result:any|null;created_at:string;updated_at:string;
}
