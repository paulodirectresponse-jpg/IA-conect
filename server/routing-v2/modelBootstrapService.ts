import { routingV2Repository } from './repository.js';
import { routingV2ModelService } from './modelService.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { ModelCategory } from '../../src/types/index.js';

export const CANONICAL_MODELS = [
  {
    model_id: 'model-flux-1-pro',
    name: 'Flux 1 Pro',
    vendor: 'Black Forest Labs',
    category: 'IMAGE' as ModelCategory,
    description: 'High-quality image generation model',
    capabilities: ['text-to-image' as CapabilityId],
  },
  {
    model_id: 'model-stability-3.5-large',
    name: 'Stability 3.5 Large',
    vendor: 'Stability AI',
    category: 'IMAGE' as ModelCategory,
    description: 'Stable Diffusion 3.5 large model for image generation',
    capabilities: ['text-to-image' as CapabilityId],
  },
  {
    model_id: 'model-openai-gpt-4o',
    name: 'GPT-4o',
    vendor: 'OpenAI',
    category: 'OTHER' as ModelCategory,
    description: 'OpenAI GPT-4 Omni text generation model',
    capabilities: ['text-to-audio' as CapabilityId],
  },
  {
    model_id: 'model-falconsai-video-2',
    name: 'FalconSAI Video 2',
    vendor: 'FalconSAI',
    category: 'VIDEO' as ModelCategory,
    description: 'Video generation model',
    capabilities: ['text-to-video' as CapabilityId],
  },
  {
    model_id: 'model-atlas-video-gen',
    name: 'Atlas Video Generator',
    vendor: 'Atlas Cloud',
    category: 'VIDEO' as ModelCategory,
    description: 'Video generation via Atlas Cloud',
    capabilities: ['text-to-video' as CapabilityId],
  },
  {
    model_id: 'model-runware-audio-turbo',
    name: 'Runware Audio Turbo',
    vendor: 'Runware',
    category: 'AUDIO' as ModelCategory,
    description: 'Audio generation model',
    capabilities: ['text-to-speech' as CapabilityId],
  },
  {
    model_id: 'model-runware-3d-gen',
    name: 'Runware 3D Generator',
    vendor: 'Runware',
    category: 'MODEL_3D' as ModelCategory,
    description: '3D model generation',
    capabilities: ['text-to-3d' as CapabilityId],
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
