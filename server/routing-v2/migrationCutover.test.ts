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
});
