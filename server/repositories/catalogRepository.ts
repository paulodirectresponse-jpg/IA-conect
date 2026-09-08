import {
  ModelRegistryItem,
  ProviderRegistryItem,
  ProviderModelMapping,
  PricingEntry,
  PromotionEntry,
  FeatureFlag,
} from '../../src/types/index.js';
import {
  INITIAL_MODELS,
  INITIAL_PROVIDERS,
  INITIAL_FEATURE_FLAGS,
} from '../../src/config/constants.js';

const modelsMap = new Map<string, ModelRegistryItem>();
const providersMap = new Map<string, ProviderRegistryItem>();
const mappingsMap = new Map<string, ProviderModelMapping>();
const pricingMap = new Map<string, PricingEntry>();
const promotionsMap = new Map<string, PromotionEntry>();
const flagsMap = new Map<string, FeatureFlag>();

// Seed initial system data if empty
function initSeeds() {
  if (modelsMap.size === 0) {
    for (const m of INITIAL_MODELS) {
      modelsMap.set(m.model_id, {
        ...m,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (providersMap.size === 0) {
    for (const p of INITIAL_PROVIDERS) {
      providersMap.set(p.provider_id, {
        ...p,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (flagsMap.size === 0) {
    for (const f of INITIAL_FEATURE_FLAGS) {
      flagsMap.set(f.flag_key, {
        ...f,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (pricingMap.size === 0) {
    // Initial standard pricing rates (in integer cents)
    const initialPricing: PricingEntry[] = [
      {
        pricing_id: 'price-wan-720p',
        provider_id: 'provider-atlas',
        model_id: 'wan-2-1-video',
        resolution: '720p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 35, // R$ 0,35 provider cost
        customer_price_cents: 75, // R$ 0,75 customer price
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        pricing_id: 'price-kling-1080p',
        provider_id: 'provider-wavespeed',
        model_id: 'kling-v1-5',
        resolution: '1080p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 80, // R$ 0,80 provider cost
        customer_price_cents: 160, // R$ 1,60 customer price
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
    ];
    for (const pr of initialPricing) {
      pricingMap.set(pr.pricing_id, pr);
    }
  }
}

initSeeds();

export const catalogRepository = {
  // --- Models ---
  async listModels(): Promise<ModelRegistryItem[]> {
    return Array.from(modelsMap.values());
  },

  async getModel(modelId: string): Promise<ModelRegistryItem | null> {
    return modelsMap.get(modelId) || null;
  },

  async saveModel(model: ModelRegistryItem): Promise<ModelRegistryItem> {
    modelsMap.set(model.model_id, { ...model });
    return { ...model };
  },

  // --- Providers ---
  async listProviders(): Promise<ProviderRegistryItem[]> {
    return Array.from(providersMap.values()).sort((a, b) => b.priority - a.priority);
  },

  async getProvider(providerId: string): Promise<ProviderRegistryItem | null> {
    return providersMap.get(providerId) || null;
  },

  async saveProvider(provider: ProviderRegistryItem): Promise<ProviderRegistryItem> {
    providersMap.set(provider.provider_id, { ...provider });
    return { ...provider };
  },

  // --- Provider Model Mappings ---
  async listMappings(): Promise<ProviderModelMapping[]> {
    return Array.from(mappingsMap.values());
  },

  async saveMapping(mapping: ProviderModelMapping): Promise<ProviderModelMapping> {
    mappingsMap.set(mapping.mapping_id, { ...mapping });
    return { ...mapping };
  },

  // --- Pricing ---
  async listPricing(): Promise<PricingEntry[]> {
    return Array.from(pricingMap.values());
  },

  async getPricing(pricingId: string): Promise<PricingEntry | null> {
    return pricingMap.get(pricingId) || null;
  },

  async savePricing(pricing: PricingEntry): Promise<PricingEntry> {
    pricingMap.set(pricing.pricing_id, { ...pricing });
    return { ...pricing };
  },

  // --- Promotions ---
  async listPromotions(): Promise<PromotionEntry[]> {
    return Array.from(promotionsMap.values());
  },

  async getPromotion(promotionId: string): Promise<PromotionEntry | null> {
    return promotionsMap.get(promotionId) || null;
  },

  async savePromotion(promotion: PromotionEntry): Promise<PromotionEntry> {
    promotionsMap.set(promotion.promotion_id, { ...promotion });
    return { ...promotion };
  },

  // --- Feature Flags ---
  async listFeatureFlags(): Promise<FeatureFlag[]> {
    return Array.from(flagsMap.values());
  },

  async getFeatureFlag(flagKey: string): Promise<FeatureFlag | null> {
    return flagsMap.get(flagKey) || null;
  },

  async saveFeatureFlag(flag: FeatureFlag): Promise<FeatureFlag> {
    flagsMap.set(flag.flag_key, { ...flag });
    return { ...flag };
  },

  clearForTesting() {
    modelsMap.clear();
    providersMap.clear();
    mappingsMap.clear();
    pricingMap.clear();
    promotionsMap.clear();
    flagsMap.clear();
    initSeeds();
  }
};
