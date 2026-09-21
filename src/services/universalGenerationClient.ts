import { apiRequest } from "./apiClient.js";
import { generationClient } from "./generationClient.js";
import { workspaceService } from "./workspaceService.js";
import type { Generation, ModelRegistryItem } from "../types/index.js";
import type {
  UniversalGenerationQuote,
  UniversalGenerationRequest,
  UniversalGenerationStartRequest,
} from "../types/universalGeneration.js";

export type UniversalCreationRequest = UniversalGenerationRequest;
export type UniversalCreationQuote = UniversalGenerationQuote;

export const universalGenerationClient = {
  async catalog(capabilityId: string): Promise<ModelRegistryItem[]> {
    return (await workspaceService.listModels()).filter(
      (model) =>
        model.readiness === "READY" &&
        model.capabilities_ready?.includes(capabilityId),
    );
  },

  quote(request: UniversalGenerationRequest) {
    return apiRequest<UniversalGenerationQuote>("/api/generations/quote", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  create(
    request: UniversalGenerationRequest,
    quote: UniversalGenerationQuote,
  ): Promise<Generation> {
    const start: UniversalGenerationStartRequest = {
      ...request,
      authorized_credit_price: quote.credit_price,
      client_request_id: quote.request_draft.request_id,
      retail_pricing_id:
        typeof quote.request_draft.retail_pricing_id === "string"
          ? quote.request_draft.retail_pricing_id
          : undefined,
      pricing_signature_hash:
        typeof quote.request_draft.pricing_signature_hash === "string"
          ? quote.request_draft.pricing_signature_hash
          : undefined,
    };
    return apiRequest("/api/generations", {
      method: "POST",
      body: JSON.stringify(start),
    });
  },

  get: generationClient.get,
  cancel: generationClient.cancel,
};
