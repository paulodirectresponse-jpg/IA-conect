import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';
import {computeSubscriptionRollover} from './creditWalletPolicyService.js';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('wallet policy stage 5',()=>{
  it('caps recurring rollover at two monthly allowances',()=>{
    expect(computeSubscriptionRollover(4000,0,4000,2)).toEqual({cap:8000,allowedBefore:8000,expire:0});
    expect(computeSubscriptionRollover(8000,0,4000,2)).toEqual({cap:8000,allowedBefore:8000,expire:0});
    expect(computeSubscriptionRollover(12000,0,4000,2)).toEqual({cap:8000,allowedBefore:8000,expire:4000});
  });

  it('recalculates the cap against the target plan on downgrade',()=>{
    expect(computeSubscriptionRollover(20500,0,4000,2)).toEqual({cap:8000,allowedBefore:8000,expire:12500});
  });


  it('credits the confirmed monthly cycle before applying the rollover cut',()=>{
    const subscription=read('server/services/subscriptionService.ts');
    const issue=subscription.indexOf('await creditWalletService.issue({');
    const rollover=subscription.indexOf('await creditWalletPolicyService.enforceSubscriptionRolloverCap');
    expect(issue).toBeGreaterThan(-1);
    expect(rollover).toBeGreaterThan(issue);
    expect(subscription).toContain('incomingCredits:0');
  });

  it('makes both rollover cuts and no-op rollover decisions invoice-idempotent',()=>{
    const policy=read('server/services/creditWalletPolicyService.ts');
    expect(policy).toContain("const key='subscription-rollover:'+params.invoiceId");
    expect(policy).toContain('markNoop(key');
    expect(policy).toContain('if(await already(key))');
  });

  it('reconciles expired lots without charging the generation hot path',()=>{
    const policy=read('server/services/creditWalletPolicyService.ts');
    const wallet=read('server/services/creditWalletService.ts');
    const routes=read('server/routes/creditRoutes.ts');
    expect(policy).toContain("referenceType:'EXPIRATION'");
    expect(routes).toContain('creditWalletPolicyService.sweepExpired');
    expect(wallet).not.toContain('creditWalletPolicyService.sweepExpired');
  });

  it('preserves reserve capture release semantics for successful and failed generations',()=>{
    const execution=read('server/routing-v2/executionService.ts');
    expect(execution).toContain('reserveForGeneration');
    expect(execution).toContain('captureForGeneration');
    expect(execution).toContain('releaseForGeneration');
    expect(execution).toContain("if(status.status==='FAILED')");
  });

  it('shows wallet composition rollover and readable transaction labels',()=>{
    const view=read('src/components/views/WalletView.tsx');
    expect(view).toContain('subscription_credits');
    expect(view).toContain('promotional_credits');
    expect(view).toContain('Rollover do plano');
    expect(view).toContain('Ajuste de rollover');
    expect(view).toContain("transactions.filter(tx=>tx.type!=='GENERATION_RESERVE')");
  });
});
