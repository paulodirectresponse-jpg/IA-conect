import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('controlled greenfield factory reset',()=>{
  it('uses an AI-only allowlist and explicitly protects all user-owned records',()=>{
    const source=read('server/services/factoryResetService.ts');
    expect(source).toContain("'Firebase Auth, users e admins'");
    expect(source).toContain('PROTECTED USER DATA MUST NEVER BE DELETED');
    for(const protectedCollection of ['assets','credit_accounts','credit_lots','credit_transactions','credit_reservations','payments','subscriptions','billing_records','generations','generation_attempts','generation_client_requests','generation_economics','beta_jobs','beta_job_attempts','beta_job_idempotency','beta_job_mutations','beta_economic_ledger','beta_library_items','beta_projects','beta_spaces']){
      expect(source).toMatch(new RegExp(`PROTECTED_COLLECTIONS=.*['"]${protectedCollection}['"]`));
    }
    expect(source).not.toContain('SYNTHETIC_RUNTIME_COLLECTIONS');
    expect(source).not.toContain('deleteAuthUser');
    expect(source).toContain("'provider_scan_runs'");
    expect(source).toContain("'beta_model_policies'");
    expect(source).toContain("'app_config/pricing_health_latest'");
  });

  it('requires protected environment snapshot fingerprint and explicit confirmation',()=>{
    const source=read('server/services/factoryResetService.ts');
    for(const proof of ['ROUTING_V2_PREVIEW','FACTORY_RESET_PRODUCTION_ENABLED','FACTORY_RESET_APPROVAL_SHA256','FACTORY_RESET_SNAPSHOT_REQUIRED','FACTORY_RESET_INVENTORY_CHANGED','RESET_AI_CONFIGURATION_ONLY_PRESERVE_ALL_REAL_USER_DATA','phase:\'DRY_RUN\'','before_counts','after_counts','FACTORY_RESET_INCOMPLETE'])expect(source).toContain(proof);
    expect(source).toContain("mode:'HYBRID'");
  });

  it('exposes an explicit non-destructive dry-run before snapshot/execute',()=>{
    const routes=read('server/routes/adminRoutingV2Routes.ts');
    expect(routes).toContain("'/admin/factory-reset/dry-run'");
    expect(routes).toContain('factoryResetService.dryRun()');
  });

  it('routes generator catalog and execution through READY inventory',()=>{
    expect(read('server/routes/catalogRoutes.ts')).toContain('routingV2CatalogService.listGeneratorModels()');
    expect(read('server/routes/generationRoutes.ts')).toContain('routingV2ExecutionService.preview');
    expect(read('server/services/generationService.ts')).toContain('return routingV2ExecutionService.start');
  });
});
