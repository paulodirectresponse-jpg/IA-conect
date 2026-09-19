import { RoutingV2Provider } from '../domain.js';
import { RoutingV2ProviderHealth } from '../adapter.js';
import { BaseProviderHealthCheck, registerProviderHealthCheck } from '../healthAdapter.js';

const now = () => new Date().toISOString();

export class RunwareHealthCheck extends BaseProviderHealthCheck {
  readonly providerId = 'provider-runware';
  readonly providerName = 'Runware';

  protected readEnvironmentSecret(provider: RoutingV2Provider): string | undefined {
    return process.env.RUNWARE_API_KEY;
  }

  async check(provider: RoutingV2Provider): Promise<RoutingV2ProviderHealth> {
    const apiKey = this.getApiKey(provider);
    const baseUrl = this.getBaseUrl(provider, 'https://api.runware.ai/v1');

    if (!apiKey) {
      return {
        status: 'UNAVAILABLE',
        checked_at: now(),
        message: 'API Key do Runware não configurada',
      };
    }

    try {
      // Health endpoint: POST com query de status (read-only, sem custo)
      // Runware uses POST for most operations; we send a minimal status query
      const res = await this.fetchWithTimeout(
        baseUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              taskType: 'getResponse',
              taskUUID: 'health-check',
            },
          ]),
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
          message: 'Runware timeout (3s)',
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
    if (status >= 500 && status < 600) return `Runware indisponível (HTTP ${status})`;
    return `Resposta inesperada (HTTP ${status})`;
  }
}

export const runwareHealthCheck = new RunwareHealthCheck();
registerProviderHealthCheck(runwareHealthCheck);
