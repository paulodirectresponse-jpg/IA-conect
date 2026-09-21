import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

describe('retail pricing persistence after Routing V2 cutover',()=>{
 it('keeps historical retail pricing persistence code non-authoritative',()=>{
  const retail=read('server/services/retailPricingService.ts');
  expect(retail).toContain('latestVersionForHash');
  expect(retail).toContain('writeActivePointer');
  expect(exists('server/routes/adminPricingRoutes.ts')).toBe(false);
 });

 it('publishes operational generation price from Routing V2 pricing snapshots',()=>{
  const pricing=read('server/routing-v2/generationPricingService.ts');
  expect(pricing).toContain('route.pricing_snapshot');
  expect(pricing).toContain('routingV2PricingSettingsService.get()');
  expect(pricing).toContain('retail_credits:economics.retail_credits');
 });

 it('manages active pricing only through Routing V2 Admin endpoints',()=>{
  const routes=read('server/routes/adminRoutingV2Routes.ts');
  expect(routes).toContain("'/admin/routing-v2/pricing/settings'");
  expect(routes).toContain("'/admin/routing-v2/pricing/sync'");
  expect(routes).not.toContain("'/admin/pricing/retail-active'");
 });
});