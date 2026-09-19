// Import and register all health checks
import './providers/wavespeedHealthCheck.js';
import './providers/atlasHealthCheck.js';
import './providers/runwareHealthCheck.js';

export { providerHealthService } from './providerHealthService.js';
export { routingV2HealthAdminRoutes } from './adminHealthRoutes.js';
export { checkProviderHealth, getProviderHealthCheck } from './healthAdapter.js';
