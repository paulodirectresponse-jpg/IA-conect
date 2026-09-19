import { RoutingV2Provider } from './domain.js';
import { RoutingV2ProviderHealth } from './adapter.js';
import { checkProviderHealth } from './healthAdapter.js';
import { routingV2Repository } from './repository.js';

const now = () => new Date().toISOString();

export interface ProviderHealthCheckResult {
  provider_id: string;
  provider_name: string;
  health_status: string;
  checked_at: string;
  message?: string;
  error?: string;
}

export const providerHealthService = {
  async checkAndPersist(provider: RoutingV2Provider): Promise<ProviderHealthCheckResult> {
    try {
      const health = await checkProviderHealth(provider);
      const checkedAt = health.checked_at || now();

      const updated: RoutingV2Provider = {
        ...provider,
        health_status: health.status,
        last_health_check_at: checkedAt,
        updated_at: checkedAt,
      };

      await routingV2Repository.saveProvider(updated);

      return {
        provider_id: provider.provider_id,
        provider_name: provider.name,
        health_status: health.status,
        checked_at: checkedAt,
        message: health.message,
      };
    } catch (error: any) {
      const checkedAt = now();
      return {
        provider_id: provider.provider_id,
        provider_name: provider.name,
        health_status: 'UNAVAILABLE',
        checked_at: checkedAt,
        error: String(error?.message || error),
      };
    }
  },

  async checkAllCore(): Promise<ProviderHealthCheckResult[]> {
    const providers = await routingV2Repository.listProviders();
    const results: ProviderHealthCheckResult[] = [];

    for (const provider of providers) {
      const result = await this.checkAndPersist(provider);
      results.push(result);
    }

    return results;
  },

  async checkByProviderId(providerId: string): Promise<ProviderHealthCheckResult> {
    const provider = await routingV2Repository.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} não encontrado`);
    }
    return this.checkAndPersist(provider);
  },

  async getLastHealth(providerId: string): Promise<{
    status: string;
    checked_at: string;
  } | null> {
    const provider = await routingV2Repository.getProvider(providerId);
    if (!provider) return null;

    return {
      status: provider.health_status,
      checked_at: provider.last_health_check_at || '',
    };
  },
};
