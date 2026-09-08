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
      const isActive = p.provider_id === 'provider-atlas' || p.provider_id === 'provider-wavespeed';
      providersMap.set(p.provider_id, {
        ...p,
        status: isActive ? 'ACTIVE' : p.status,
        is_configured: isActive ? true : p.is_configured,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (mappingsMap.size === 0) {
    const defaultMappings: ProviderModelMapping[] = [
      {
        mapping_id: 'map-wan-atlas',
        provider_id: 'provider-atlas',
        model_id: 'wan-2-1-video',
        status: 'ACTIVE',
        provider_model_code: 'wan-2.1-v',
        priority: 100,
        supports_stream: false,
        supports_async: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        mapping_id: 'map-wan-wavespeed',
        provider_id: 'provider-wavespeed',
        model_id: 'wan-2-1-video',
        status: 'ACTIVE',
        provider_model_code: 'wan-2-1',
        priority: 90,
        supports_stream: false,
        supports_async: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        mapping_id: 'map-kling-wavespeed',
        provider_id: 'provider-wavespeed',
        model_id: 'kling-v1-5',
        status: 'ACTIVE',
        provider_model_code: 'kling-1.5-pro',
        priority: 100,
        supports_stream: false,
        supports_async: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        mapping_id: 'map-kling-atlas',
        provider_id: 'provider-atlas',
        model_id: 'kling-v1-5',
        status: 'ACTIVE',
        provider_model_code: 'kling-1.5',
        priority: 90,
        supports_stream: false,
        supports_async: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        mapping_id: 'map-hunyuan-atlas',
        provider_id: 'provider-atlas',
        model_id: 'hunyuan-video',
        status: 'ACTIVE',
        provider_model_code: 'hunyuan-fast',
        priority: 100,
        supports_stream: false,
        supports_async: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    for (const m of defaultMappings) {
      mappingsMap.set(m.mapping_id, m);
    }
  }

  if (flagsMap.size === 0) {
    for (const f of INITIAL_FEATURE_FLAGS) {
      // Enable auto router and providers in Stage 3
      const isRouterOrProvider = f.flag_key === 'enable_auto_router' || f.flag_key === 'enable_atlas' || f.flag_key === 'enable_wavespeed' || f.flag_key === 'enable_payments';
      flagsMap.set(f.flag_key, {
        ...f,
        is_enabled: isRouterOrProvider ? true : f.is_enabled,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (pricingMap.size === 0) {
    // Standard pricing rates for all model and resolution combinations
    const initialPricing: PricingEntry[] = [
      // WAN 2.1 Video
      {
        pricing_id: 'price-wan-720p',
        provider_id: 'provider-atlas',
        model_id: 'wan-2-1-video',
        resolution: '720p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 35,
        customer_price_cents: 75,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        pricing_id: 'price-wan-1080p',
        provider_id: 'provider-atlas',
        model_id: 'wan-2-1-video',
        resolution: '1080p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 65,
        customer_price_cents: 140,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        pricing_id: 'price-wan-wavespeed-720p',
        provider_id: 'provider-wavespeed',
        model_id: 'wan-2-1-video',
        resolution: '720p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 40,
        customer_price_cents: 80,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      // Kling 1.5
      {
        pricing_id: 'price-kling-720p',
        provider_id: 'provider-wavespeed',
        model_id: 'kling-v1-5',
        resolution: '720p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 45,
        customer_price_cents: 95,
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
        provider_cost_cents: 80,
        customer_price_cents: 160,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        pricing_id: 'price-kling-atlas-1080p',
        provider_id: 'provider-atlas',
        model_id: 'kling-v1-5',
        resolution: '1080p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 85,
        customer_price_cents: 170,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      // Hunyuan Video Fast
      {
        pricing_id: 'price-hunyuan-540p',
        provider_id: 'provider-atlas',
        model_id: 'hunyuan-video',
        resolution: '540p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 20,
        customer_price_cents: 45,
        currency: 'BRL',
        effective_from: new Date().toISOString(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        pricing_id: 'price-hunyuan-720p',
        provider_id: 'provider-atlas',
        model_id: 'hunyuan-video',
        resolution: '720p',
        duration_seconds: 5,
        unit: 'PER_GENERATION',
        provider_cost_cents: 25,
        customer_price_cents: 55,
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
