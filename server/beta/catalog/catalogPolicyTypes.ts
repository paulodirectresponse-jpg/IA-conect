import { CapabilityId } from '../capabilityRegistry.js';

export interface BetaPricingPolicy {
  pricing_policy_id:string;
  name:string;
  quote_ttl_seconds:number;
  active:boolean;
  created_at:string;
  updated_at:string;
  updated_by?:string|null;
}

export interface BetaModelPolicy {
  model_id:string;
  pricing_policy_id:string;
  capability_ids:CapabilityId[];
  enabled:boolean;
  auto_routing_enabled:boolean;
  created_at:string;
  updated_at:string;
  updated_by?:string|null;
}

export type BetaEconomicLedgerEventType='QUOTE_AUTHORIZED'|'EXECUTION_STARTED'|'EXECUTION_LINKED';

export interface BetaEconomicLedgerEvent {
  event_id:string;
  event_type:BetaEconomicLedgerEventType;
  user_id:string;
  job_id:string;
  generation_id?:string|null;
  requested_model_id:string;
  selected_model_id:string;
  routing_mode:'MANUAL'|'AUTO';
  pricing_policy_id:string;
  retail_pricing_id:string;
  pricing_signature_hash:string;
  credit_price:number;
  quote_expires_at:string;
  created_at:string;
}
