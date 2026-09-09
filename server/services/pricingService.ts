import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { PricingEntry } from '../../src/types/index.js';
import { PRICE_VARIATION_WARNING_THRESHOLD_PERCENT } from '../../src/config/constants.js';

const STANDARD_GROSS_MARGIN = 0.40;
const priceForFortyPercentMargin = (providerCostCents:number) => Math.max(providerCostCents + 1, Math.ceil(providerCostCents / (1 - STANDARD_GROSS_MARGIN)));

export const pricingService = {
  async listPricing() { return catalogRepository.listPricing(); },

  async savePricing(params: { adminId:string; adminEmail:string; pricingData:Partial<PricingEntry>; reason:string; confirmed_high_variation?:boolean; }): Promise<PricingEntry> {
    const { adminId, adminEmail, pricingData, reason, confirmed_high_variation } = params;
    if (!pricingData.model_id || !pricingData.provider_id) throw new Error('Modelo e Provedor são obrigatórios para a precificação.');

    const providerCost = Math.round(pricingData.provider_cost_cents || 0);
    if (providerCost <= 0) throw new Error('Custo do provedor deve ser um inteiro positivo em centavos.');
    // A plataforma trabalha com uma única margem bruta operacional: 40%.
    // O preço ao cliente é sempre derivado do custo; o frontend não é fonte de verdade.
    const customerPrice = priceForFortyPercentMargin(providerCost);

    const pricingId = pricingData.pricing_id || `prc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const existing = await catalogRepository.getPricing(pricingId);
    if (existing && existing.customer_price_cents > 0) {
      const diffPercent = Math.abs(customerPrice - existing.customer_price_cents) / existing.customer_price_cents * 100;
      if (diffPercent >= PRICE_VARIATION_WARNING_THRESHOLD_PERCENT && !confirmed_high_variation) {
        const err:any = new Error(`Aviso de Variação de Preço: A nova precificação altera o valor em ${diffPercent.toFixed(1)}% (limiar seguro de ${PRICE_VARIATION_WARNING_THRESHOLD_PERCENT}%). Confirmação explícita é requerida.`);
        err.code='PRICE_VARIATION_HIGH'; err.diffPercent=diffPercent; throw err;
      }
    }

    const newEntry:PricingEntry={
      pricing_id:pricingId, provider_id:pricingData.provider_id, model_id:pricingData.model_id,
      resolution:pricingData.resolution||'720p', duration_seconds:pricingData.duration_seconds||5,
      unit:pricingData.unit||'PER_GENERATION', provider_cost_cents:providerCost, customer_price_cents:customerPrice,
      currency:'BRL', effective_from:pricingData.effective_from||new Date().toISOString(), effective_until:pricingData.effective_until||null,
      active:pricingData.active??true, updated_at:new Date().toISOString(),
    };
    const saved=await catalogRepository.savePricing(newEntry);
    await auditRepository.record({
      log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, admin_id:adminId, admin_email:adminEmail,
      action:existing?'PRICING_UPDATED':'PRICING_CREATED', entity_type:'PRICING', entity_id:pricingId,
      before:existing?{customer_price_cents:existing.customer_price_cents,provider_cost_cents:existing.provider_cost_cents}:null,
      after:{customer_price_cents:saved.customer_price_cents,provider_cost_cents:saved.provider_cost_cents,gross_margin_percent:40},
      reason:reason||'Atualização de tabela de preços', created_at:new Date().toISOString(),
    });
    return saved;
  },
};
