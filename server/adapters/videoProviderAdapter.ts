import { GenerationMode } from '../../src/types/index.js';
import { ResolvedAssetReference } from '../services/assetReferenceResolver.js';

export interface ProviderGenerationReference extends ResolvedAssetReference {
  slot_type?: 'INITIAL' | 'END' | 'GENERAL';
  /** Local alias visible inside the current job prompt, e.g. img1/video1/audio1. */
  prompt_alias?: string;
  role?: 'SOURCE'|'MASK'|'REFERENCE';
}

export interface ProviderGenerationParams {
  generation_id: string;
  user_id: string;
  model_id: string;
  mode: GenerationMode;
  capability_id?: string;
  provider_model_identifier?: string;
  provider_runtime_options?: Record<string,string|number|boolean|null|undefined>;
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
  /** LIVE_API is provider-calculated; CATALOG/MANUAL are allowed only after verification. */
  source: 'LIVE_API'|'CATALOG'|'MANUAL';
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
  result_text?: string;
  result_structured?: Record<string,any>|null;
  thumbnail_url?: string;
  error_code?: string;
  error_message?: string;
}

export interface VideoProviderAdapter {
  readonly providerId: string;
  readonly name: string;
  isConfigured(): boolean;
  supports(modelId: string, mode: GenerationMode, providerModelIdentifier?: string): boolean;
  quoteCostUsd?(params: ProviderGenerationParams): Promise<ProviderCostQuote>;
  submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult>;
  checkStatus(providerJobId: string): Promise<ProviderJobStatusResult>;
  cancelJob?(providerJobId: string): Promise<boolean>;
}
