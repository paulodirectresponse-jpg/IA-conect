import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-09 3D V1 economics',()=>{
  it('prices 3D generation per execution, not per second',()=>{
    const pricing=read('server/services/creditPricingService.ts');
    expect(pricing).toContain("'TEXT_TO_3D','IMAGE_TO_3D','MULTI_IMAGE_TO_3D'");
    expect(pricing).toContain("perRequest?'PER_REQUEST':'PER_SECOND'");
  });

  it('quotes with the same logical mesh controls used by execution',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    const adapter=read('server/adapters/wavespeedProviderAdapter.ts');
    expect(jobs).toContain('mesh_mode:request.controls.mesh_mode');
    expect(jobs).toContain('target_faces:request.controls.target_faces');
    expect(adapter).toContain("option(params,'mesh_mode'");
    expect(adapter).toContain("option(params,'target_faces'");
  });

  it('supports pricing probes for image-based 3D without cross-user data',()=>{
    const guard=read('server/services/pricingGuardService.ts');
    expect(guard).toContain("mode==='IMAGE_TO_3D'");
    expect(guard).toContain("mode==='MULTI_IMAGE_TO_3D'");
    expect(guard).toContain("fakeReference('IMAGE','GENERAL')");
  });

  it('keeps frontend away from provider costs and final price authority',()=>{
    const ui=read('src/beta/views/BetaThreeDView.tsx');
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(ui).not.toMatch(/provider_cost|safe_cogs|customer_price/i);
    expect(ui).not.toMatch(/credit_price\s*[:=]\s*\d+/);
    expect(jobs).toContain('betaEconomicsService.resolveQuote');
  });
});
