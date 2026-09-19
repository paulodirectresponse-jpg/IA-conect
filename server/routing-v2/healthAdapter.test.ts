import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WaveSpeedHealthCheck } from './providers/wavespeedHealthCheck.js';
import { AtlasHealthCheck } from './providers/atlasHealthCheck.js';
import { RunwareHealthCheck } from './providers/runwareHealthCheck.js';
import { RoutingV2Provider } from './domain.js';

const originalFetch = global.fetch;

const mockProvider: RoutingV2Provider = {
  provider_id: 'provider-wavespeed',
  name: 'WaveSpeed AI',
  slug: 'wavespeed',
  type: 'AGGREGATOR',
  status: 'ACTIVE',
  priority: 100,
  adapter_id: 'legacy:provider-wavespeed',
  supports_catalog_sync: false,
  supports_pricing_sync: false,
  supports_balance: false,
  health_status: 'UNKNOWN',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('WaveSpeedHealthCheck', () => {
  let check: WaveSpeedHealthCheck;

  beforeEach(() => {
    check = new WaveSpeedHealthCheck();
    vi.clearAllMocks();
  });

  it('should return UNAVAILABLE when API key is not configured', async () => {
    const provider = { ...mockProvider };
    vi.stubEnv('WAVESPEED_API_KEY', '');

    const result = await check.check(provider);

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.message).toContain('não configurada');
  });

  it('should return HEALTHY on successful health check', async () => {
    vi.stubEnv('WAVESPEED_API_KEY', 'test-key');

    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve('{}'),
      })
    );

    const result = await check.check(mockProvider);

    expect(result.status).toBe('HEALTHY');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v3/predictions'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('should return UNAVAILABLE on 401 response', async () => {
    vi.stubEnv('WAVESPEED_API_KEY', 'invalid-key');

    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        status: 401,
        text: () => Promise.resolve('{}'),
      })
    );

    const result = await check.check(mockProvider);

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.message).toContain('inválida');
  });

  it('should return DEGRADED on 500 response', async () => {
    vi.stubEnv('WAVESPEED_API_KEY', 'test-key');

    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        status: 500,
        text: () => Promise.resolve('{}'),
      })
    );

    const result = await check.check(mockProvider);

    expect(result.status).toBe('DEGRADED');
  });

  it('should return DEGRADED on timeout', async () => {
    vi.stubEnv('WAVESPEED_API_KEY', 'test-key');

    (global.fetch as any) = vi.fn(() =>
      new Promise((_, reject) => {
        const error = new Error('Aborted');
        (error as any).name = 'AbortError';
        reject(error);
      })
    );

    const result = await check.check(mockProvider);

    expect(result.status).toBe('DEGRADED');
    expect(result.message).toContain('timeout');
  });
});

describe('AtlasHealthCheck', () => {
  let check: AtlasHealthCheck;

  beforeEach(() => {
    check = new AtlasHealthCheck();
  });

  it('should use correct base URL for Atlas', async () => {
    vi.stubEnv('ATLAS_API_KEY', 'test-key');
    vi.stubEnv('ATLAS_BASE_URL', 'https://custom.atlas.ai');

    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve('{}'),
      })
    );

    const atlasProvider = { ...mockProvider, provider_id: 'provider-atlas' };
    await check.check(atlasProvider);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('custom.atlas.ai'),
      expect.any(Object)
    );
  });
});

describe('RunwareHealthCheck', () => {
  let check: RunwareHealthCheck;

  beforeEach(() => {
    check = new RunwareHealthCheck();
  });

  it('should use POST method for Runware health check', async () => {
    vi.stubEnv('RUNWARE_API_KEY', 'test-key');

    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve('{}'),
      })
    );

    const runwareProvider = { ...mockProvider, provider_id: 'provider-runware' };
    await check.check(runwareProvider);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
