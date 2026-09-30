import { RoutingV2Provider } from './domain.js';
import { RoutingV2ProviderHealth } from './adapter.js';
import { checkProviderHealth } from './healthAdapter.js';
import { routingV2Repository } from './repository.js';
import { isOfficialRoutingV2Provider } from './providerService.js';
import { reconcileRoutingV2Route } from './routeReconciler.js';

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
    if (!isOfficialRoutingV2Provider(provider.provider_id) || provider.status === 'DISABLED') {
      throw new Error('A checagem está limitada aos três provedores oficiais ativos: WaveSpeed AI, Atlas Cloud e Runware.');
    }
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
      const routes=(await routingV2Repository.listRoutes()).filter(route=>route.provider_id===provider.provider_id&&route.status!=='DISABLED');
      await Promise.all(routes.map(route=>{
        const runtimeError=health.status==='HEALTHY'?null:(health.message||`Runtime do provider ${health.status}; rota mantida fora de READY.`);
        const next=reconcileRoutingV2Route({
          route:{...route,last_runtime_check_at:checkedAt,last_runtime_error:runtimeError,last_runtime_error_at:checkedAt},
          provider:updated,runtime_status:health.status,now:checkedAt,
        });
        return routingV2Repository.saveRoute(next);
      }));

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
    const providers = (await routingV2Repository.listProviders())
      .filter(provider => isOfficialRoutingV2Provider(provider.provider_id) && provider.status !== 'DISABLED');
    return Promise.all(providers.map(provider => this.checkAndPersist(provider)));
  },

  async checkByProviderId(providerId: string): Promise<ProviderHealthCheckResult> {
    const provider = await routingV2Repository.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} não encontrado`);
    }
    if (!isOfficialRoutingV2Provider(provider.provider_id) || provider.status === 'DISABLED') {
      throw new Error('Somente os três provedores oficiais ativos podem passar por checagem de saúde.');
    }
    return this.checkAndPersist(provider);
  },

  async getLastHealth(providerId: string): Promise<{
    provider_id: string;
    provider_name: string;
    status: string;
    checked_at: string;
  } | null> {
    const provider = await routingV2Repository.getProvider(providerId);
    if (!provider) return null;

    return {
      provider_id: provider.provider_id,
      provider_name: provider.name,
      status: provider.health_status,
      checked_at: provider.last_health_check_at || '',
    };
  },
};
