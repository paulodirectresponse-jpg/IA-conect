import crypto from 'crypto';
import { WorkspaceDraft } from '../../src/types/index.js';

const draftsMap = new Map<string, WorkspaceDraft>();
// user_id -> latest draft_id
const userLatestDraftMap = new Map<string, string>();

export const draftRepository = {
  async getLatestDraft(userId: string): Promise<WorkspaceDraft | null> {
    const draftId = userLatestDraftMap.get(userId);
    if (!draftId) return null;
    return draftsMap.get(draftId) || null;
  },

  async getDraft(draftId: string, userId: string): Promise<WorkspaceDraft | null> {
    const draft = draftsMap.get(draftId);
    if (!draft || draft.user_id !== userId) return null;
    return draft;
  },

  async saveDraft(
    userId: string,
    draftData: Partial<WorkspaceDraft> & { draft_id?: string }
  ): Promise<WorkspaceDraft> {
    const draftId = draftData.draft_id || userLatestDraftMap.get(userId) || `dft_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const existing = draftsMap.get(draftId);

    const updated: WorkspaceDraft = {
      draft_id: draftId,
      user_id: userId,
      model_id: draftData.model_id || existing?.model_id || 'wan-2-1-video',
      mode: draftData.mode || existing?.mode || 'TEXT_TO_VIDEO',
      prompt: draftData.prompt !== undefined ? draftData.prompt : existing?.prompt || '',
      negative_prompt: draftData.negative_prompt !== undefined ? draftData.negative_prompt : existing?.negative_prompt,
      references: draftData.references || existing?.references || [],
      settings: draftData.settings || existing?.settings || {
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
        number_of_outputs: 1,
        seed: null,
      },
      preset_id: draftData.preset_id !== undefined ? draftData.preset_id : existing?.preset_id,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    draftsMap.set(draftId, updated);
    userLatestDraftMap.set(userId, draftId);
    return updated;
  },

  async deleteDraft(draftId: string, userId: string): Promise<boolean> {
    const draft = draftsMap.get(draftId);
    if (!draft || draft.user_id !== userId) return false;

    draftsMap.delete(draftId);
    if (userLatestDraftMap.get(userId) === draftId) {
      userLatestDraftMap.delete(userId);
    }
    return true;
  },
};
