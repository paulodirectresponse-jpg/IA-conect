export type UniversalGenerationControlValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface UniversalGenerationReference {
  asset_id: string;
  slot_type?: "INITIAL" | "END" | "GENERAL";
  role?: "SOURCE" | "MASK" | "REFERENCE";
  alias?: string;
}

export interface UniversalGenerationRequest {
  model_id: string;
  capability_id: string;
  prompt: string;
  negative_prompt?: string;
  references?: UniversalGenerationReference[];
  controls?: Record<string, UniversalGenerationControlValue>;
}

export interface UniversalGenerationQuote {
  resolved_model_id: string;
  requested_model_id: string;
  routing_mode: "MANUAL" | "AUTO";
  route_decision: { route_id: string; provider_id: string };
  credit_price: number;
  unit_price: number;
  pricing_source: string;
  valid_until: string;
  sufficient_funds: boolean;
  compatible_controls: Record<string, unknown>;
  request_draft: {
    request_id: string;
    retail_pricing_id?: string;
    pricing_signature_hash?: string;
    [key: string]: unknown;
  };
  notice: string;
}

export interface UniversalGenerationStartRequest
  extends UniversalGenerationRequest {
  authorized_credit_price: number;
  client_request_id: string;
  retail_pricing_id?: string;
  pricing_signature_hash?: string;
}
