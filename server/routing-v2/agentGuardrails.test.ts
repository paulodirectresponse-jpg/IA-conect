import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveRoutingV2RouteStatus } from './routeReconciler.js';
import { assertRoutingV2Route, RoutingV2Provider, RoutingV2ProviderRoute } from './domain.js';

const root = process.cwd();
const now = '2026-09-19T20:00:00.000Z';
const future = '2026-09-19T21:00:00.000Z';

const provider: RoutingV2Provider = {
  provider_id: 'provider-test',
  name: 'Test',
  slug: 'test',
  type: 'AGGREGATOR',
  status: 'ACTIVE',
  priority: 100,
  adapter_id: 'adapter-test',
  supports_catalog_sync: false,
  supports_pricing_sync: false,
  supports_balance: false,
  health_status: 'HEALTHY',
  created_at: now,
  updated_at: now,
};

function baseRoute(): RoutingV2ProviderRoute {
  return {
    route_id: 'route_v2_guardrail',
    model_id: 'model-test',
    capability_id: 'text-to-image',
    provider_id: provider.provider_id,
    provider_model_identifier: 'verified/model',
    status: 'PRICED',
    pricing_status: 'CURRENT',
    runtime_status: 'HEALTHY',
    billing_type: 'PER_GENERATION',
    billing_config: { type: 'PER_GENERATION', currency: 'USD', price_per_generation: 0.1 },
    pricing_snapshot: {
      billing_config: { type: 'PER_GENERATION', currency: 'USD', price_per_generation: 0.1 },
      source: 'PROVIDER_CATALOG_API',
      source_reference: 'official:test',
      provider_cost_reference: 0.1,
      safe_cogs_brl: 0.55,
      retail_price_credits: 100,
      expected_margin_percent: 40,
      fx_rate_usd_brl: 5.2,
      fetched_at: now,
      valid_until: future,
    },
    priority: 100,
    created_at: now,
    updated_at: now,
  };
}

describe('Routing V2 agent guardrails', () => {
  it('never lets the legacy execution wrapper fabricate health or pricing', () => {
    const source = fs.readFileSync(path.join(root, 'server/routing-v2/legacyWrapperAdapter.ts'), 'utf8');
    expect(source).not.toMatch(/status:\s*['"]HEALTHY['"]/);
    expect(source).not.toMatch(/async\s+getPrice\s*\(/);
    expect(source).toContain("status: 'UNKNOWN'");
  });

  it('keeps pricing fixtures out of production Routing V2 code', () => {
    const dir = path.join(root, 'server/routing-v2');
    const files: string[] = [];
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
      }
    };
    walk(dir);

    for (const file of files) {
      const rel = path.relative(root, file).replaceAll('\\', '/');
      if (rel === 'server/routing-v2/pricingFixtureService.ts') continue;
      const source = fs.readFileSync(file, 'utf8');
      expect(source, rel).not.toContain('pricingFixtureService');
      expect(source, rel).not.toContain('FIXTURE_VALIDATED');
    }
  });

  it('does not promote CURRENT pricing to READY without a persisted pricing snapshot', () => {
    const route = { ...baseRoute(), pricing_snapshot: null };
    expect(deriveRoutingV2RouteStatus({ route, provider, now })).not.toBe('READY');
  });

  it('does not promote a route to READY when runtime health is UNKNOWN', () => {
    const route = { ...baseRoute(), runtime_status: 'UNKNOWN' as const };
    expect(deriveRoutingV2RouteStatus({ route, provider, now })).toBe('PRICED');
  });

  it('rejects a READY route with non-positive retail credits', () => {
    const route = baseRoute();
    route.status = 'READY';
    route.pricing_snapshot = { ...route.pricing_snapshot!, retail_price_credits: 0 };
    expect(() => assertRoutingV2Route(route)).toThrow(/READY exige/);
  });
});
