export type BatchStatus='DRAFT'|'READY'|'RUNNING'|'PAUSED'|'SUCCEEDED'|'PARTIAL'|'FAILED'|'CANCELLED';
export type BatchItemStatus='PENDING'|'RUNNING'|'SUCCEEDED'|'FAILED'|'SKIPPED'|'CANCELLED';
export type BatchSourceType='FLOW'|'APP'|'TEMPLATE';
export type BatchConditionOp='exists'|'equals'|'not_equals'|'contains'|'gt'|'gte'|'lt'|'lte'|'boolean';
export interface BatchCondition{path:string;op:BatchConditionOp;value?:any;}
export interface BatchItem{item_id:string;index:number;attempt:number;status:BatchItemStatus;input:Record<string,any>;flow_run_id:string|null;error_code:string|null;error_message:string|null;created_at:string;updated_at:string;}
export interface BatchRecord{
 batch_id:string;user_id:string;source_type:BatchSourceType;source_id:string;runtime_flow_id:string;source_revision:number;status:BatchStatus;item_count:number;progress:number;succeeded:number;failed:number;skipped:number;cancelled:number;concurrency:number;max_credits_per_item:number;max_total_credits:number;estimated_max_credits:number;variables:Record<string,string|number|boolean|null>;condition:BatchCondition|null;fan_out_path:string|null;items:BatchItem[];created_at:string;updated_at:string;started_at:string|null;completed_at:string|null;deleted_at:string|null;
}
