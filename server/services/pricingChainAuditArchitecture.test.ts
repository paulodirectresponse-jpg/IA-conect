import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('missing price chain audit',()=>{
 it('audits every published model capability through the full pricing chain',()=>{
  const service=read('server/services/pricingChainAuditService.ts');
  for(const stage of ['MODEL','CAPABILITY','MAPPING','PROVIDER','IDENTIFIER','PRICING','QUOTE','SMART_ROUTER','RETAIL_PRICING'])expect(service).toContain(`'${stage}'`);
  expect(service).toContain("model.status==='ACTIVE'");
  expect(service).toContain("mapping.status==='ACTIVE'");
  expect(service).toContain('providerPricingCatalogService.getVerified');
  expect(service).toContain('quoteCacheService.getOrQuote');
  expect(service).toContain('retailPricingService.get');
 });

 it('returns the first failing stage and provider attempts instead of guessing',()=>{
  const service=read('server/services/pricingChainAuditService.ts');
  expect(service).toContain('const failed=STAGES.find');
  expect(service).toContain('attempts.push');
  expect(service).toContain('quote_error');
  expect(service).toContain('smart_router_eligible');
 });

 it('exposes the audit only to authenticated admins',()=>{
  const routes=read('server/routes/adminPricingRoutes.ts');
  expect(routes).toContain("post('/admin/pricing/audit',requireAuth,requireAdmin");
 });

 it('renders the audit in Pricing & Credits',()=>{
  const ui=read('src/components/admin/AdminPricing.tsx');
  expect(ui).toContain('Auditar sem preço');
  expect(ui).toContain('Auditoria das IAs sem preço');
  expect(ui).toContain('row.failed_stage');
  expect(ui).toContain('a.pricing_verified');
  expect(ui).toContain('a.quote_ok');
  expect(ui).toContain('a.smart_router_eligible');
 });
});