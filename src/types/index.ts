/**
 * Core Types & Interfaces for AI Generation Platform (Stage 1)
 * All financial values represent integer cents (e.g. R$ 10,50 = 1050).
 */

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'GENERATION_RESERVE'
  | 'GENERATION_CAPTURE'
  | 'GENERATION_RELEASE'
  | 'REFUND'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'PROMOTIONAL_CREDIT';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface WalletAccount {
  account_id: string; // matches user_id
  user_id: string;
  currency: 'BRL';
  available_balance_cents: number;
  reserved_balance_cents: number;
  total_balance_cents: number;
  total_deposited_cents: number;
  total_used_cents: number;
  updated_at: string;
}

export interface WalletTransaction {
  transaction_id: string;
  user_id: string;
  type: TransactionType;
  amount_cents: number;
  status: TransactionStatus;
  description: string;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  created_at: string;
  created_by: string;
}

export type GenerationStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'RESERVING_FUNDS'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Generation {
  generation_id: string;
  user_id: string;
  status: GenerationStatus;
  model_id: string;
  provider_id: string;
  original_prompt: string;
  compiled_prompt?: string;
  prompt_compiler_version?: string;
  duration_seconds?: number;
  resolution?: string;
  estimated_cost_cents?: number;
  maximum_authorized_cost_cents?: number;
  final_cost_cents?: number;
  currency: 'BRL';
  provider_job_id?: string;
  client_request_id?: string;
  created_at: string;
  submitted_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  result_asset_id?: string | null;
  error_code?: string | null;
}

export type AssetType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
export type AssetStatus = 'READY' | 'PROCESSING' | 'FAILED';

export interface Asset {
  asset_id: string;
  owner_user_id: string;
  type: AssetType;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  created_at: string;
  status: AssetStatus;
}

export type ModelCategory = 'VIDEO' | 'IMAGE' | 'AUDIO' | 'OTHER';
export type ModelStatus = 'ACTIVE' | 'INACTIVE' | 'EXPERIMENTAL';

export interface ModelRegistryItem {
  model_id: string;
  name: string;
  slug: string;
  category: ModelCategory;
  description: string;
  status: ModelStatus;
  created_at: string;
  updated_at: string;
}

export type ProviderStatus = 'ACTIVE' | 'INACTIVE' | 'DEGRADED';

export interface ProviderRegistryItem {
  provider_id: string;
  name: string;
  slug: string;
  status: ProviderStatus;
  priority: number;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderModelMapping {
  mapping_id: string;
  model_id: string;
  provider_id: string;
  provider_model_identifier: string;
  status: 'ACTIVE' | 'INACTIVE';
  capabilities?: string[];
  updated_at: string;
}

export interface PricingEntry {
  pricing_id: string;
  provider_id: string;
  model_id: string;
  resolution: string;
  duration_seconds?: number;
  unit: string;
  provider_cost_cents: number;
  customer_price_cents: number;
  currency: 'BRL';
  effective_from: string;
  effective_until?: string | null;
  active: boolean;
  updated_at: string;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface PromotionEntry {
  promotion_id: string;
  provider_id: string;
  model_id: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number; // percentage (1-100) or cents
  starts_at: string;
  expires_at: string;
  verified_at?: string;
  source_note?: string;
  active: boolean;
}

export interface FeatureFlag {
  flag_key: string;
  name: string;
  description: string;
  is_enabled: boolean;
  is_private: boolean;
  updated_at: string;
}

export interface AuditLog {
  log_id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  entity_type: 'USER' | 'PRICING' | 'PROVIDER' | 'MODEL' | 'PROMOTION' | 'FEATURE_FLAG' | 'WALLET';
  entity_id: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  reason: string;
  created_at: string;
}

export interface AppConfig {
  config_id: string;
  base_currency: 'BRL';
  supported_locales: string[];
  min_deposit_cents: number;
  max_price_change_percent_warning: number;
  pagination_default_limit: number;
  updated_at: string;
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type AppErrorCode =
  | 'AUTH_SESSION_INVALID'
  | 'AUTH_REQUIRED'
  | 'ADMIN_PERMISSION_REQUIRED'
  | 'USER_SUSPENDED'
  | 'WALLET_INSUFFICIENT_FUNDS'
  | 'INVALID_AMOUNT'
  | 'DUPLICATE_TRANSACTION'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'OPERATION_REJECTED'
  | 'PRICE_VARIATION_HIGH'
  | 'PROMOTION_EXPIRED';
