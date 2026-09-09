import { apiRequest } from './apiClient.js';
import { Generation, GenerationRequestDraft } from '../types/index.js';

function normalizeReferences(draft: GenerationRequestDraft) {
  const refs = draft.references || [];
  const hasExplicitRoles = refs.some((r) => Boolean(r.role));

  return refs.map((r, index) => {
    const role = String(r.role || '').toUpperCase();
    let slot_type: 'INITIAL' | 'END' | 'GENERAL' = 'GENERAL';

    if (['START_FRAME', 'INITIAL_FRAME', 'INITIAL'].includes(role)) slot_type = 'INITIAL';
    else if (['END_FRAME', 'END'].includes(role)) slot_type = 'END';
    else if (!hasExplicitRoles && draft.mode === 'IMAGE_TO_VIDEO') {
      // Legacy draft compatibility only. New workspaces always persist explicit roles.
      slot_type = index === 0 ? 'INITIAL' : index === 1 ? 'END' : 'GENERAL';
    }

    return {
      asset_id: r.asset_id,
      slot_type,
      alias: r.alias_snapshot,
    };
  });
}

export const generationClient = {
  async create(draft: GenerationRequestDraft): Promise<Generation> {
    return apiRequest<Generation>('/api/generations', {
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
  },

  /**
   * Reads through the backend instead of Firestore directly so every poll also
   * asks the provider for the latest state, captures/release funds and creates
   * generated assets when the job completes.
   */
  async get(id: string): Promise<Generation> {
    return apiRequest<Generation>(`/api/generations/${id}`);
  },

  async list(max = 50): Promise<Generation[]> {
    return apiRequest<Generation[]>(`/api/generations?limit=${Math.min(100, max)}`);
  },

  async cancel(id: string): Promise<Generation> {
    return apiRequest<Generation>(`/api/generations/${id}/cancel`, { method: 'POST' });
  },
};
