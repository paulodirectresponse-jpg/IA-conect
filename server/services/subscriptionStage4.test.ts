import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('subscription stage 4 architecture',()=>{
  it('creates recurring monthly checkout with user-linked external reference',()=>{
    const service=read('server/services/subscriptionService.ts');
    expect(service).toContain("mp('/preapproval'");
    expect(service).toContain("frequency:1,frequency_type:'months'");
    expect(service).toContain("status:'pending'");
    expect(service).toContain('iac-sub:');
    expect(service).toContain('?subscription=return');
  });

  it('issues monthly credits only from an approved accredited recurring invoice',()=>{
    const service=read('server/services/subscriptionService.ts');
    expect(service).toContain("eventType==='subscription_authorized_payment'");
    expect(service).toContain("invoice?.payment?.status");
    expect(service).toContain('status_detail');
    expect(service).toContain('subscription-invoice:');
    expect(service).toContain('credits:Number(target.monthly_credits)');
  });

  it('supports subscription sync, next-cycle plan change and cancellation',()=>{
    const service=read('server/services/subscriptionService.ts');
    expect(service).toContain('requestPlanChange');
    expect(service).toContain('pending_plan_change');
    expect(service).toContain("status:'canceled'");
    expect(service).toContain('next_payment_date');
  });

  it('expires unpaid pending checkout after 30 minutes and allows a new checkout',()=>{
    const service=read('server/services/subscriptionService.ts');
    expect(service).toContain('SUBSCRIPTION_CHECKOUT_TTL_MS=30*60*1000');
    expect(service).toContain('isPendingCheckoutExpired(current)');
    expect(service).toContain("status:'CANCELED'");
    expect(service).toContain("checkout_url:''");
    expect(service).toContain('checkout_expires_at:new Date(Date.now()+SUBSCRIPTION_CHECKOUT_TTL_MS).toISOString()');
  });

  it('expires abandoned pending checkouts after 30 minutes and allows a fresh checkout',()=>{
    const service=read('server/services/subscriptionService.ts');
    expect(service).toContain('SUBSCRIPTION_CHECKOUT_TTL_MS=30*60*1000');
    expect(service).toContain('isPendingCheckoutExpired');
    expect(service).toContain("status:'CANCELED'");
    expect(service).toContain("checkout_url:''");
    expect(service).toContain('checkout_expires_at:new Date(Date.now()+SUBSCRIPTION_CHECKOUT_TTL_MS)');
  });
  it('reuses the existing verified Mercado Pago webhook endpoint',()=>{
    const routes=read('server/routes/paymentRoutes.ts');
    expect(routes).toContain("eventType.startsWith('subscription_')");
    expect(routes).toContain('subscriptionService.processWebhook');
  });
});
