import { apiRequest } from './apiClient.js';
import { assetService } from './assetService.js';
import { Generation, GenerationRequestDraft } from '../types/index.js';

function normalizeReferences(draft: GenerationRequestDraft) {
  const refs = draft.references || [];
  const hasExplicitRoles = refs.some((r) => Boolean(r.role));

  return refs.map((r, index) => {
    const role = String(r.role || '').toUpperCase();
    let slot_type: 'INITIAL' | 'END' | 'GENERAL' = 'GENERAL';
    if (['START_FRAME', 'INITIAL_FRAME', 'INITIAL'].includes(role)) slot_type = 'INITIAL';
    else if (['END_FRAME', 'END'].includes(role)) slot_type = 'END';
    else if (!hasExplicitRoles && draft.mode === 'IMAGE_TO_VIDEO') slot_type = index === 0 ? 'INITIAL' : index === 1 ? 'END' : 'GENERAL';
    return { asset_id: r.asset_id, slot_type, alias: r.alias_snapshot };
  });
}

function isImageGeneration(generation: Generation) {
  const mode = String((generation as any).mode || '');
  return mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE';
}

const registered = new Set<string>();
const registering = new Set<string>();

async function registerGeneratedAssetsInBackground(generation: Generation) {
  if (generation.status !== 'SUCCEEDED') return;
  const raw = generation as any;
  const urls = Array.from(new Set([...(Array.isArray(raw.result_urls) ? raw.result_urls : []), raw.result_url].filter(Boolean).map(String)));
  if (!urls.length) return;
  const type = isImageGeneration(generation) ? 'IMAGE' : 'VIDEO';
  await Promise.all(urls.map(async (url, index) => {
    const key = `${generation.generation_id}:${url}`;
    if (registered.has(key) || registering.has(key)) return;
    registering.add(key);
    try {
      await assetService.registerGeneratedAsset({
        generationId: generation.generation_id,
        modelId: generation.model_id,
        providerId: String(raw.provider_id || 'provider'),
        url,
        type,
        index: index + 1,
      });
      registered.add(key);
    } catch (err) {
      console.warn('[GenerationClient] generated asset background registration:', err);
    } finally {
      registering.delete(key);
    }
  }));
}

function queueAssetRegistration(generation: Generation) {
  if (generation.status !== 'SUCCEEDED') return;
  void registerGeneratedAssetsInBackground(generation);
}

export const generationClient = {
  async create(draft: GenerationRequestDraft): Promise<Generation> {
    const generation = await apiRequest<Generation>('/api/generations', {
      method: 'POST',
      body: JSON.stringify({
        model_id: draft.model_id,
        mode: draft.mode,
        prompt: draft.prompt,
        negative_prompt: (draft as any).negative_prompt,
        duration_seconds: draft.settings.duration_seconds || 1,
        resolution: draft.settings.resolution,
        aspect_ratio: draft.settings.aspect_ratio,
        number_of_outputs: draft.settings.number_of_outputs,
        seed: draft.settings.seed,
        motion_strength: draft.settings.motion_strength,
        references: normalizeReferences(draft),
        client_request_id: draft.request_id,
      }),
    });
    queueAssetRegistration(generation);
    return generation;
  },

  async get(id: string): Promise<Generation> {
    const generation = await apiRequest<Generation>(`/api/generations/${id}`);
    queueAssetRegistration(generation);
    return generation;
  },

  async list(max = 50): Promise<Generation[]> {
    const generations = await apiRequest<Generation[]>(`/api/generations?limit=${Math.min(100, max)}`);
    generations.forEach(queueAssetRegistration);
    return generations;
  },

  async cancel(id: string): Promise<Generation> {
    return apiRequest<Generation>(`/api/generations/${id}/cancel`, { method: 'POST' });
  },
};
