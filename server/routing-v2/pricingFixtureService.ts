import { RoutingV2BillingConfig } from './domain.js';

export const PROVIDER_PRICING_FIXTURES: Record<string, Record<string, RoutingV2BillingConfig>> = {
  'provider-wavespeed': {
    // WaveSpeed pricing: typically per-generation or token-based
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
    'gpt-4o': {
      type: 'PER_CHARACTER',
      currency: 'USD',
      price_per_unit: 0.000002,
      characters_per_unit: 1,
    },
    'falconsai-video-2': {
      type: 'PER_SECOND',
      currency: 'USD',
      price_per_second: 0.1,
    },
  },
  'provider-atlas': {
    // Atlas Cloud pricing
    'atlas-image-gen': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.03,
    },
    'atlas-video-gen': {
      type: 'PER_SECOND',
      currency: 'USD',
      price_per_second: 0.15,
    },
  },
  'provider-runware': {
    // Runware pricing
    'flux-1-pro': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.045,
    },
    'falconsai-video-2': {
      type: 'PER_SECOND',
      currency: 'USD',
      price_per_second: 0.12,
    },
    'runware-audio-turbo': {
      type: 'PER_CHARACTER',
      currency: 'USD',
      price_per_unit: 0.000015,
      characters_per_unit: 1,
    },
    'runware-3d-gen': {
      type: 'PER_GENERATION',
      currency: 'USD',
      price_per_generation: 0.5,
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
