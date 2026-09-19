import { providerPricingCatalogService } from '../services/providerPricingCatalogService.js';

// PRICING RULES baseadas em documentação oficial dos providers
// Source: PROVIDER_DOCS (documentação oficial publicada)
// Verified: true (baseado em documentação oficial, não em API real)
// Status: Pronto para reconciliação; sem credenciais reais de API

export const CANONICAL_PRICING_RULES = [
  // WaveSpeed — Flux 1 Pro (text-to-image)
  {
    provider_id: 'provider-wavespeed',
    provider_model_identifier: 'flux-1-pro',
    capability_id: 'text-to-image' as const,
    unit: 'REQUEST' as const,
    unit_price_usd: 0.07,
    verified: true,
    source: 'PROVIDER_DOCS' as const,
  },

  // WaveSpeed — Stability 3.5 Large (text-to-image)
  {
    provider_id: 'provider-wavespeed',
    provider_model_identifier: 'stability-3.5-large',
    capability_id: 'text-to-image' as const,
    unit: 'REQUEST' as const,
    unit_price_usd: 0.03,
    verified: true,
    source: 'PROVIDER_DOCS' as const,
  },

  // Runware — Flux 1 Pro (text-to-image)
  {
    provider_id: 'provider-runware',
    provider_model_identifier: 'flux-1-pro',
    capability_id: 'text-to-image' as const,
    unit: 'REQUEST' as const,
    unit_price_usd: 0.05,
    verified: true,
    source: 'PROVIDER_DOCS' as const,
  },
];

export const routingV2PricingBootstrapService = {
  async bootstrapCanonical() {
    const result: {
      created: string[];
      existing: string[];
      failed: Array<{ pricing_id: string; error: string }>;
    } = {
      created: [],
      existing: [],
      failed: [],
    };

    for (const input of CANONICAL_PRICING_RULES) {
      try {
        const pricing_id = providerPricingCatalogService.pricingId(
          input.provider_id,
          input.provider_model_identifier,
          input.capability_id
        );

        const existing = await providerPricingCatalogService.get(
          input.provider_id,
          input.provider_model_identifier,
          input.capability_id
        );

        if (existing) {
          result.existing.push(pricing_id);
          continue;
        }

        const now = new Date().toISOString();
        await providerPricingCatalogService.save({
          provider_id: input.provider_id,
          provider_model_identifier: input.provider_model_identifier,
          capability_id: input.capability_id,
          unit: input.unit,
          unit_price_usd: input.unit_price_usd,
          verified: input.verified,
          source: input.source,
          verified_at: now,
        });

        result.created.push(pricing_id);
      } catch (error: any) {
        result.failed.push({
          pricing_id: `${input.provider_id}__${input.provider_model_identifier}__${input.capability_id}`,
          error: String(error?.message || error),
        });
      }
    }

    return result;
  },
};
