import { routingV2Repository } from './repository.js';
import { routingV2RouteService } from './routeService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { CANONICAL_MODELS } from './modelBootstrapService.js';
import { RoutingV2BillingConfig } from './domain.js';

// NOTA DE AUDITORIA: Apenas routes comprovadas com provider_model_identifier validados
// ❌ Removidas: falconsai-video-2, atlas-video-gen, runware-audio-turbo, runware-3d-gen, gpt-4o (não comprovados)
// ✅ Mantidas: Flux 1 Pro + WaveSpeed/Runware, Stability 3.5 + WaveSpeed/Atlas (potencialmente válidas)

interface RouteMapping {
  model_id: string;
  capability_id: CapabilityId;
  provider_id: string;
  provider_model_identifier: string;
}

export const CANONICAL_ROUTES: RouteMapping[] = [
  // Flux 1 Pro routes - provider_model_identifier pendente validação em API real
  {
    model_id: 'model-flux-1-pro',
    capability_id: 'text-to-image',
    provider_id: 'provider-wavespeed',
    provider_model_identifier: 'flux-1-pro',
  },
  {
    model_id: 'model-flux-1-pro',
    capability_id: 'text-to-image',
    provider_id: 'provider-runware',
    provider_model_identifier: 'flux-1-pro',
  },

  // Stability 3.5 Large routes - provider_model_identifier pendente validação em API real
  // NOTE: Atlas Cloud não suporta TEXT_TO_IMAGE (adapter returns false for this mode)
  // Atlas só suporta video generation — removido de routes válidas
  {
    model_id: 'model-stability-3.5-large',
    capability_id: 'text-to-image',
    provider_id: 'provider-wavespeed',
    provider_model_identifier: 'stability-3.5-large',
  },
];

const defaultBillingConfig: RoutingV2BillingConfig = {
  type: 'PER_GENERATION',
  currency: 'USD',
  price_per_generation: 0,
};

export const routingV2RouteBootstrapService = {
  async bootstrapCanonical() {
    const result: {
      created: string[];
      existing: string[];
      failed: Array<{ route_key: string; error: string }>;
    } = {
      created: [],
      existing: [],
      failed: [],
    };

    for (const mapping of CANONICAL_ROUTES) {
      const routeKey = `${mapping.model_id}/${mapping.capability_id}/${mapping.provider_id}`;

      try {
        // Check if route already exists
        const existing = await routingV2Repository.listRoutes();
        const alreadyExists = existing.some(
          r =>
            r.model_id === mapping.model_id &&
            r.capability_id === mapping.capability_id &&
            r.provider_id === mapping.provider_id
        );

        if (alreadyExists) {
          result.existing.push(routeKey);
          continue;
        }

        // Create route with status DISCOVERED
        await routingV2RouteService.create({
          model_id: mapping.model_id,
          capability_id: mapping.capability_id,
          provider_id: mapping.provider_id,
          provider_model_identifier: mapping.provider_model_identifier,
          billing_config: defaultBillingConfig,
        });

        result.created.push(routeKey);
      } catch (error: any) {
        result.failed.push({
          route_key: routeKey,
          error: String(error?.message || error),
        });
      }
    }

    return result;
  },
};
