import { CapabilityId } from '../capabilityRegistry.js';

export type BetaJobStatus='DRAFT'|'QUOTED'|'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export type BetaJobAttemptStatus='QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';

export interface BetaJobReference {
  asset_id:string;
  slot_type?:'INITIAL'|'END'|'GENERAL';
  alias?:string;
}

export interface BetaJobRequest {
  capability_id:CapabilityId;
  model_id:string;
  prompt:string;
  negative_prompt?:string;
  references:BetaJobReference[];
  controls:{
    duration_seconds?:number;
    resolution?:string;
    aspect_ratio?:string;
    number_of_outputs?:number;
    seed?:number|null;
    motion_strength?:number|null;
    audio_enabled?:boolean;
    model_variant?:string;
    pricing_options?:Record<string,string|number|boolean|null|undefined>;
    language?:string;
    voice?:string;
    output_format?:string;
    style?:string;
    instrumental?:boolean;
    timestamps?:boolean;
    source_language?:string;
    target_language?:string;
    voice_clone_consent?:boolean;
    voice_label?:string;
  };
}

export interface BetaJobQuote {
  credit_price:number;
  retail_pricing_id:string;
  retail_pricing_version:number;
  pricing_signature_hash:string;
  requested_model_id:string;
  selected_model_id:string;
  routing_mode:'MANUAL'|'AUTO';
  pricing_policy_id:string;
  quoted_at:string;
  expires_at:string;
}

export interface BetaJob {
  job_id:string;
  user_id:string;
  status:BetaJobStatus;
  request:BetaJobRequest;
  quote?:BetaJobQuote|null;
  linked_generation_id?:string|null;
  current_attempt_id?:string|null;
  attempt_count:number;
  error_code?:string|null;
  error_message?:string|null;
  result_asset_ids?:string[];
  result_text?:string|null;
  result_structured?:Record<string,any>|null;
  idempotency_fingerprint:string;
  created_at:string;
  updated_at:string;
  quoted_at?:string|null;
  queued_at?:string|null;
  started_at?:string|null;
  completed_at?:string|null;
  failed_at?:string|null;
  cancelled_at?:string|null;
}

export interface BetaJobAttempt {
  attempt_id:string;
  job_id:string;
  user_id:string;
  attempt_number:number;
  status:BetaJobAttemptStatus;
  execution_key:string;
  generation_id?:string|null;
  error_code?:string|null;
  error_message?:string|null;
  created_at:string;
  updated_at:string;
  started_at?:string|null;
  completed_at?:string|null;
}

export interface BetaJobMutation {
  mutation_id:string;
  user_id:string;
  job_id:string;
  action:'QUOTE'|'QUEUE'|'RETRY'|'CANCEL';
  status:'RUNNING'|'COMPLETED'|'FAILED';
  created_at:string;
  updated_at:string;
  error_code?:string|null;
}
