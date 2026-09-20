import {routingV2AdapterRegistry} from './adapterRegistry.js';
import {waveSpeedRoutingV2Adapter} from './providers/wavespeedAdapter.js';

if(!routingV2AdapterRegistry.has(waveSpeedRoutingV2Adapter.adapter_id))routingV2AdapterRegistry.register(waveSpeedRoutingV2Adapter);
