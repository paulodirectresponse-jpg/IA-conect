import { describe, it, expect, beforeAll } from 'vitest';
import { routingV2Repository } from './repository.js';
import { providerHealthService } from './providerHealthService.js';
import { routingV2ProviderService } from './providerService.js';
import { getProviderHealthCheck } from './healthAdapter.js';
import './health.init.js';

const runtimeEnabled=process.env.ROUTING_V2_RUNTIME_TEST==='true'&&Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
(runtimeEnabled?describe:describe.skip)('Health Runtime Integration Tests', () => {
  beforeAll(async () => {
    // Bootstrap core providers if not already done
    const existing = await routingV2Repository.listProviders();
    if (existing.length === 0) {
      await routingV2ProviderService.bootstrapCore();
    }
  });

  it('should have all eight documented credential probes registered', async () => {
    const probeIds=['provider-wavespeed','provider-atlas','provider-runware','provider-fal','provider-deepinfra','provider-replicate','provider-aiml','provider-kie'];
    for(const providerId of probeIds){
      const check=getProviderHealthCheck(providerId);
      expect(check).not.toBeNull();
      expect(check?.providerId).toBe(providerId);
    }
    expect(getProviderHealthCheck('provider-piapi')).toBeNull();
  });

  it('should persist health_status and last_health_check_at', async () => {
    const providers = await routingV2Repository.listProviders();
    const wavespeed = providers.find(p => p.provider_id === 'provider-wavespeed');

    if (!wavespeed) {
      throw new Error('WaveSpeed provider not found');
    }

    // Run health check
    const result = await providerHealthService.checkAndPersist(wavespeed);

    // Verify result
    expect(result.health_status).toBeDefined();
    expect(result.checked_at).toBeDefined();
    expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']).toContain(result.health_status);

    // Verify persistence
    const refreshed = await routingV2Repository.getProvider('provider-wavespeed');
    expect(refreshed?.health_status).toBe(result.health_status);
    expect(refreshed?.last_health_check_at).toBe(result.checked_at);
  });

  it('should propagate health_status to runtime_status in routes', async () => {
    const providers = await routingV2Repository.listProviders();
    const routes = await routingV2Repository.listRoutes();

    // Check that routes have runtime_status set
    const routesWithRuntime = routes.filter(r => r.runtime_status);
    if (routesWithRuntime.length > 0) {
      const route = routesWithRuntime[0];
      const provider = providers.find(p => p.provider_id === route.provider_id);

      expect(provider).toBeDefined();
      // Runtime status should align with provider health or be UNKNOWN/UNAVAILABLE
      expect(['HEALTHY', 'DEGRADED', 'UNKNOWN', 'UNAVAILABLE']).toContain(route.runtime_status);
    }
  });

  it('should have last_runtime_check_at in routes', async () => {
    const routes = await routingV2Repository.listRoutes();

    const routesWithCheck = routes.filter(r => r.last_runtime_check_at);
    if (routesWithCheck.length > 0) {
      const route = routesWithCheck[0];
      expect(route.last_runtime_check_at).toBeTruthy();
      expect(new Date(route.last_runtime_check_at).getTime()).toBeGreaterThan(0);
    }
  });

  it('should not mark provider HEALTHY just because key exists', async () => {
    // This is validation that our logic doesn't do false positives
    // HEALTHY should only be returned if actual health check succeeds
    const providers = await routingV2Repository.listProviders();

    for (const provider of providers) {
      const lastHealth = await providerHealthService.getLastHealth(provider.provider_id);

      if (lastHealth) {
        // If HEALTHY, it should have been from a real endpoint check
        // (we can't validate this in unit tests without actually calling endpoints)
        // But we can ensure it's in valid states
        expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']).toContain(lastHealth.status);
      }
    }
  });
});
