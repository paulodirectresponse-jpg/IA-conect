import { publicGenerationError } from "./publicGenerationError.js";

const SAFE_STORAGE_ERROR_CODE = /^ASSET_[A-Z0-9_]{1,70}$/;

/**
 * Exposes generation state without returning internal provider URLs as durable
 * results. A pending provider URL is returned separately so the owner can
 * preview output while the archive retry is running.
 */
export function publicGeneration(g: any) {
  const publicFailure =
    g.error_code || g.error_message
      ? publicGenerationError(
          { code: g.error_code, message: g.error_message },
          "A geração não pôde ser concluída.",
        )
      : null;
  const storagePending = g.media_storage_status === "PENDING";
  const pendingResultUrls = storagePending && Array.isArray(g.provider_result_urls)
    ? g.provider_result_urls
        .filter((url: unknown) => typeof url === "string" && /^https:\/\//i.test(url))
        .slice(0, 10)
    : undefined;
  const storageErrorCode = storagePending && SAFE_STORAGE_ERROR_CODE.test(String(g.media_storage_error_code || ""))
    ? String(g.media_storage_error_code)
    : null;

  return {
    generation_id: g.generation_id,
    user_id: g.user_id,
    status: g.status,
    model_id: g.model_id,
    capability_id: g.capability_id,
    requested_model_id: g.requested_model_id,
    routing_mode: g.routing_mode,
    provider_id: g.provider_id,
    routing_v2_route_id: g.routing_v2_route_id,
    mode: g.mode,
    original_prompt: g.original_prompt,
    compiled_prompt: g.compiled_prompt,
    prompt_compiler_version: g.prompt_compiler_version,
    negative_prompt: g.negative_prompt,
    duration_seconds: g.duration_seconds,
    resolution: g.resolution,
    aspect_ratio: g.aspect_ratio,
    number_of_outputs: g.number_of_outputs,
    seed: g.seed,
    motion_strength: g.motion_strength,
    audio_enabled: g.audio_enabled,
    model_variant: g.model_variant,
    references: g.references,
    retail_credit_price: g.retail_credit_price,
    final_credit_cost: g.final_credit_cost,
    client_request_id: g.client_request_id,
    progress_percent: g.progress_percent,
    result_asset_id: g.result_asset_id,
    result_asset_ids: g.result_asset_ids,
    result_url: storagePending ? null : g.result_url,
    result_urls: storagePending ? [] : g.result_urls,
    pending_result_urls: pendingResultUrls,
    thumbnail_url: storagePending ? null : g.thumbnail_url,
    media_storage_status: g.media_storage_status,
    media_storage_error_code: storageErrorCode,
    error_code: publicFailure?.code ?? null,
    error_message: publicFailure?.message ?? null,
    attempt_count: g.attempt_count,
    references_count: g.references_count,
    created_at: g.created_at,
    submitted_at: g.submitted_at,
    completed_at: g.completed_at,
    failed_at: g.failed_at,
  };
}
