import { GenerationMode } from '../../src/types/index.js';
import { ResolvedAssetReference } from '../services/assetReferenceResolver.js';

export interface ProviderGenerationReference extends ResolvedAssetReference {
  slot_type?: 'INITIAL' | 'END' | 'GENERAL';
  /** Local alias visible inside the current job prompt, e.g. img1/video1/audio1. */
  prompt_alias?: string;
  semantic_role?: 'CHARACTER'|'PRODUCT'|'STYLE'|'GENERAL';
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
  /** Cost-affecting dimensions must be forwarded identically to quote and execution. */
  audio_enabled?: boolean;
  model_variant?: string;
  pricing_options?: Record<string,string|number|boolean|null|undefined>;
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
  result_video_url?: string;
  result_image_urls?: string[];
  result_urls?: string[];
  thumbnail_url?: string;
  error_code?: string;
  error_message?: string;
}

export interface VideoProviderAdapter {
  readonly providerId: string;
  readonly name: string;
  isConfigured(): boolean;
  supports(modelId: string, mode: GenerationMode): boolean;
  quoteCostUsd?(params: ProviderGenerationParams): Promise<ProviderCostQuote>;
  submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult>;
  checkStatus(providerJobId: string): Promise<ProviderJobStatusResult>;
  cancelJob?(providerJobId: string): Promise<boolean>;
}
