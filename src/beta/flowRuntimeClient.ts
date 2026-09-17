import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityMediaType } from './capabilityClient.js';
import { FlowGraph } from './flowClient.js';

export type FlowRunStatus='RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface FlowRuntimeValue{
  media_type:BetaCapabilityMediaType;
  text?:string|null;
  asset_ids?:string[];
  structured?:Record<string,any>|null;
  source_node_id?:string|null;
}
declare global{
  interface ObjectConstructor{
    entries(o:Record<string,FlowRuntimeValue[]>):[string,FlowRuntimeValue[]][];
  }
}
export interface FlowNodeRunView{
  node_run_id:string;run_id:string;flow_id:string;user_id:string;node_id:string;status:'WAITING'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
  job_id?:string|null;retry_count:number;authorized_credit_price:number;inputs:FlowRuntimeValue[];outputs:FlowRuntimeValue[];
  input_asset_ids:string[];output_asset_ids:string[];error_code?:string|null;error_message?:string|null;created_at:string;updated_at:string;started_at?:string|null;completed_at?:string|null;
}
export interface FlowRunView{
  run_id:string;flow_id:string;flow_revision:number;user_id:string;status:FlowRunStatus;graph:FlowGraph;active_node_ids:string[];
  inputs:Record<string,FlowRuntimeValue>;outputs:Record<string,FlowRuntimeValue[]>;authorized_credits_total:number;
  error_code?:string|null;error_message?:string|null;created_at:string;updated_at:string;started_at:string;completed_at?:string|null;failed_at?:string|null;cancelled_at?:string|null;
  node_runs:FlowNodeRunView[];
}
function key(scope:string){const id=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);return `${scope}:${id}`;}
export const betaFlowRuntimeClient={
  start(flowId:string,inputs:Record<string,any>,idempotencyKey=key('flow-start')){
    return apiRequest<FlowRunView>(`/api/beta/flows/${encodeURIComponent(flowId)}/runs`,{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify({inputs})});
  },
  get(runId:string){return apiRequest<FlowRunView>(`/api/beta/flow-runs/${encodeURIComponent(runId)}`);},
  list(limit=30){return apiRequest<FlowRunView[]>(`/api/beta/flow-runs?limit=${Math.min(100,Math.max(1,limit))}`);},
  advance(runId:string){return apiRequest<FlowRunView>(`/api/beta/flow-runs/${encodeURIComponent(runId)}/advance`,{method:'POST'});},
  retry(runId:string){return apiRequest<FlowRunView>(`/api/beta/flow-runs/${encodeURIComponent(runId)}/retry`,{method:'POST'});},
  cancel(runId:string){return apiRequest<FlowRunView>(`/api/beta/flow-runs/${encodeURIComponent(runId)}/cancel`,{method:'POST'});},
};
