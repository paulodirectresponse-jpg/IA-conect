import { RoutingV2Provider } from '../domain.js';
import { RoutingV2ProviderHealth } from '../adapter.js';
import { BaseProviderHealthCheck, registerProviderHealthCheck } from '../healthAdapter.js';

const now = () => new Date().toISOString();

export class AtlasHealthCheck extends BaseProviderHealthCheck {
  readonly providerId = 'provider-atlas';
  readonly providerName = 'Atlas Cloud';

  async check(provider: RoutingV2Provider): Promise<RoutingV2ProviderHealth> {
    const apiKey = this.getApiKey(provider);
    const baseUrl = this.getBaseUrl(provider, 'https://api.atlascloud.ai');

    if (!apiKey) {
      return {
        status: 'UNAVAILABLE',
        checked_at: now(),
        message: 'API Key do Atlas não configurada',
      };
    }

    try {
      // Official authenticated balance endpoint; read-only and cost free.
      const res = await this.fetchWithTimeout(
        `${baseUrl}/public/v1/balance`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        },
        3000
      );

      let status = this.interpretResponse(res.status, true);
      let message = this.buildMessage(res.status);
      if(status==='HEALTHY'){
        const body:any=await res.json().catch(()=>null);
        const balance=Number(body?.data?.balance??body?.balance);
        if(!Number.isFinite(balance)){status='DEGRADED';message='Atlas respondeu sem saldo válido.';}
      }

      return {
        status,
        checked_at: now(),
        message,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          status: 'DEGRADED',
          checked_at: now(),
          message: 'Atlas timeout (3s)',
        };
      }
      return {
        status: 'UNAVAILABLE',
        checked_at: now(),
        message: `Erro de conexão: ${String(error?.message || error)}`,
      };
    }
  }

  private buildMessage(status: number): string | undefined {
    if (status === 200 || status === 201) return undefined;
    if (status === 401 || status === 403) return 'API Key inválida ou expirada';
    if (status === 429) return 'Rate limit temporário';
    if (status >= 500 && status < 600) return `Atlas indisponível (HTTP ${status})`;
    return `Resposta inesperada (HTTP ${status})`;
  }
}

export const atlasHealthCheck = new AtlasHealthCheck();
registerProviderHealthCheck(atlasHealthCheck);
