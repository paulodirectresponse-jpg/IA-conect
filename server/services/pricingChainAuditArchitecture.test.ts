import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

describe('pricing architecture after Routing V2 cutover',()=>{
 it('keeps the historical audit service available only as non-authoritative legacy tooling',()=>{
  const service=read('server/services/pricingChainAuditService.ts');
  for(const stage of ['MODEL','CAPABILITY','MAPPING','PROVIDER','IDENTIFIER','PRICING','QUOTE','SMART_ROUTER','RETAIL_PRICING'])expect(service).toContain(`'${stage}'`);
  expect(read('server/routes/index.ts')).not.toContain('adminPricingRouter');
  expect(exists('server/routes/adminPricingRoutes.ts')).toBe(false);
 });

 it('uses Routing V2 pricing as the active Admin pricing surface',()=>{
  const routes=read('server/routes/adminRoutingV2Routes.ts');
  const ui=read('src/components/admin/AdminRoutingV2.tsx');
  expect(routes).toContain("'/admin/routing-v2/pricing/settings'");
  expect(routes).toContain("'/admin/routing-v2/pricing/sync'");
  expect(routes).toContain('routingV2PriceSyncService.runBatch');
  expect(ui).toContain('routingV2AdminService.operationalize');
  expect(ui).toContain('Economics Engine');
 });

 it('does not resurrect removed Pricing & Credits V1 UI',()=>{
  expect(exists('src/components/admin/AdminPricing.tsx')).toBe(false);
  expect(read('src/components/views/AdminView.tsx')).not.toContain('AdminPricing');
 });
});