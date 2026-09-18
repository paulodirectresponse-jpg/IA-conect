import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable ready launch set',()=>{
 it('requires active retail pricing in addition to provider pricing for Stable readiness',()=>{
  const readiness=read('server/services/stableLaunchReadinessService.ts');
  const publication=read('server/services/stableModelPublicationService.ts');
  expect(readiness).toContain('retailPricingService.listActive()');
  expect(readiness).toContain('retailHashes.has(hash)');
  expect(publication).toContain('readyCapabilitiesForModel');
 });

 it('publishes only ready capabilities and isolates models with none',()=>{
  const service=read('server/services/stableLaunchSetService.ts');
  expect(service).toContain("beta_only:false");
  expect(service).toContain('beta_capability_ids:ready');
  expect(service).toContain("beta_only:true");
  expect(service).toContain('capability_ids:[]');
  expect(service).toContain("'system:launch-set'");
 });

 it('keeps launch publication Cloudflare-safe with small batches',()=>{
  const service=read('server/services/stableLaunchSetService.ts');
  const routes=read('server/routes/adminRoutes.ts');
  expect(service).toContain('Math.min(3');
  expect(service).toContain('models.slice(safeCursor,safeCursor+safeLimit)');
  expect(routes).toContain("post('/admin/models/publish-launch-set'");
 });

 it('never exposes a Stable provider mapping without its own retail-ready baseline',()=>{
  const routes=read('server/services/providerRouteCatalogService.ts');
  expect(routes).toContain('readyRoutesForCapability');
  expect(routes).toContain('retailReadyCaps');
  expect(routes).toContain("model.beta_only===true");
 });

 it('adds a single Admin action to publish the ready launch set',()=>{
  const ui=read('src/components/admin/AdminPricing.tsx');
  const client=read('src/services/adminService.ts');
  expect(ui).toContain('Publicar launch set pronto');
  expect(ui).toContain('publishReadyLaunchSet(cursor,2)');
  expect(client).toContain("'/api/admin/models/publish-launch-set'");
 });
});