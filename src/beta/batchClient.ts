import{apiRequest}from'../services/apiClient.js';
export type BatchStatus='DRAFT'|'READY'|'RUNNING'|'PAUSED'|'SUCCEEDED'|'PARTIAL'|'FAILED'|'CANCELLED';
export interface BatchView{batch_id:string;source_type:'FLOW'|'APP'|'TEMPLATE';source_id:string;source_revision:number;status:BatchStatus;item_count:number;progress:number;succeeded:number;failed:number;skipped:number;cancelled:number;concurrency:number;max_credits_per_item:number;max_total_credits:number;estimated_max_credits:number;created_at:string;updated_at:string;items:Array<{item_id:string;index:number;status:string;flow_run_id:string|null;error_message:string|null}>;}
const post=(path:string)=>apiRequest<BatchView>(path,{method:'POST',body:'{}'});
export const batchClient={
 list:()=>apiRequest<BatchView[]>('/api/beta/batches'),
 create:(input:any)=>apiRequest<BatchView>('/api/beta/batches',{method:'POST',headers:{'Idempotency-Key':`batch:${Date.now()}:${Math.random().toString(36).slice(2)}`},body:JSON.stringify(input)}),
 get:(id:string)=>apiRequest<BatchView>(`/api/beta/batches/${encodeURIComponent(id)}`),
 confirm:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/confirm`),advance:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/advance`),pause:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/pause`),resume:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/resume`),retry:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/retry`),cancel:(id:string)=>post(`/api/beta/batches/${encodeURIComponent(id)}/cancel`),
};
