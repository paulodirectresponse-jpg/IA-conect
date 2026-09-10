import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const routeFiles = [
  'server/routes/runtimeRoutes.ts',
  'server/routes/creditRuntimeRoutes.ts',
  'server/routes/generationRuntimeRoutes.ts',
  'server/routes/apiRoutes.ts',
  'server/routes/adminPricingRuntimeRoutes.ts',
  'server/routes/adminEconomicsRoutes.ts',
  'server/routes/providerFinanceRoutes.ts',
  'server/routes/communityRoutes.ts',
];

const routerNames = [
  'runtimeRouter',
  'creditRuntimeRouter',
  'generationRuntimeRouter',
  'apiRouter',
  'adminPricingRuntimeRouter',
  'adminEconomicsRouter',
  'providerFinanceRouter',
  'communityRouter',
];

const read = (file:string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('API architecture invariants', () => {
  it('registers each METHOD + PATH only once', () => {
    const seen = new Map<string,string>();
    const duplicates:string[] = [];
    const routerPattern = new RegExp(
      `(?:${routerNames.join('|')})\\.(get|post|put|patch|delete)\\(\\s*['"`]([^'"`]+)['"`]`,
      'g',
    );

    for (const file of routeFiles) {
      const source = read(file);
      for (const match of source.matchAll(routerPattern)) {
        const key = `${String(match[1]).toUpperCase()} ${match[2]}`;
        const previous = seen.get(key);
        if (previous) duplicates.push(`${key}: ${previous} + ${file}`);
        else seen.set(key, file);
      }
    }

    expect(duplicates).toEqual([]);
  });

  it('keeps removed legacy public routes out of the active route layer', () => {
    const source = routeFiles.map(read).join('\n');
    expect(source).not.toContain('/workspace/validate-and-preview');
    expect(source).not.toContain('/wallet/summary');
    expect(source).not.toContain('/wallet/transactions');
    expect(source).not.toContain('/admin/users/:userId/adjust-balance');
  });

  it('keeps generation quote payload free of internal economics', () => {
    const source = read('server/routes/generationRuntimeRoutes.ts');
    expect(source).not.toContain('provider_cost_brl_cents');
    expect(source).not.toContain('fully_loaded_safe_cogs_cents');
    expect(source).not.toContain('margin_percent:');
    expect(source).not.toContain('max_allowed_cogs_cents:');
    expect(source).not.toContain('authorized_net_backing_micros:');
  });

  it('uses one shared route composition in Node and Cloudflare', () => {
    const nodeServer = read('server.ts');
    const worker = read('worker/index.ts');
    expect(nodeServer).toContain("import { apiRootRouter } from './server/routes/index.js'");
    expect(worker).toContain("import { apiRootRouter } from '../server/routes/index.js'");
    expect(nodeServer).toContain("app.use('/api',apiRootRouter)");
    expect(worker).toContain("app.use('/api',apiRootRouter)");
  });
});
