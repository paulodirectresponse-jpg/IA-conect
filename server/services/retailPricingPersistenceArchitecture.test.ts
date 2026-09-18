import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('retail pricing persistence closure',()=>{
 it('verifies retail pricing after bootstrap before counting a repair as fixed',()=>{
  const repair=read('server/services/pricingRepairService.ts');
  expect(repair).toContain('retailVerified=Boolean');
  expect(repair).toContain('Retail pricing');
  expect(repair).toContain('rows.filter(row=>row.retail_verified).length');
 });

 it('can recover an existing active retail version whose pointer is missing',()=>{
  const retail=read('server/services/retailPricingService.ts');
  expect(retail).toContain('latestVersionForHash');
  expect(retail).toContain('writeActivePointer(signature.hash,latest)');
  expect(retail).toContain('Retail pricing foi gravado, mas não pôde ser relido como ativo.');
 });

 it('lists retail versions directly without one Firestore read per row',()=>{
  const retail=read('server/services/retailPricingService.ts');
  const start=retail.indexOf('async listActive()');
  const end=retail.indexOf('\n  },',start);
  const block=retail.slice(start,end);
  expect(block).toContain("collectionId:VERSIONS");
  expect(block).not.toContain('readVersioned');
  expect(block).not.toContain('writeActivePointer');
 });

 it('uses the retail pricing service for the Admin active list',()=>{
  const routes=read('server/routes/adminPricingRoutes.ts');
  expect(routes).toContain("get('/admin/pricing/retail-active'");
  expect(routes).toContain('retailPricingService.listActive()');
  expect(routes).not.toContain("collectionId:'retail_pricing_active'");
 });
});