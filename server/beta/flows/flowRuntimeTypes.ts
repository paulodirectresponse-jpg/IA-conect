import { CapabilityMediaType } from '../capabilityRegistry.js';
import { BetaFlowGraph } from './flowTypes.js';
import { BetaFlowEconomicStatus } from './flowEconomicsTypes.js';

export type BetaFlowRunStatus='RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export type BetaFlowNodeRunStatus='WAITING'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';

export interface BetaFlowValue{
  media_type:CapabilityMediaType;
  text?:string|null;
  asset_ids?:string[];
  structured?:Record<string,any>|null;
  source_node_id?:string|null;
}
export interface BetaFlowRun{
  run_id:string;
  flow_id:string;
  flow_revision:number;
  user_id:string;
  status:BetaFlowRunStatus;
  graph:BetaFlowGraph;
  active_node_ids:string[];
  inputs:Record<string,BetaFlowValue>;
  outputs:Record<string,BetaFlowValue[]>;
  flow_quote_id:string;
  budget_credit_limit:number;
  authorized_credits_total:number;
  captured_credits_total:number;
  released_credits_total:number;
  in_flight_credits_total:number;
  remaining_budget_credits:number;
  economic_status:BetaFlowEconomicStatus;
  error_code?:string|null;
  error_message?:string|null;
  idempotency_fingerprint:string;
  created_at:string;
  updated_at:string;
  started_at:string;
  completed_at?:string|null;
  failed_at?:string|null;
  cancelled_at?:string|null;
}
export interface BetaFlowNodeRun{
  node_run_id:string;
  run_id:string;
  flow_id:string;
  user_id:string;
  node_id:string;
  status:BetaFlowNodeRunStatus;
  job_id?:string|null;
  retry_count:number;
  authorized_credit_price:number;
  inputs:BetaFlowValue[];
  outputs:BetaFlowValue[];
  input_asset_ids:string[];
  output_asset_ids:string[];
  error_code?:string|null;
  error_message?:string|null;
  created_at:string;
  updated_at:string;
  started_at?:string|null;
  completed_at?:string|null;
}
