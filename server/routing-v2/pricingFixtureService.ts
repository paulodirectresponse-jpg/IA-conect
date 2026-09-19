import { RoutingV2BillingConfig } from './domain.js';

// NOTA DE AUDITORIA: Pricing fixtures são apenas para modelos comprovados
// ❌ Removidos: falconsai-video-2, atlas-video-gen, runware-audio-turbo, runware-3d-gen, gpt-4o
// ⚠️ IMPORTANTE: Estes preços são FIXTURES, não refletem APIs reais
// Reconciler não marcará Routes como READY sem implementação real de adapter.getPrice()

export const PROVIDER_PRICING_FIXTURES: Record<string, Record<string, RoutingV2BillingConfig>> = {
  'provider-wavespeed': {
    // WaveSpeed pricing: FIXTURE ONLY - pendente validação em API real
    'flux-1-pro': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.05,
    },
    'stability-3.5-large': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.02,
    },
  },
  'provider-atlas': {
    // Atlas Cloud pricing: FIXTURE ONLY - pendente validação em API real
    'stability-3.5-large': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.03,
    },
  },
  'provider-runware': {
    // Runware pricing: FIXTURE ONLY - pendente validação em API real
    'flux-1-pro': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.045,
    },
  },
};

export const routingV2PricingFixtureService = {
  getFixturePricing(
    provider_id: string,
    provider_model_identifier: string
  ): RoutingV2BillingConfig | null {
    return PROVIDER_PRICING_FIXTURES[provider_id]?.[provider_model_identifier] || null;
  },
};
