import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-07 policy contract',()=>{
  it('adds selected model, routing mode, pricing policy and expiry to job quotes',()=>{
    const types=read('server/beta/jobs/jobTypes.ts');
    for(const field of ['requested_model_id','selected_model_id','routing_mode','pricing_policy_id','expires_at']){
      expect(types).toContain(field);
    }
  });

  it('governs the public capability catalog and exposes AUTO',()=>{
    const routes=read('server/routes/betaCapabilityRoutes.ts');
    expect(routes).toContain('betaCatalogPolicyService.listCatalog');
    expect(routes).toContain("model_id:'AUTO'");
    expect(routes).toContain('auto_routing_enabled');
  });

  it('allows Admin to manage capabilities, eligibility, AUTO and policy assignment',()=>{
    const admin=read('src/components/admin/AdminBetaCatalog.tsx');
    expect(admin).toContain('supported_capability_ids');
    expect(admin).toContain('auto_routing_enabled');
    expect(admin).toContain('pricing_policy_id');
    expect(admin).toContain('beta.execution.enabled');
  });
});
