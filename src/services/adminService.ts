import { apiRequest } from './apiClient.js';
import {
  UserProfile,
  WalletAccount,
  WalletTransaction,
  ModelRegistryItem,
  ProviderRegistryItem,
  PricingEntry,
  PromotionEntry,
  FeatureFlag,
  AuditLog,
} from '../types/index.js';

export const adminService = {
  async getDashboardStats() {
    return apiRequest<any>('/api/admin/dashboard-stats');
  },

  async listUsers(search = '', limit = 20, offset = 0) {
    const q = encodeURIComponent(search);
    return apiRequest<{ users: UserProfile[]; total: number }>(
      `/api/admin/users?search=${q}&limit=${limit}&offset=${offset}`
    );
  },

  async getUserDetails(userId: string) {
    return apiRequest<{ user: UserProfile; wallet: WalletAccount; recent_transactions: WalletTransaction[] }>(
      `/api/admin/users/${userId}`
    );
  },

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    return apiRequest<UserProfile>(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  async adjustBalance(
    userId: string,
    type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT',
    amount_cents: number,
    reason: string,
    idempotency_key?: string
  ) {
    return apiRequest<{ transaction: WalletTransaction; account: WalletAccount }>(
      `/api/admin/users/${userId}/adjust-balance`,
      {
        method: 'POST',
        body: JSON.stringify({
          type,
          amount_cents,
          reason,
          idempotency_key,
        }),
      }
    );
  },

  async listModels() {
    return apiRequest<ModelRegistryItem[]>('/api/catalog/models');
  },

  async saveModel(data: Partial<ModelRegistryItem>) {
    return apiRequest<ModelRegistryItem>('/api/admin/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateModel(modelId: string, data: Partial<ModelRegistryItem>) {
    return apiRequest<ModelRegistryItem>(`/api/admin/models/${modelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listProviders() {
    return apiRequest<ProviderRegistryItem[]>('/api/catalog/providers');
  },

  async saveProvider(data: Partial<ProviderRegistryItem>) {
    return apiRequest<ProviderRegistryItem>('/api/admin/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProvider(providerId: string, data: Partial<ProviderRegistryItem>) {
    return apiRequest<ProviderRegistryItem>(`/api/admin/providers/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listPricing() {
    return apiRequest<PricingEntry[]>('/api/catalog/pricing');
  },

  async savePricing(pricing: Partial<PricingEntry>, reason: string, confirmed_high_variation = false) {
    return apiRequest<PricingEntry>('/api/admin/pricing', {
      method: 'POST',
      body: JSON.stringify({ pricing, reason, confirmed_high_variation }),
    });
  },

  async listPromotions() {
    return apiRequest<PromotionEntry[]>('/api/catalog/promotions');
  },

  async savePromotion(data: Partial<PromotionEntry>) {
    return apiRequest<PromotionEntry>('/api/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePromotion(promotionId: string, data: Partial<PromotionEntry>) {
    return apiRequest<PromotionEntry>(`/api/admin/promotions/${promotionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listFeatureFlags() {
    return apiRequest<FeatureFlag[]>('/api/admin/feature-flags');
  },

  async toggleFeatureFlag(flag_key: string, is_enabled: boolean, reason: string) {
    return apiRequest<FeatureFlag>('/api/admin/feature-flags/toggle', {
      method: 'POST',
      body: JSON.stringify({ flag_key, is_enabled, reason }),
    });
  },

  async listAuditLogs(entity_type = '', limit = 20, offset = 0) {
    const q = entity_type ? `&entity_type=${encodeURIComponent(entity_type)}` : '';
    return apiRequest<{ logs: AuditLog[]; total: number }>(
      `/api/admin/audit-logs?limit=${limit}&offset=${offset}${q}`
    );
  },
};
