import { RoutingV2ProviderAdapter } from './adapter.js';
import { CapabilityId } from '../beta/capabilityRegistry.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { listAtlasCatalogModels, listRunwareCatalogModels, listWaveSpeedCatalogModels } from './providerCatalogService.js';
import { checkProviderHealth } from './healthAdapter.js';

// Compatibility wrapper used only for execution delegation while HYBRID is active.
//
// IMPORTANT:
// - It MUST NOT fabricate provider health.
// - It MUST NOT fabricate pricing.
// - It MUST NOT fabricate catalog evidence.
// Catalog discovery is exposed only where the provider has a verified live catalog source.
// Health and pricing remain factual and are not inferred by this wrapper.


function assertIdentifierMatchesCapability(identifier:string,capabilityId:CapabilityId){
  const value=String(identifier||'').toLowerCase();
  if(capabilityId==='text-to-image'&&/(?:\/|\b)(edit|image-to-image|reference-to-image)(?:\/|$)/.test(value)){
    throw Object.assign(new Error('Identifier de edição não pode ser usado como text-to-image.'),{code:'ROUTING_V2_MAPPING_CAPABILITY_MISMATCH'});
  }
  if(['image-edit','image-to-image'].includes(capabilityId)&&/(?:\/|\b)text-to-image(?:\/|$)/.test(value)){
    throw Object.assign(new Error('Identifier text-to-image não pode ser usado como edição.'),{code:'ROUTING_V2_MAPPING_CAPABILITY_MISMATCH'});
  }
}

export function createRoutingV2LegacyWrapperAdapter(providerId: string): RoutingV2ProviderAdapter | null {
  const legacy = providerRegistry.getAdapter(providerId);
  if (!legacy) return null;

  return {
    adapter_id: `wrapper:${providerId}`,
    provider_id: providerId,

    isConfigured: () => legacy.isConfigured(),

    listModels: providerId === 'provider-atlas'
      ? async () => listAtlasCatalogModels()
      : providerId === 'provider-runware'
        ? async (_provider, query) => listRunwareCatalogModels(query)
        : providerId === 'provider-wavespeed'
          ? async (_provider, query) => listWaveSpeedCatalogModels(query)
          : undefined,

    async health(provider) {
      return checkProviderHealth(provider);
    },

    getPrice: legacy.quoteCostUsd ? async (_provider, providerModelIdentifier, capabilityId) => {
      assertIdentifierMatchesCapability(providerModelIdentifier,capabilityId);
      if(providerId==='provider-wavespeed'){
        const rows=await listWaveSpeedCatalogModels(providerModelIdentifier);
        const exact=rows.find(row=>row.provider_model_identifier===providerModelIdentifier);
        const basePrice=Number((exact?.metadata as any)?.base_price);
        if(Number.isFinite(basePrice)&&basePrice>0){
          return{
            billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:basePrice},
            source:'PROVIDER_CATALOG_API',
            source_reference:'https://api.wavespeed.ai/api/v3/models',
            fetched_at:new Date().toISOString(),
          };
        }
      }
      const mode=capabilityToGenerationMode(capabilityId);
      if(!mode)throw Object.assign(new Error('Capability sem modo de pricing compatível.'),{code:'ROUTING_V2_PRICE_MODE_UNAVAILABLE'});
      const quote=await legacy.quoteCostUsd!({
        generation_id:'routing-v2-price-probe',
        user_id:'routing-v2-system',
        model_id:providerModelIdentifier,
        mode:mode as any,
        capability_id:capabilityId,
        provider_model_identifier:providerModelIdentifier,
        provider_runtime_options:{},
        prompt:'pricing estimate',
        duration_seconds:1,
        resolution:'1K',
        aspect_ratio:'1:1',
        number_of_outputs:1,
        pricing_options:{},
        references:[],
      } as any);
      const amount=Number(quote.effective_price_usd);
      if(!Number.isFinite(amount)||amount<=0)throw Object.assign(new Error('Provider não retornou preço positivo verificável.'),{code:'ROUTING_V2_PROVIDER_PRICE_INVALID'});
      const source=quote.source==='LIVE_API'?'PROVIDER_QUOTE_API':quote.source==='CATALOG'?'PROVIDER_CATALOG_API':'MANUAL_VERIFIED';
      const sourceReference=providerId==='provider-wavespeed'
        ?'https://api.wavespeed.ai/api/v3/model/price'
        :providerId==='provider-atlas'
          ?'https://api.atlascloud.ai/api/v1/model/calculate'
          :`provider-pricing-catalog:${providerId}:${providerModelIdentifier}:${capabilityId}`;
      return{
        billing_config:{type:'PER_GENERATION',currency:'USD',price_per_generation:amount},
        source,
        source_reference:sourceReference,
        fetched_at:new Date().toISOString(),
      };
    } : undefined,

    async submitGeneration(provider, input) {
      assertIdentifierMatchesCapability(input.provider_model_identifier,input.capability_id);
      const legacy2 = providerRegistry.getAdapter(provider.provider_id);
      if (!legacy2) throw new Error('Legacy adapter not found');

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

      if (!legacy2.supports(input.model_id, mode as any, input.provider_model_identifier)) {
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
        result_urls: (result.result_urls || result.result_image_urls || [result.result_video_url]).filter(Boolean) as string[],
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
    'texture-3d': 'TEXT_TO_3D',
  };
  return map[capabilityId] || null;
}
