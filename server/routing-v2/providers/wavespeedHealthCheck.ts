import { RoutingV2Provider } from '../domain.js';
import { RoutingV2ProviderHealth } from '../adapter.js';
import { BaseProviderHealthCheck, registerProviderHealthCheck } from '../healthAdapter.js';

const now = () => new Date().toISOString();

export class WaveSpeedHealthCheck extends BaseProviderHealthCheck {
  readonly providerId = 'provider-wavespeed';
  readonly providerName = 'WaveSpeed AI';

  async check(provider: RoutingV2Provider): Promise<RoutingV2ProviderHealth> {
    const apiKey = this.getApiKey(provider);
    const baseUrl = this.getBaseUrl(provider, 'https://api.wavespeed.ai');

    if (!apiKey) {
      return {
        status: 'UNAVAILABLE',
        checked_at: now(),
        message: 'API Key do WaveSpeed não configurada',
      };
    }

    try {
      // Authenticated, read-only catalog request. HEALTHY additionally requires
      // the provider payload to contain at least one real model.
      const res = await this.fetchWithTimeout(
        `${baseUrl}/api/v3/models`,
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
        const rows=Array.isArray(body?.data)?body.data:Array.isArray(body?.data?.models)?body.data.models:Array.isArray(body?.models)?body.models:[];
        if(!rows.length){status='DEGRADED';message='WaveSpeed respondeu sem catálogo válido.';}
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
          message: 'WaveSpeed timeout (3s)',
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
    if (status >= 500 && status < 600) return `WaveSpeed indisponível (HTTP ${status})`;
    return `Resposta inesperada (HTTP ${status})`;
  }
}

export const waveSpeedHealthCheck = new WaveSpeedHealthCheck();
registerProviderHealthCheck(waveSpeedHealthCheck);
