import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('unified route pricing engine',()=>{
 it('keeps the Cloudflare pricing cron at thirty minutes',()=>{
  const wrangler=read('wrangler.jsonc');
  const worker=read('worker/index.ts');
  expect(wrangler).toContain('*/30 * * * *');
  expect(worker).toContain('pricingSyncService.runHourlySync()');
 });

 it('prices active mappings by capability and provider model identifier',()=>{
  const sync=read('server/services/pricingSyncService.ts');
  expect(sync).toContain("mappings.filter(row=>row.status==='ACTIVE')");
  expect(sync).toContain('pricingCapabilities(model,mapping)');
  expect(sync).toContain('provider_model_identifier:job.providerModelIdentifier');
  expect(sync).toContain('capability_id:job.profile.capability_id');
 });

 it('refreshes live provider pricing before the health snapshot and shares the quote cache',()=>{
  const refresh=read('server/services/providerPricingRefreshService.ts');
  const sync=read('server/services/pricingSyncService.ts');
  expect(sync).toContain('providerPricingRefreshService.refreshActiveRoutes()');
  expect(refresh).toContain("new Set(['provider-wavespeed','provider-atlas'])");
  expect(refresh).toContain('quoteCacheService.getOrQuote');
  expect(refresh).toContain('quote_mode:\'LIVE_PROVIDER\'');
 });

 it('normalizes only unambiguous Runware public pricing metadata',()=>{
  const refresh=read('server/services/providerPricingRefreshService.ts');
  expect(refresh).toContain('https://content.runware.ai/models/');
  expect(refresh).toContain('pricingOverview');
  expect(refresh).toContain('megapixel|token');
  expect(refresh).toContain("quote_mode:'STATIC_RULE'");
 });

 it('uses character-based retail pricing for text to speech without per-text retail versions',()=>{
  const pricing=read('server/services/creditPricingService.ts');
  expect(pricing).toContain("options.billing_basis='CHARACTER_1000'");
  expect(pricing).toContain('delete options.text_chars');
  expect(pricing).toContain("prompt:character?'x'.repeat(1000)");
  expect(pricing).toContain("pricing_unit:character?'PER_CHARACTER'");
  expect(pricing).toContain('characterCount/1000');
 });

 it('does not reuse approximate persisted snapshots when the exact price signature is absent',()=>{
  const pricing=read('server/services/creditPricingService.ts');
  expect(pricing).toContain('pricing_signature_hash===unitSignature.hash');
  expect(pricing).toContain('configuração exata');
  expect(pricing).not.toContain('rows.sort((a:any,b:any)=>Number(a.fully_loaded_safe_cogs_cents');
 });

 it('uses video probes for video edit and extend pricing',()=>{
  const guard=read('server/services/pricingGuardService.ts');
  expect(guard).toContain("['video-edit','video-extend'].includes");
  expect(guard).toContain("fakeReference('VIDEO','GENERAL')");
 });

 it('bootstraps baseline retail pricing during the periodic route sync',()=>{
  const sync=read('server/services/pricingSyncService.ts');
  expect(sync).toContain('retailPricingService.resolveOrBootstrap');
  expect(sync).toContain('route_refresh:routeRefresh');
 });
});