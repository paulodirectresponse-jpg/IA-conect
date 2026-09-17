import { ProviderGenerationParams, VideoProviderAdapter } from './videoProviderAdapter.js';
import { AtlasProviderAdapter } from './atlasProviderAdapter.js';
import { WaveSpeedProviderAdapter } from './wavespeedProviderAdapter.js';
import {
  RunwareProviderAdapter,
  FalProviderAdapter,
  DeepInfraProviderAdapter,
  ReplicateProviderAdapter,
  AimlProviderAdapter,
  PiApiProviderAdapter,
  KieProviderAdapter,
} from './multiProviderAdapters.js';

function providerSafeParams(params:ProviderGenerationParams):ProviderGenerationParams{
  const pricing_options={...(params.pricing_options||{})};
  delete pricing_options.preferred_provider_id;
  return{...params,pricing_options};
}

function protectedAdapter(adapter:VideoProviderAdapter):VideoProviderAdapter{
  return{
    providerId:adapter.providerId,
    name:adapter.name,
    isConfigured:()=>adapter.isConfigured(),
    supports:(modelId,mode,providerModelIdentifier)=>adapter.supports(modelId,mode,providerModelIdentifier),
    quoteCostUsd:adapter.quoteCostUsd?(params)=>adapter.quoteCostUsd!(providerSafeParams(params)):undefined,
    submitGeneration:(params)=>adapter.submitGeneration(providerSafeParams(params)),
    checkStatus:(providerJobId)=>adapter.checkStatus(providerJobId),
    cancelJob:adapter.cancelJob?(providerJobId)=>adapter.cancelJob!(providerJobId):undefined,
  };
}

class ProviderRegistry {
  private adapters = new Map<string, VideoProviderAdapter>();

  constructor() {
    this.register(new AtlasProviderAdapter());
    this.register(new WaveSpeedProviderAdapter());
    this.register(new RunwareProviderAdapter());
    this.register(new FalProviderAdapter());
    this.register(new DeepInfraProviderAdapter());
    this.register(new ReplicateProviderAdapter());
    this.register(new AimlProviderAdapter());
    this.register(new PiApiProviderAdapter());
    this.register(new KieProviderAdapter());
  }

  register(adapter: VideoProviderAdapter) {
    this.adapters.set(adapter.providerId, protectedAdapter(adapter));
  }

  getAdapter(providerId: string): VideoProviderAdapter | null {
    return this.adapters.get(providerId) || null;
  }

  listAdapters(): VideoProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const providerRegistry = new ProviderRegistry();
