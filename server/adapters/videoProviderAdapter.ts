import { GenerationMode } from '../../src/types/index.js';
import { ResolvedAssetReference } from '../services/assetReferenceResolver.js';

export interface ProviderGenerationReference extends ResolvedAssetReference {
  slot_type?: 'INITIAL' | 'END' | 'GENERAL';
  /** Local alias visible inside the current job prompt, e.g. img1/video1/audio1. */
  prompt_alias?: string;
}

export interface ProviderGenerationParams {
  generation_id: string;
  user_id: string;
  model_id: string;
  mode: GenerationMode;
  prompt: string;
  negative_prompt?: string;
  duration_seconds: number;
  resolution: string;
  aspect_ratio: string;
  number_of_outputs: number;
  seed?: number | null;
  motion_strength?: number | null;
  references: ProviderGenerationReference[];
  callback_url?: string;
}

export interface ProviderCostQuote {
  effective_price_usd: number;
  list_price_usd?: number | null;
  discount_rate?: number | null;
  estimated?: boolean;
  source: 'LIVE_API';
}

export interface ProviderJobResult {
  provider_job_id: string;
  provider_id: string;
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  estimated_duration_seconds?: number;
  provider_cost_cents?: number;
}

export interface ProviderJobStatusResult {
  provider_job_id: string;
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  progress_percent?: number;
  /** First/primary video URL for video generations. */
  result_video_url?: string;
  /** One or more image URLs for image generations. */
  result_image_urls?: string[];
  /** Generic media outputs when a provider does not distinguish type. */
  result_urls?: string[];
  thumbnail_url?: string;
  error_code?: string;
  error_message?: string;
  final_cost_cents?: number;
}

/**
 * Historical name kept to avoid a breaking import migration. The contract now
 * supports both image and video generation modes.
 */
export interface VideoProviderAdapter {
  readonly providerId: string;
  readonly name: string;
  isConfigured(): boolean;
  supports(modelId: string, mode: GenerationMode): boolean;
  /** Exact/pre-flight provider quote. Absence means the provider cannot be used in anti-loss routing. */
  quoteCostUsd?(params: ProviderGenerationParams): Promise<ProviderCostQuote>;
  submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult>;
  checkStatus(providerJobId: string): Promise<ProviderJobStatusResult>;
  cancelJob?(providerJobId: string): Promise<boolean>;
}
