import { apiRequest } from "./apiClient.js";
import { workspaceService } from "./workspaceService.js";
import type { Generation, ModelRegistryItem } from "../types/index.js";
import type {
  UniversalGenerationQuote,
  UniversalGenerationRequest,
  UniversalGenerationStartRequest,
} from "../types/universalGeneration.js";

export type UniversalCreationRequest = UniversalGenerationRequest;
export type UniversalCreationQuote = UniversalGenerationQuote;

export interface UniversalBatchQuoteResult {
  items: Array<{
    key: string;
    ok: boolean;
    pricing?: {
      model_id: string;
      retail_credit_price: number;
      unit_credit_price?: number;
      has_sufficient_funds: boolean;
    };
    error?: { code?: string; message?: string };
  }>;
}

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

  quoteBatch(
    requests: Array<UniversalGenerationRequest & { key: string }>,
  ): Promise<UniversalBatchQuoteResult> {
    return apiRequest("/api/generations/quote-batch", {
      method: "POST",
      body: JSON.stringify({ requests }),
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

  get(id: string) {
    return apiRequest<Generation>(`/api/generations/${id}`);
  },

  list(max = 50) {
    return apiRequest<Generation[]>(
      `/api/generations?limit=${Math.min(100, max)}`,
    );
  },

  statusBatch(ids: string[]) {
    const generation_ids = Array.from(new Set(ids.filter(Boolean))).slice(
      0,
      24,
    );
    if (!generation_ids.length) return Promise.resolve([] as Generation[]);
    return apiRequest<Generation[]>("/api/generations/status-batch", {
      method: "POST",
      body: JSON.stringify({ generation_ids }),
    });
  },

  cancel(id: string) {
    return apiRequest<Generation>(`/api/generations/${id}/cancel`, {
      method: "POST",
    });
  },
};
