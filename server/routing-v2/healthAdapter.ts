import { RoutingV2Provider, RoutingV2RuntimeStatus } from './domain.js';
import { RoutingV2ProviderHealth } from './adapter.js';
import { listAtlasCatalogModels, listRunwareCatalogModels, listWaveSpeedCatalogModels } from './providerCatalogService.js';

export interface ProviderHealthCheck {
  readonly providerId: string;
  readonly providerName: string;
  check(provider: RoutingV2Provider): Promise<RoutingV2ProviderHealth>;
}

const now = () => new Date().toISOString();

export abstract class BaseProviderHealthCheck implements ProviderHealthCheck {
  abstract readonly providerId: string;
  abstract readonly providerName: string;

  protected getApiKey(provider: RoutingV2Provider): string | null {
    const key = this.readEnvironmentSecret(provider);
    return key ? key.trim() : null;
  }

  protected readEnvironmentSecret(provider: RoutingV2Provider): string | undefined {
    const envVar = `${this.providerId.toUpperCase().replace(/^PROVIDER-/, '')}_API_KEY`;
    return process.env[envVar];
  }

  protected getBaseUrl(provider: RoutingV2Provider, fallback: string): string {
    const envVar = `${this.providerId.toUpperCase().replace(/^PROVIDER-/, '')}_BASE_URL`;
    const url = process.env[envVar] || fallback;
    return String(url).replace(/\/+$/, '');
  }

  protected async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = 3000
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  protected interpretResponse(
    status: number,
    isConfigured: boolean
  ): RoutingV2RuntimeStatus {
    if (!isConfigured) return 'UNAVAILABLE';
    if (status === 200 || status === 201) return 'HEALTHY';
    if (status === 401 || status === 403) return 'UNAVAILABLE';
    if (status === 429) return 'DEGRADED';
    if (status >= 500 && status < 600) return 'DEGRADED';
    return 'UNKNOWN';
  }

  abstract check(provider: RoutingV2Provider): Promise<RoutingV2ProviderHealth>;
}

export const providerHealthRegistry = new Map<string, ProviderHealthCheck>();

export function registerProviderHealthCheck(check: ProviderHealthCheck) {
  providerHealthRegistry.set(check.providerId, check);
}

export function getProviderHealthCheck(providerId: string): ProviderHealthCheck | null {
  return providerHealthRegistry.get(providerId) || null;
}

export async function checkProviderHealth(
  provider: RoutingV2Provider
): Promise<RoutingV2ProviderHealth> {
  try{
    if(provider.provider_id==='provider-wavespeed'){
      if(!process.env.WAVESPEED_API_KEY?.trim())return{status:'UNAVAILABLE',checked_at:now(),message:'WaveSpeed API key ausente.'};
      await listWaveSpeedCatalogModels('');
      return{status:'HEALTHY',checked_at:now(),message:'WaveSpeed catalog API respondeu com sucesso.'};
    }
    if(provider.provider_id==='provider-atlas'){
      if(!process.env.ATLAS_API_KEY?.trim())return{status:'UNAVAILABLE',checked_at:now(),message:'Atlas API key ausente.'};
      await listAtlasCatalogModels();
      return{status:'HEALTHY',checked_at:now(),message:'Atlas catalog API respondeu com sucesso.'};
    }
    if(provider.provider_id==='provider-runware'){
      if(!process.env.RUNWARE_API_KEY?.trim())return{status:'UNAVAILABLE',checked_at:now(),message:'Runware API key ausente.'};
      await listRunwareCatalogModels('image');
      return{status:'HEALTHY',checked_at:now(),message:'Runware modelSearch respondeu com sucesso.'};
    }
  }catch(error:any){
    return{status:'UNAVAILABLE',checked_at:now(),message:String(error?.message||error)};
  }
  const check = getProviderHealthCheck(provider.provider_id);
  if (!check) {
    return {
      status: 'UNKNOWN',
      checked_at: now(),
      message: `Nenhum health check registrado para ${provider.provider_id}`,
    };
  }

  try {
    return await check.check(provider);
  } catch (error: any) {
    return {
      status: 'UNAVAILABLE',
      checked_at: now(),
      message: String(error?.message || error || 'Erro ao verificar saúde do provider'),
    };
  }
}
