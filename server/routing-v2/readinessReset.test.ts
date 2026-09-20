import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Routing Core V2 greenfield readiness and reset',()=>{
  it('derives cutover readiness only from active V2 models and V2 READY routes',()=>{
    const source=read('server/routing-v2/readinessService.ts');
    expect(source).toContain("model.status==='ACTIVE'");
    expect(source).toContain('routingV2Candidate(route,currentTime)');
    expect(source).toContain('required_model_capabilities');
    expect(source).not.toContain('catalogRepository');
    expect(source).not.toContain('providerPricingCatalogService');
  });

  it('keeps the isolated preview incapable of enabling V2_ONLY',()=>{
    const cutover=read('server/routing-v2/cutoverService.ts');
    const preview=read('wrangler.routing-v2-preview.jsonc');
    expect(cutover).toContain('ROUTING_V2_V2_ONLY_BLOCKED');
    expect(cutover).toContain('ROUTING_V2_PREVIEW');
    expect(preview).toContain('"name": "ia-conect-routing-v2-preview"');
    expect(preview).toContain('"ROUTING_V2_PREVIEW": "true"');
    expect(preview).not.toContain('"triggers"');
  });

  it('allows destructive inventory reset only inside the isolated preview',()=>{
    const repository=read('server/routing-v2/repository.ts');
    const admin=read('server/routes/adminRoutingV2Routes.ts');
    expect(repository).toContain('resetInventoryForPreview');
    expect(repository).toContain('ROUTING_V2_RESET_PREVIEW_ONLY');
    expect(repository).toContain("process.env.ROUTING_V2_PREVIEW");
    expect(admin).toContain('/admin/routing-v2/reset-preview');
    expect(admin).toContain('RESET_ROUTING_V2_PREVIEW');
  });

  it('removes migration endpoints and V1 inventory import from the V2 admin',()=>{
    const admin=read('server/routes/adminRoutingV2Routes.ts');
    expect(admin).not.toContain('/admin/routing-v2/migration');
    expect(admin).not.toContain('routingV2MigrationService');
    expect(admin).toContain('/admin/routing-v2/readiness');
  });

  it('keeps HYBRID fallback while V2 is rebuilt',()=>{
    const orchestrator=read('server/beta/jobs/jobOrchestrator.ts');
    expect(orchestrator).toContain('routingV2CutoverService.shouldUseV2');
    expect(orchestrator).toContain('generationService.createAndStartGeneration');
    expect(orchestrator).toContain('NO_READY_ROUTE_V2');
  });
});
