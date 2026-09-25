import { packCatalogService } from './packCatalogService.js';
import { routingV2Repository } from '../routing-v2/repository.js';
import { DEFAULT_ROUTING_V2_PRICING_SETTINGS } from '../routing-v2/pricingSettingsService.js';

export const APPROVED_COMMERCIAL_PLANS={
  creator:{version:2,price_brl_cents:4990,total_credits:5000},
  pro:{version:2,price_brl_cents:9990,total_credits:11000},
  studio:{version:2,price_brl_cents:19990,total_credits:23500},
} as const;

export const APPROVED_ECONOMICS={
  target_margin_percent:55,
  safety_buffer_percent:8,
  reference_credit_value_brl:0.01,
  price_sync_interval_minutes:30,
  price_freshness_ttl_minutes:120,
  stale_grace_minutes:0,
} as const;

export const COMMERCIAL_TECHNICAL_MARGIN_FLOOR_PERCENT=45;

export function calculatePlanTechnicalMargin(priceBrlCents:number,totalCredits:number,referenceCreditValueBrl=0.01,targetMarginPercent=55){
  const revenuePerCredit=(priceBrlCents/100)/Math.max(1,totalCredits);
  const safeCogsPerReferenceCredit=referenceCreditValueBrl*(1-targetMarginPercent/100);
  return revenuePerCredit>0?((revenuePerCredit-safeCogsPerReferenceCredit)/revenuePerCredit)*100:-Infinity;
}

export const commercialQaService={
  async snapshot(){
    const [storedSettings,routes]=await Promise.all([
      routingV2Repository.getPricingSettings(),
      routingV2Repository.listRoutes(),
    ]);
    const settings=storedSettings||DEFAULT_ROUTING_V2_PRICING_SETTINGS;
    const plans=packCatalogService.list();

    const planRows=plans.map(plan=>{
      const approved=(APPROVED_COMMERCIAL_PLANS as Record<string,{version:number;price_brl_cents:number;total_credits:number}>)[plan.pack_id];
      const technical_margin_percent=calculatePlanTechnicalMargin(
        plan.price_brl_cents,
        plan.total_credits,
        Number(settings.reference_credit_value_brl),
        Number(settings.target_margin_percent),
      );
      return{
        pack_id:plan.pack_id,
        price_brl_cents:plan.price_brl_cents,
        total_credits:plan.total_credits,
        matches_approved:Boolean(approved&&approved.version===plan.version&&approved.price_brl_cents===plan.price_brl_cents&&approved.total_credits===plan.total_credits),
        technical_margin_percent,
        margin_safe:technical_margin_percent>=COMMERCIAL_TECHNICAL_MARGIN_FLOOR_PERCENT,
      };
    });

    const economics_ok=
      Number(settings.target_margin_percent)===APPROVED_ECONOMICS.target_margin_percent&&
      Number(settings.safety_buffer_percent)===APPROVED_ECONOMICS.safety_buffer_percent&&
      Number(settings.reference_credit_value_brl)===APPROVED_ECONOMICS.reference_credit_value_brl&&
      Number(settings.price_sync_interval_minutes)===APPROVED_ECONOMICS.price_sync_interval_minutes&&
      Number(settings.price_freshness_ttl_minutes)===APPROVED_ECONOMICS.price_freshness_ttl_minutes&&
      Number(settings.stale_grace_minutes)===APPROVED_ECONOMICS.stale_grace_minutes;

    const exact_plan_set=plans.length===3&&Object.keys(APPROVED_COMMERCIAL_PLANS).every(id=>planRows.some(row=>row.pack_id===id&&row.matches_approved));
    const plan_margins_safe=planRows.every(row=>row.margin_safe);
    const ready=routes.filter(route=>route.status==='READY'&&route.pricing_status==='CURRENT'&&route.runtime_status==='HEALTHY');
    const ready_margin_violations=ready.filter(route=>Number(route.pricing_snapshot?.expected_margin_percent||0)+0.01<Number(settings.target_margin_percent));
    const payment_configured=Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
    const webhook_configured=Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim());

    const problems:string[]=[];
    if(!economics_ok)problems.push('Economics diferente da política aprovada.');
    if(!exact_plan_set)problems.push('Catálogo comercial diferente de Creator/Pro/Studio aprovado.');
    if(!plan_margins_safe)problems.push('Um plano caiu abaixo do piso de contribuição técnica.');
    if(ready_margin_violations.length)problems.push(`${ready_margin_violations.length} Route(s) READY abaixo da margem alvo.`);
    if(!payment_configured)problems.push('Mercado Pago sem access token.');
    if(!webhook_configured)problems.push('Mercado Pago sem webhook secret.');

    return{
      status:problems.length?'DEGRADED' as const:'OK' as const,
      checked_at:new Date().toISOString(),
      economics_ok,
      exact_plan_set,
      plan_margins_safe,
      payment_configured,
      webhook_configured,
      ready_routes:ready.length,
      ready_margin_violations:ready_margin_violations.length,
      plans:planRows,
      problems,
    };
  },
};
