import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('pricing repair closure',()=>{
 it('repairs published capabilities in bounded Cloudflare-safe batches',()=>{
  const service=read('server/services/pricingRepairService.ts');
  expect(service).toContain('Math.min(2');
  expect(service).toContain('targets.slice(safeCursor,safeCursor+safeLimit)');
  expect(service).toContain('next_cursor');
 });

 it('bootstraps provider pricing and retail pricing from a successful live quote',()=>{
  const service=read('server/services/pricingRepairService.ts');
  expect(service).toContain('providerPricingCatalogService.save');
  expect(service).toContain('retailPricingService.resolveOrBootstrap');
  expect(service).toContain("quote_mode:'LIVE_PROVIDER'");
 });

 it('enables quotable capabilities and hides capabilities with no valid quote',()=>{
  const service=read('server/services/pricingRepairService.ts');
  expect(service).toContain("actions.push('CAPABILITY_ENABLED')");
  expect(service).toContain("actions.push('CAPABILITY_DISABLED')");
  expect(service).toContain("status:'INACTIVE'");
  expect(service).toContain("actions.push('MAPPING_DISABLED')");
 });

 it('does not freeze system-managed policies after Stable publication or repair',()=>{
  const catalog=read('server/beta/catalog/catalogPolicyService.ts');
  const publication=read('server/services/stableModelPublicationService.ts');
  expect(catalog).toContain("!String(existing.updated_by).startsWith('system:')");
  expect(publication).toContain("'system:stable-publish'");
 });

 it('uses edit and extend endpoint suffixes for reference-to-video capabilities',()=>{
  const wave=read('server/adapters/wavespeedProviderAdapter.ts');
  const atlas=read('server/adapters/atlasProviderAdapter.ts');
  for(const adapter of [wave,atlas]){
   expect(adapter).toContain("capabilityId==='video-edit'");
   expect(adapter).toContain("capabilityId==='video-extend'");
   expect(adapter).toContain('normalizeVideoIdentifier');
  }
 });

 it('exposes a one-click repair action in Pricing & Credits',()=>{
  const routes=read('server/routes/adminPricingRoutes.ts');
  const ui=read('src/components/admin/AdminPricing.tsx');
  expect(routes).toContain("post('/admin/pricing/repair'");
  expect(ui).toContain('Corrigir todos os preços');
  expect(ui).toContain('runPricingRepair(cursor,2)');
 });
});