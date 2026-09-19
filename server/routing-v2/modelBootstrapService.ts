import { routingV2Repository } from './repository.js';
import { routingV2ModelService } from './modelService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { ModelCategory } from '../../src/types/index.js';

// NOTA DE AUDITORIA: Apenas modelos comprovados em documentação oficial de vendors
// ❌ Removidos: falconsai-video-2, atlas-video-gen, runware-audio-turbo, runware-3d-gen, gpt-4o (não comprovados)
// ✅ Mantidos: flux-1-pro (Black Forest Labs oficial), stability-3.5-large (Stability AI oficial)

export const CANONICAL_MODELS = [
  {
    model_id: 'model-flux-1-pro',
    name: 'Flux 1 Pro',
    vendor: 'Black Forest Labs',
    category: 'IMAGE' as ModelCategory,
    description: 'High-quality image generation model - https://blackforestlabs.ai',
    capabilities: ['text-to-image' as CapabilityId],
  },
  {
    model_id: 'model-stability-3.5-large',
    name: 'Stability 3.5 Large',
    vendor: 'Stability AI',
    category: 'IMAGE' as ModelCategory,
    description: 'Stable Diffusion 3.5 large model for image generation - https://stability.ai',
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
