import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Routing Core V2 migration and cutover',()=>{
  it('migrates V1 inventory additively into isolated V2 collections',()=>{
    const source=read('server/routing-v2/migrationService.ts');
    expect(source).toContain('catalogRepository.listProviders');
    expect(source).toContain('catalogRepository.listModels');
    expect(source).toContain('catalogRepository.listMappings');
    expect(source).toContain('routingV2ProviderService.create');
    expect(source).toContain('routingV2ModelService.create');
    expect(source).toContain('routingV2RouteService.create');
    expect(source).not.toContain('delete');
    expect(source).not.toContain('remove');
  });

  it('never marks migrated routes READY merely because V1 had a price',()=>{
    const source=read('server/routing-v2/migrationService.ts');
    expect(source).toContain('billingFromRule');
    expect(source).toContain('providerPricingCatalogService.getVerified');
    expect(source).not.toContain("status:'READY'");
    expect(source).not.toContain("pricing_status:'CURRENT'");
  });

  it('requires fresh Router V2 readiness before V2_ONLY cutover',()=>{
    const migration=read('server/routing-v2/migrationService.ts');
    const cutover=read('server/routing-v2/cutoverService.ts');
    expect(migration).toContain('routingV2Candidate(route,currentTime)');
    expect(cutover).toContain("mode==='V2_ONLY'");
    expect(cutover).toContain('ready!==required');
    expect(cutover).toContain('ROUTING_V2_CUTOVER_NOT_READY');
  });

  it('keeps HYBRID fallback but blocks silent V1 fallback in V2_ONLY',()=>{
    const orchestrator=read('server/beta/jobs/jobOrchestrator.ts');
    expect(orchestrator).toContain('routingV2CutoverService.shouldUseV2');
    expect(orchestrator).toContain('decision.require_v2&&!decision.ready');
    expect(orchestrator).toContain('generationService.createAndStartGeneration');
    expect(orchestrator).toContain('NO_READY_ROUTE_V2');
  });
  it('keeps the isolated preview incapable of enabling V2_ONLY',()=>{
    const cutover=read('server/routing-v2/cutoverService.ts');
    const admin=read('server/routes/adminRoutingV2Routes.ts');
    const preview=read('wrangler.routing-v2-preview.jsonc');
    const workflow=read('.github/workflows/routing-v2-preview.yml');
    expect(cutover).toContain('ROUTING_V2_PREVIEW_V2_ONLY_BLOCKED');
    expect(cutover).toContain('ROUTING_V2_PREVIEW');
    expect(admin).toContain('ROUTING_V2_MIGRATION_REQUIRES_HYBRID');
    expect(preview).toContain('"name": "ia-conect-routing-v2-preview"');
    expect(preview).toContain('"ROUTING_V2_PREVIEW": "true"');
    expect(preview).not.toContain('"triggers"');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain("github.ref == 'refs/heads/routing-core-v2'");
    expect(workflow).toContain('DEPLOY_ROUTING_V2_PREVIEW');
  });

  it('accepts namespaced legacy adapter ids required by migration',()=>{
    const provider=read('server/routing-v2/providerService.ts');
    expect(provider).toContain('validateAdapterId');
    expect(provider).toContain('/^[a-zA-Z0-9._:-]+$/');
    expect(provider).toContain('const adapterId=validateAdapterId(input.adapter_id)');
  });

  it('merges required V1 capabilities into existing V2 models during migration',()=>{
    const migration=read('server/routing-v2/migrationService.ts');
    expect(migration).toContain('const existingModel=await routingV2Repository.getModel(model.model_id)');
    expect(migration).toContain('const merged=Array.from(new Set([...(existingModel.capabilities||[]),...capabilities]))');
    expect(migration).toContain('routingV2ModelService.setCapabilities(model.model_id,merged)');
  });

});
