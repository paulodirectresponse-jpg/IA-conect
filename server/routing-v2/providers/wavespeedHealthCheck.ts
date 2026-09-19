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
      // Health endpoint: GET /api/v3/predictions (lista jobs, read-only, sem custo)
      // This is a safe read-only endpoint that validates API key and connectivity
      const res = await this.fetchWithTimeout(
        `${baseUrl}/api/v3/predictions?limit=1`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        },
        3000
      );

      const status = this.interpretResponse(res.status, true);
      const message = this.buildMessage(res.status);

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
