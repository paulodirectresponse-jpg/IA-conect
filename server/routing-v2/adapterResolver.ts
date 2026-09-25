import { RoutingV2Provider } from './domain.js';
import { routingV2AdapterRegistry } from './adapterRegistry.js';
import { ensureRoutingV2LegacyAdapter } from './legacyAdapterBridge.js';
import { createRoutingV2LegacyWrapperAdapter } from './legacyWrapperAdapter.js';

export function resolveRoutingV2ProviderAdapter(provider:RoutingV2Provider){
  const direct=routingV2AdapterRegistry.get(provider.adapter_id);
  if(direct)return direct;
  const adapterId=String(provider.adapter_id||'');
  if(adapterId.startsWith('legacy:')){
    const providerId=adapterId.slice('legacy:'.length).trim();
    if(providerId)return ensureRoutingV2LegacyAdapter(providerId);
  }
  if(adapterId.startsWith('wrapper:')){
    const providerId=adapterId.slice('wrapper:'.length).trim();
    if(providerId)return createRoutingV2LegacyWrapperAdapter(providerId);
  }
  // Compatibility fallback for existing persisted providers created before
  // the wrapper resolver became authoritative.
  return createRoutingV2LegacyWrapperAdapter(provider.provider_id);
}
