import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
import {APPROVED_COMMERCIAL_PLANS,APPROVED_ECONOMICS,COMMERCIAL_TECHNICAL_MARGIN_FLOOR_PERCENT,calculatePlanTechnicalMargin} from './commercialQaService.js';
import {packCatalogService} from './packCatalogService.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('monetization stage 6 final QA',()=>{
  it('locks the approved commercial matrix exactly',()=>{
    expect(APPROVED_COMMERCIAL_PLANS).toEqual({
      creator:{version:2,price_brl_cents:4990,total_credits:5000},
      pro:{version:2,price_brl_cents:9990,total_credits:11000},
      studio:{version:2,price_brl_cents:19990,total_credits:23500},
    });
    const active=packCatalogService.list();
    for(const [id,approved] of Object.entries(APPROVED_COMMERCIAL_PLANS)){
      const plan=active.find(row=>row.pack_id===id);
      expect(plan).toBeTruthy();
      expect(plan?.version).toBe(approved.version);
      expect(plan?.price_brl_cents).toBe(approved.price_brl_cents);
      expect(plan?.total_credits).toBe(approved.total_credits);
    }
  });

  it('locks the approved Economics policy',()=>{
    expect(APPROVED_ECONOMICS).toEqual({
      target_margin_percent:55,
      safety_buffer_percent:8,
      reference_credit_value_brl:0.01,
      price_sync_interval_minutes:30,
      price_freshness_ttl_minutes:120,
      stale_grace_minutes:0,
    });
  });

  it('keeps all three approved plans contribution-positive above the launch floor',()=>{
    for(const plan of packCatalogService.list()){
      const margin=calculatePlanTechnicalMargin(plan.price_brl_cents,plan.total_credits);
      expect(margin).toBeGreaterThanOrEqual(COMMERCIAL_TECHNICAL_MARGIN_FLOOR_PERCENT);
      expect(margin).toBeGreaterThan(0);
    }
  });

  it('preserves historical v1 plan terms instead of mutating them',()=>{
    expect(packCatalogService.getAnyVersion('creator',1)?.price_brl_cents).toBe(3990);
    expect(packCatalogService.getAnyVersion('creator',1)?.total_credits).toBe(4000);
    expect(packCatalogService.getAnyVersion('pro',1)?.price_brl_cents).toBe(7990);
    expect(packCatalogService.getAnyVersion('pro',1)?.total_credits).toBe(8400);
    expect(packCatalogService.getAnyVersion('studio',1)?.price_brl_cents).toBe(14990);
    expect(packCatalogService.getAnyVersion('studio',1)?.total_credits).toBe(16500);
  });

  it('keeps model price display, recurring billing, wallet and routing on one credit economy',()=>{
    const picker=read('src/components/workspace/CompactModelPicker.tsx');
    const subscription=read('server/services/subscriptionService.ts');
    const wallet=read('server/services/creditWalletPolicyService.ts');
    const execution=read('server/routing-v2/executionService.ts');
    expect(picker).toContain('CreditAmount');
    expect(picker).not.toContain('a partir de');
    expect(subscription).toContain('subscription_authorized_payment');
    expect(subscription).toContain('subscription-invoice:');
    expect(wallet).toContain('rollover_multiplier:2');
    expect(execution).toContain('reserveForGeneration');
    expect(execution).toContain('captureForGeneration');
    expect(execution).toContain('releaseForGeneration');
  });

  it('treats a commercial version change as a real subscription plan change',()=>{
    const service=read('server/services/subscriptionService.ts');
    const wallet=read('src/components/views/WalletView.tsx');
    expect(service).toContain("current.pack_id===pack.pack_id&&current.pack_version===pack.version");
    expect(wallet).toContain("subscription?.pack_version===pack.version");
  });

  it('publishes commercial QA into system health and the admin executive overview',()=>{
    const health=read('server/services/systemHealthService.ts');
    const overview=read('src/components/admin/AdminOverviewDashboard.tsx');
    expect(health).toContain("key:'commercial'");
    expect(health).toContain('commercialQaService.snapshot');
    expect(overview).toContain("check.key==='commercial'");
    expect(overview).toContain('Monetização ·');
  });
});
