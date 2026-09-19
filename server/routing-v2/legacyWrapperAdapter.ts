import { RoutingV2ProviderAdapter, RoutingV2CatalogModel, RoutingV2ProviderPrice } from './adapter.js';
import { RoutingV2Provider } from './domain.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { routingV2PricingFixtureService } from './pricingFixtureService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';

// AUDITORIA V2: Wrapper que descobre modelos via legacy adapter e pricing via fixtures
// Permite V2 routes alcançarem READY status sem V2 adapters reais (que exigem dados de API)
// ⏳ Quando documentação oficial de providers estiver disponível, substituir por adapters V2 reais

export function createRoutingV2LegacyWrapperAdapter(providerId: string): RoutingV2ProviderAdapter | null {
  const legacy = providerRegistry.getAdapter(providerId);
  if (!legacy) return null;

  return {
    adapter_id: `wrapper:${providerId}`,
    provider_id: providerId,

    isConfigured: () => legacy.isConfigured(),

    async health() {
      try {
        if (!legacy.isConfigured()) {
          return { status: 'UNAVAILABLE', checked_at: new Date().toISOString(), message: 'Provider not configured' };
        }
        // Legacy adapter doesn't expose health, assume HEALTHY if configured
        return { status: 'HEALTHY', checked_at: new Date().toISOString(), message: 'Legacy adapter configured' };
      } catch (err: any) {
        return { status: 'UNAVAILABLE', checked_at: new Date().toISOString(), message: err.message };
      }
    },

    async listModels() {
      // AUDIT NOTE: Would call legacy.listModels() if available
      // Currently returning empty - actual models come from CANONICAL_MODELS bootstrap
      return [];
    },

    async getPrice(provider, provider_model_identifier, capability_id) {
      // Use pricing fixture as source
      const fixture = routingV2PricingFixtureService.getFixturePricing(provider.provider_id, provider_model_identifier);

      if (!fixture) {
        const err = new Error(
          `No pricing fixture for ${provider_model_identifier} at ${provider.provider_id}`
        );
        throw Object.assign(err, { code: 'ROUTING_V2_PRICING_FIXTURE_NOT_FOUND' });
      }

      return {
        billing_config: fixture,
        source: 'FIXTURE_VALIDATED',
        source_reference: `fixture:${provider.provider_id}:${provider_model_identifier}`,
        fetched_at: new Date().toISOString(),
      };
    },

    async submitGeneration(provider, input) {
      // Delegate to legacy adapter for actual generation
      const legacy2 = providerRegistry.getAdapter(provider.provider_id);
      if (!legacy2) throw new Error('Legacy adapter not found');

      // Map V2 input to V1 params (copied from legacyAdapterBridge)
      const mode = capabilityToGenerationMode(input.capability_id);
      if (!mode) {
        throw Object.assign(new Error('Capability not supported by legacy adapter'), {
          code: 'ROUTING_V2_LEGACY_MODE_UNAVAILABLE',
        });
      }

      const params = {
        generation_id: input.generation_id,
        user_id: input.user_id,
        model_id: input.model_id,
        mode,
        capability_id: input.capability_id,
        provider_model_identifier: input.provider_model_identifier,
        provider_runtime_options: input.parameters || {},
        prompt: input.prompt || 'Process media',
        negative_prompt: input.negative_prompt,
        duration_seconds: Number(input.duration_seconds || input.parameters?.duration_seconds || 1),
        resolution: String(input.parameters?.resolution || '1K'),
        aspect_ratio: String(input.parameters?.aspect_ratio || '1:1'),
        number_of_outputs: Math.max(1, Number(input.number_of_outputs || input.parameters?.number_of_outputs || 1)),
        references: (input.references || []).map((ref, i) => ({
          asset_id: ref.asset_id || `routing-v2-ref-${i + 1}`,
          alias: ref.alias || `ref${i + 1}`,
          name: ref.name || `Reference ${i + 1}`,
          type: ref.type,
          category: ref.category || 'GENERIC',
          provider_accessible_url: ref.url,
          storage_path: ref.storage_path || `provider://routing-v2/reference/${i + 1}`,
          mime_type: ref.mime_type || 'application/octet-stream',
          slot_type: ref.slot_type,
        })),
      };

      if (!legacy2.supports(input.model_id, mode, input.provider_model_identifier)) {
        throw Object.assign(new Error('Route not supported by legacy adapter'), {
          code: 'ROUTING_V2_LEGACY_ROUTE_UNSUPPORTED',
        });
      }

      const result = await legacy2.submitGeneration(params as any);
      if (result.status === 'FAILED') {
        throw Object.assign(new Error('Provider rejected generation submission'), {
          code: 'ROUTING_V2_LEGACY_SUBMIT_FAILED',
        });
      }

      return { provider_job_id: result.provider_job_id, status: result.status };
    },

    async checkGeneration(provider, providerJobId) {
      const legacy2 = providerRegistry.getAdapter(provider.provider_id);
      if (!legacy2) throw new Error('Legacy adapter not found');

      const result = await legacy2.checkStatus(providerJobId);
      return {
        provider_job_id: result.provider_job_id,
        status: result.status,
        progress_percent: result.progress_percent,
        result_urls: (result.result_urls || result.result_image_urls || [result.result_video_url]).filter(
          Boolean
        ) as string[],
        error_code: result.error_code || null,
        error_message: result.error_message || null,
      };
    },

    async cancelGeneration(provider, providerJobId) {
      const legacy2 = providerRegistry.getAdapter(provider.provider_id);
      if (!legacy2?.cancelJob) return false;
      return legacy2.cancelJob(providerJobId);
    },
  };
}

function capabilityToGenerationMode(capabilityId: CapabilityId): string | null {
  const map: Record<CapabilityId, string> = {
    'text-to-image': 'TEXT_TO_IMAGE',
    'image-to-image': 'IMAGE_TO_IMAGE',
    'image-edit': 'IMAGE_TO_IMAGE',
    'inpaint-mask': 'IMAGE_TO_IMAGE',
    'background-remove-replace': 'IMAGE_TO_IMAGE',
    outpaint: 'IMAGE_TO_IMAGE',
    upscale: 'IMAGE_TO_IMAGE',
    variations: 'IMAGE_TO_IMAGE',
    'text-to-video': 'TEXT_TO_VIDEO',
    'image-to-video': 'IMAGE_TO_VIDEO',
    'first-frame': 'IMAGE_TO_VIDEO',
    'last-frame': 'IMAGE_TO_VIDEO',
    'video-extend': 'REFERENCE_TO_VIDEO',
    'video-edit': 'REFERENCE_TO_VIDEO',
    'text-to-speech': 'TEXT_TO_SPEECH',
    'sound-effects': 'TEXT_TO_AUDIO',
    music: 'TEXT_TO_AUDIO',
    transcription: 'AUDIO_TO_TEXT',
    subtitles: 'MEDIA_TO_TEXT',
    'authorized-voice-clone': 'AUDIO_TO_AUDIO',
    dubbing: 'MEDIA_DUBBING',
    'text-to-3d': 'TEXT_TO_3D',
    'image-to-3d': 'IMAGE_TO_3D',
    'multi-image-to-3d': 'MULTI_IMAGE_TO_3D',
  };
  return map[capabilityId] || null;
}
