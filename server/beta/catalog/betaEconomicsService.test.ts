import { describe,expect,it,vi,afterEach } from 'vitest';
import { betaEconomicsService } from './betaEconomicsService.js';

afterEach(()=>vi.useRealTimers());

describe('PR-07 quote TTL',()=>{
  it('computes expiry from pricing policy TTL',()=>{
    const expires=betaEconomicsService.quoteExpiry({
      pricing_policy_id:'p',name:'P',quote_ttl_seconds:120,active:true,created_at:'x',updated_at:'x',
    },new Date('2026-01-01T00:00:00.000Z'));
    expect(expires).toBe('2026-01-01T00:02:00.000Z');
  });

  it('rejects expired quotes and accepts fresh quotes',()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'));
    expect(()=>betaEconomicsService.assertQuoteFresh({expires_at:'2026-01-01T00:01:00.000Z'})).not.toThrow();
    expect(()=>betaEconomicsService.assertQuoteFresh({expires_at:'2026-01-01T00:00:00.000Z'})).toThrowError(/expirou/i);
  });
});
