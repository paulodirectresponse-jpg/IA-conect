import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-07 Catalog/Admin/Economics architecture',()=>{
  it('keeps pricing policy separate from actual retail prices',()=>{
    const types=read('server/beta/catalog/catalogPolicyTypes.ts');
    expect(types).toContain('quote_ttl_seconds:number');
    expect(types).not.toMatch(/retail_credit_price|provider_cost|price_cents/);
    const service=read('server/beta/catalog/betaEconomicsService.ts');
    expect(service).toContain('creditPricingService.preview');
  });

  it('uses AUTO to choose an eligible model without provider conditionals',()=>{
    const service=read('server/beta/catalog/betaEconomicsService.ts');
    expect(service).toContain("requestedModelId!=='AUTO'");
    expect(service).toContain('eligibleModels(params.capabilityId,params.requestedControls||[])');
    expect(service).not.toMatch(/provider-atlas|provider-wavespeed|WaveSpeed|Atlas Cloud/);
  });

  it('enforces quote TTL before queue and execution',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('betaEconomicsService.assertQuoteFresh(versioned.job.quote)');
    expect(jobs).toContain('betaEconomicsService.assertQuoteFresh(quote)');
    expect(jobs).toContain('expires_at:expiresAt');
  });

  it('keeps a Beta execution kill switch layered on the existing billing kill switches',()=>{
    const service=read('server/beta/catalog/betaEconomicsService.ts');
    const flags=read('src/beta/betaFlags.ts');
    expect(service).toContain('billingControlService.assertNewGenerationAllowed');
    expect(service).toContain("getFeatureFlag('beta.execution.enabled')");
    expect(flags).toContain("flag_key: 'beta.execution.enabled'");
    expect(flags).toContain("flag_key: 'beta.auto_router.enabled'");
  });

  it('filters AUTO candidates by the controls requested by the job',()=>{
    const policy=read('server/beta/catalog/catalogPolicyService.ts');
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(policy).toContain('validateModelCapability(item.model,capabilityId,requestedControls)');
    expect(jobs).toContain('requestedControls:requestedControls(current.request)');
  });

  it('records economic events without creating a second credit wallet',()=>{
    const repo=read('server/beta/catalog/catalogPolicyRepository.ts');
    const types=read('server/beta/catalog/catalogPolicyTypes.ts');
    expect(repo).toContain('beta_economic_ledger');
    expect(types).toContain("'QUOTE_AUTHORIZED'|'EXECUTION_STARTED'|'EXECUTION_LINKED'");
    expect(repo).not.toMatch(/reserveForGeneration|captureForGeneration|credit_lots|credit_accounts/);
  });

  it('persists AUTO and pricing policy audit context into generation economics',()=>{
    const generation=read('server/services/generationService.ts');
    expect(generation).toContain('pricing_policy_id:params.pricing_policy_id||null');
    expect(generation).toContain('requested_model_id:params.requested_model_id||params.model_id');
    expect(generation).toContain("routing_mode:params.routing_mode||'MANUAL'");
  });

  it('protects all PR-07 admin routes with admin auth',()=>{
    const routes=read('server/routes/adminBetaCatalogRoutes.ts');
    expect(routes.match(/requireAuth,requireAdmin/g)?.length).toBeGreaterThanOrEqual(4);
    expect(routes).toContain('/admin/beta/economic-ledger');
    expect(routes).toContain('/admin/beta/models/:modelId/policy');
  });

  it('keeps PR-07 Admin controls out of the Stable customer bundle',()=>{
    const app=read('src/App.tsx');
    expect(app).not.toContain('AdminBetaCatalog');
    expect(app).toContain("const AdminView=lazy(");
  });
});
