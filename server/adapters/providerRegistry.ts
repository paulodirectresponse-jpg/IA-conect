import { VideoProviderAdapter } from './videoProviderAdapter.js';
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
    this.adapters.set(adapter.providerId, adapter);
  }

  getAdapter(providerId: string): VideoProviderAdapter | null {
    return this.adapters.get(providerId) || null;
  }

  listAdapters(): VideoProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const providerRegistry = new ProviderRegistry();
