import { routingV2Repository } from './repository.js';
import { routingV2ModelService } from './modelService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { ModelCategory } from '../../src/types/index.js';

// O inventário inicial contém apenas modelos que também possuem mapping autenticado
// em um catálogo de provider. Modelos meramente documentados, sem Route comprovada,
// não são materializados no runtime.

export const CANONICAL_MODELS = [
  {
    model_id: 'model-flux-1-pro',
    name: 'Flux 1 Pro',
    vendor: 'Black Forest Labs',
    category: 'IMAGE' as ModelCategory,
    description: 'High-quality image generation model - https://blackforestlabs.ai',
    capabilities: ['text-to-image' as CapabilityId],
  },
];

export const routingV2ModelBootstrapService = {
  async bootstrapCanonical() {
    const result: {
      created: string[];
      existing: string[];
      failed: Array<{ model_id: string; error: string }>;
    } = {
      created: [],
      existing: [],
      failed: [],
    };

    for (const input of CANONICAL_MODELS) {
      try {
        if (await routingV2Repository.getModel(input.model_id)) {
          result.existing.push(input.model_id);
          continue;
        }
        await routingV2ModelService.create(input);
        result.created.push(input.model_id);
      } catch (error: any) {
        result.failed.push({
          model_id: input.model_id,
          error: String(error?.message || error),
        });
      }
    }

    return result;
  },
};
