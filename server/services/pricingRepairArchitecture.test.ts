import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

describe('pricing repair closure after Routing V2 cutover',()=>{
 it('keeps the historical repair service isolated from the active API',()=>{
  const service=read('server/services/pricingRepairService.ts');
  expect(service).toContain('Math.min(2');
  expect(service).toContain('next_cursor');
  expect(exists('server/routes/adminPricingRoutes.ts')).toBe(false);
  expect(read('server/routes/index.ts')).not.toContain('adminPricingRouter');
 });

 it('uses Routing V2 bounded pricing sync as the active repair path',()=>{
  const routes=read('server/routes/adminRoutingV2Routes.ts');
  const sync=read('server/routing-v2/priceSyncService.ts');
  const ui=read('src/components/admin/AdminRoutingV2.tsx');
  expect(routes).toContain('routingV2PriceSyncService.runBatch');
  expect(routes).toContain('cursor:req.body?.cursor');
  expect(routes).toContain('limit:req.body?.limit');
  expect(sync).toContain('next_cursor');
  expect(ui).toContain('routingV2AdminService.operationalize');
 });

 it('keeps provider endpoint normalization used by transitional adapters',()=>{
  const wave=read('server/adapters/wavespeedProviderAdapter.ts');
  const atlas=read('server/adapters/atlasProviderAdapter.ts');
  for(const adapter of [wave,atlas]){
   expect(adapter).toContain("capabilityId==='video-edit'");
   expect(adapter).toContain("capabilityId==='video-extend'");
   expect(adapter).toContain('normalizeVideoIdentifier');
  }
 });
});