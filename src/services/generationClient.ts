import { apiRequest } from "./apiClient.js";
import {
  Generation,
  GenerationMode,
  GenerationRequestDraft,
  WorkspaceReference,
} from "../types/index.js";
import type {
  UniversalGenerationControlValue,
  UniversalGenerationReference,
  UniversalGenerationRequest,
  UniversalGenerationStartRequest,
} from "../types/universalGeneration.js";
import { canonicalReferenceSlot } from "../utils/generationReferenceMode.js";

export interface GenerationQuoteParams {
  model_id: string;
  mode: GenerationMode;
  prompt: string;
  negative_prompt?: string;
  references: WorkspaceReference[];
  settings: {
    duration_seconds?: number;
    resolution?: string;
    aspect_ratio?: string;
    number_of_outputs: number;
    seed?: number | null;
    motion_strength?: number;
    audio_enabled?: boolean;
    model_variant?: string;
    pricing_options?: Record<
      string,
      string | number | boolean | null | undefined
    >;
  };
}

export type PricedGenerationDraft = GenerationRequestDraft & {
  has_sufficient_funds: boolean;
  unit_credit_price?: number;
  pricing_unit?: string;
  base_duration_seconds?: number;
  billing_units?: number;
};

export type GenerationQuoteResult = {
  resolved_model_id: string;
  requested_model_id: string;
  credit_price: number;
  sufficient_funds: boolean;
  request_draft: PricedGenerationDraft;
  notice: string;
};
export type GenerationBatchQuoteResult = {
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
};

function capabilityForLegacyMode(mode: GenerationMode): string {
  const byMode: Partial<Record<GenerationMode, string>> = {
    TEXT_TO_IMAGE: "text-to-image",
    IMAGE_TO_IMAGE: "image-to-image",
    TEXT_TO_VIDEO: "text-to-video",
    IMAGE_TO_VIDEO: "image-to-video",
    REFERENCE_TO_VIDEO: "image-to-video",
    VIDEO_TO_VIDEO: "video-edit",
    TEXT_TO_SPEECH: "text-to-speech",
    AUDIO_TO_TEXT: "transcription",
    MEDIA_TO_TEXT: "subtitles",
    MEDIA_DUBBING: "dubbing",
    TEXT_TO_3D: "text-to-3d",
    IMAGE_TO_3D: "image-to-3d",
    MULTI_IMAGE_TO_3D: "multi-image-to-3d",
  };
  const capability = byMode[mode];
  if (!capability) {
    throw new Error(
      `Capability explícita é obrigatória para o modo legado ${mode}.`,
    );
  }
  return capability;
}

function normalizeReferences(
  mode: GenerationMode,
  refs: WorkspaceReference[] = [],
): UniversalGenerationReference[] {
  const hasExplicitRoles = refs.some(
    (reference) => canonicalReferenceSlot(reference) !== "GENERAL",
  );
  return refs.map((reference, index) => {
    let slot_type = canonicalReferenceSlot(reference);
    if (!hasExplicitRoles && mode === "IMAGE_TO_VIDEO") {
      slot_type = index === 0 ? "INITIAL" : index === 1 ? "END" : "GENERAL";
    }
    return {
      asset_id: reference.asset_id,
      slot_type,
      alias: reference.alias_snapshot,
    };
  });
}

function compactControls(
  settings: GenerationQuoteParams["settings"],
): Record<string, UniversalGenerationControlValue> {
  const controls: Record<string, UniversalGenerationControlValue> = {
    number_of_outputs: settings.number_of_outputs,
  };
  if (Number(settings.duration_seconds) > 0)
    controls.duration_seconds = Number(settings.duration_seconds);
  if (settings.resolution) controls.resolution = settings.resolution;
  if (settings.aspect_ratio) controls.aspect_ratio = settings.aspect_ratio;
  if (settings.seed !== undefined) controls.seed = settings.seed;
  if (settings.motion_strength !== undefined)
    controls.motion_strength = settings.motion_strength;
  if (settings.audio_enabled !== undefined)
    controls.audio_enabled = settings.audio_enabled;
  if (settings.model_variant) controls.model_variant = settings.model_variant;
  if (settings.pricing_options)
    controls.pricing_options = settings.pricing_options;
  return controls;
}

function canonicalQuoteRequest(
  params: GenerationQuoteParams,
): UniversalGenerationRequest {
  return {
    model_id: params.model_id,
    capability_id: capabilityForLegacyMode(params.mode),
    prompt: params.prompt,
    negative_prompt: params.negative_prompt,
    references: normalizeReferences(params.mode, params.references),
    controls: compactControls(params.settings),
  };
}

function canonicalStartRequest(
  draft: GenerationRequestDraft,
): UniversalGenerationStartRequest {
  const settings = draft.settings || ({} as GenerationRequestDraft["settings"]);
  const controls = compactControls({
    duration_seconds: settings.duration_seconds,
    resolution: settings.resolution,
    aspect_ratio: settings.aspect_ratio,
    number_of_outputs: settings.number_of_outputs,
    seed: settings.seed,
    motion_strength: settings.motion_strength,
    audio_enabled: settings.audio_enabled,
    model_variant: settings.model_variant,
    pricing_options: settings.pricing_options,
  });
  return {
    model_id: draft.requested_model_id || draft.model_id,
    capability_id:
      draft.capability_id || capabilityForLegacyMode(draft.mode),
    prompt: draft.prompt,
    negative_prompt: (draft as any).negative_prompt,
    references: normalizeReferences(draft.mode, draft.references || []),
    controls,
    client_request_id: draft.request_id,
    authorized_credit_price: draft.authorized_credit_price,
    retail_pricing_id: draft.retail_pricing_id,
    pricing_signature_hash: draft.pricing_signature_hash,
  };
}

export const generationClient = {
  quote(params: GenerationQuoteParams): Promise<GenerationQuoteResult> {
    return apiRequest("/api/generations/quote", {
      method: "POST",
      body: JSON.stringify(canonicalQuoteRequest(params)),
    });
  },

  quoteBatch(
    requests: Array<GenerationQuoteParams & { key: string }>,
  ): Promise<GenerationBatchQuoteResult> {
    return apiRequest("/api/generations/quote-batch", {
      method: "POST",
      body: JSON.stringify({
        requests: requests.map(({ key, ...request }) => ({
          key,
          ...canonicalQuoteRequest(request),
        })),
      }),
    });
  },

  create(draft: GenerationRequestDraft): Promise<Generation> {
    return apiRequest<Generation>("/api/generations", {
      method: "POST",
      body: JSON.stringify(canonicalStartRequest(draft)),
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
