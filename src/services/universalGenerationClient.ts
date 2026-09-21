import { apiRequest } from "./apiClient.js";
import { generationClient } from "./generationClient.js";
import { workspaceService } from "./workspaceService.js";
import type { Generation, ModelRegistryItem } from "../types/index.js";

export interface UniversalCreationRequest {
  model_id: string;
  capability_id: string;
  prompt: string;
  negative_prompt?: string;
  references?: Array<{
    asset_id: string;
    slot_type?: "INITIAL" | "END" | "GENERAL";
    role?: "SOURCE" | "MASK" | "REFERENCE";
  }>;
  controls?: Record<string, string | number | boolean | null | undefined>;
}
export interface UniversalCreationQuote {
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
  request_draft: any;
  notice: string;
}

export const universalGenerationClient = {
  async catalog(capabilityId: string): Promise<ModelRegistryItem[]> {
    return (await workspaceService.listModels()).filter(
      (model) => model.readiness === "READY" &&
        model.capabilities_ready?.includes(capabilityId),
    );
  },
  quote(request: UniversalCreationRequest) {
    return apiRequest<UniversalCreationQuote>("/api/generations/quote", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
  create(
    request: UniversalCreationRequest,
    quote: UniversalCreationQuote,
  ): Promise<Generation> {
    return apiRequest("/api/generations", {
      method: "POST",
      body: JSON.stringify({
        ...request,
        model_id: request.model_id,
        authorized_credit_price: quote.credit_price,
        client_request_id: quote.request_draft.request_id,
      }),
    });
  },
  get: generationClient.get,
  cancel: generationClient.cancel,
};
