import { RoutingV2Currency, RoutingV2PricingSettings } from './domain.js';

export interface RoutingV2EconomicsInput{
  provider_cost:number;
  provider_currency:RoutingV2Currency;
  fx_rate_usd_brl?:number;
  settings:RoutingV2PricingSettings;
}

export interface RoutingV2EconomicsResult{
  provider_cost_brl:number;
  safe_cogs_brl:number;
  selling_price_brl:number;
  retail_credits:number;
  expected_margin_percent:number;
  credit_value_brl:number;
}

function roundMoney(value:number){
  return Math.round((value+Number.EPSILON)*1_000_000)/1_000_000;
}

export function validateRoutingV2PricingSettings(settings:RoutingV2PricingSettings){
  const margin=Number(settings.target_margin_percent);
  const buffer=Number(settings.safety_buffer_percent);
  const credit=Number(settings.reference_credit_value_brl);
  if(!Number.isFinite(margin)||margin<0||margin>=95)throw new Error('Margem alvo V2 deve ficar entre 0% e 95%.');
  if(!Number.isFinite(buffer)||buffer<0||buffer>100)throw new Error('Buffer de segurança V2 deve ficar entre 0% e 100%.');
  if(!Number.isFinite(credit)||credit<=0)throw new Error('Valor de referência do crédito deve ser positivo.');
  if(!Number.isFinite(settings.price_sync_interval_minutes)||settings.price_sync_interval_minutes<=0)throw new Error('Intervalo de price sync deve ser positivo.');
  if(!Number.isFinite(settings.price_freshness_ttl_minutes)||settings.price_freshness_ttl_minutes<=0)throw new Error('TTL de preço deve ser positivo.');
  if(!Number.isFinite(settings.stale_grace_minutes)||settings.stale_grace_minutes<0)throw new Error('Grace de preço inválido.');
}

export function calculateRoutingV2Economics(input:RoutingV2EconomicsInput):RoutingV2EconomicsResult{
  validateRoutingV2PricingSettings(input.settings);
  const providerCost=Number(input.provider_cost);
  if(!Number.isFinite(providerCost)||providerCost<0)throw new Error('Custo do provider inválido.');
  const fx=input.provider_currency==='USD'?Number(input.fx_rate_usd_brl):1;
  if(!Number.isFinite(fx)||fx<=0)throw new Error('FX USD/BRL válido é obrigatório para custo em USD.');

  const providerCostBrl=providerCost*fx;
  const safeCogs=providerCostBrl*(1+input.settings.safety_buffer_percent/100);
  const targetMargin=input.settings.target_margin_percent/100;
  const sellingPrice=safeCogs/(1-targetMargin);
  const retailCredits=Math.max(1,Math.ceil(sellingPrice/input.settings.reference_credit_value_brl));
  const realizedRevenue=retailCredits*input.settings.reference_credit_value_brl;
  const expectedMargin=realizedRevenue>0?(realizedRevenue-safeCogs)/realizedRevenue*100:0;

  return{
    provider_cost_brl:roundMoney(providerCostBrl),
    safe_cogs_brl:roundMoney(safeCogs),
    selling_price_brl:roundMoney(sellingPrice),
    retail_credits:retailCredits,
    expected_margin_percent:roundMoney(expectedMargin),
    credit_value_brl:input.settings.reference_credit_value_brl,
  };
}
