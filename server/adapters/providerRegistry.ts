import { VideoProviderAdapter } from './videoProviderAdapter.js';
import { AtlasProviderAdapter } from './atlasProviderAdapter.js';
import { WaveSpeedProviderAdapter } from './wavespeedProviderAdapter.js';

class ProviderRegistry {
  private adapters = new Map<string, VideoProviderAdapter>();

  constructor() {
    this.register(new AtlasProviderAdapter());
    this.register(new WaveSpeedProviderAdapter());
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
