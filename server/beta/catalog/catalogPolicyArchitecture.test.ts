import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file:string)=>fs.existsSync(path.join(root,file));

describe('Beta catalog compatibility after Routing V2 cutover',()=>{
  it('keeps Beta pricing policy separate from the credit wallet',()=>{
    const types=read('server/beta/catalog/catalogPolicyTypes.ts');
    const repo=read('server/beta/catalog/catalogPolicyRepository.ts');
    expect(types).toContain('quote_ttl_seconds:number');
    expect(repo).toContain('beta_economic_ledger');
    expect(repo).not.toMatch(/reserveForGeneration|captureForGeneration|credit_lots|credit_accounts/);
  });

  it('keeps Beta job orchestration only for still-supported Beta workflows',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('assertJobQuoteFresh');
    expect(read('server/routes/index.ts')).toContain('betaJobRouter');
  });

  it('removes the old Beta catalog Admin API and UI from the active product',()=>{
    expect(exists('server/routes/adminBetaCatalogRoutes.ts')).toBe(false);
    expect(exists('src/components/admin/AdminBetaCatalog.tsx')).toBe(false);
    const index=read('server/routes/index.ts');
    const admin=read('src/components/views/AdminView.tsx');
    expect(index).not.toContain('adminBetaCatalogRouter');
    expect(admin).not.toContain('AdminBetaCatalog');
    expect(admin).toContain('AdminRoutingV2');
  });

  it('keeps the stable Admin lazy-loaded without restoring removed Beta controls',()=>{
    const app=read('src/App.tsx');
    expect(app).not.toContain('AdminBetaCatalog');
    expect(app).toContain("const AdminView=lazy(");
  });
});