import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Routing Core V2 integration boundary',()=>{
  it('prices generations locally from synced Route billing data',()=>{
    const pricing=read('server/routing-v2/generationPricingService.ts');
    expect(pricing).toContain('calculateRoutingV2ProviderCost');
    expect(pricing).toContain('calculateRoutingV2Economics');
    expect(pricing).toContain('routingV2RouterService.select');
    expect(pricing).not.toContain('creditPricingService');
    expect(pricing).not.toContain('smartRouterService');
  });

  it('reuses Wallet, Generation repository and Universal Assets without importing the V1 generation engine',()=>{
    const execution=read('server/routing-v2/executionService.ts');
    expect(execution).toContain('creditWalletService');
    expect(execution).toContain('generationRepository');
    expect(execution).toContain('assetRepository');
    expect(execution).toContain('generatedAssetId');
    expect(execution).not.toContain("from '../services/generationService");
    expect(execution).not.toContain('creditPricingService');
    expect(execution).not.toContain('smartRouterService');
  });

  it('keeps Universal Job linkage explicit through source_job_id',()=>{
    const bridge=read('server/routing-v2/jobBridge.ts');
    expect(bridge).toContain('BetaJob');
    expect(bridge).toContain('source_job_id:job.job_id');
    expect(bridge).toContain('routingV2ExecutionService.start');
    expect(bridge).toContain('routingV2ExecutionService.refresh');
  });

  it('derives the V2 public catalog only from READY routes',()=>{
    const catalog=read('server/routing-v2/catalogService.ts');
    expect(catalog).toContain('routingV2RouteService.listReady');
    expect(catalog).toContain('available_capabilities');
    expect(catalog).not.toContain('beta_only');
    expect(catalog).not.toContain('launch');
  });

  it('exposes V2 catalog reads without replacing the V1 endpoints before cutover',()=>{
    const routes=read('server/routes/catalogRoutes.ts');
    expect(routes).toContain("'/catalog/v2/models'");
    expect(routes).toContain("'/catalog/v2/model-routes'");
    expect(routes).toContain("'/catalog/models'");
    expect(routes).toContain("'/catalog/model-routes'");
  });
});
