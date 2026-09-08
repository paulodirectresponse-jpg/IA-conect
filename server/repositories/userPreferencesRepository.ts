import { UserPreferences, GenerationMode } from '../../src/types/index.js';

const preferencesMap = new Map<string, UserPreferences>();

export const userPreferencesRepository = {
  async getPreferences(userId: string): Promise<UserPreferences> {
    const existing = preferencesMap.get(userId);
    if (existing) return existing;

    const defaultPrefs: UserPreferences = {
      user_id: userId,
      favorite_model_ids: ['wan-2-1-video'],
      recent_model_ids: ['wan-2-1-video', 'kling-v1-5'],
      last_used_mode: 'TEXT_TO_VIDEO',
      updated_at: new Date().toISOString(),
    };
    preferencesMap.set(userId, defaultPrefs);
    return defaultPrefs;
  },

  async toggleFavorite(userId: string, modelId: string): Promise<UserPreferences> {
    const prefs = await this.getPreferences(userId);
    const set = new Set(prefs.favorite_model_ids);

    if (set.has(modelId)) {
      set.delete(modelId);
    } else {
      set.add(modelId);
    }

    prefs.favorite_model_ids = Array.from(set);
    prefs.updated_at = new Date().toISOString();
    preferencesMap.set(userId, prefs);
    return prefs;
  },

  async trackRecentModel(userId: string, modelId: string, mode?: GenerationMode): Promise<UserPreferences> {
    const prefs = await this.getPreferences(userId);
    const recents = [modelId, ...prefs.recent_model_ids.filter((id) => id !== modelId)].slice(0, 5);

    prefs.recent_model_ids = recents;
    if (mode) prefs.last_used_mode = mode;
    prefs.updated_at = new Date().toISOString();
    preferencesMap.set(userId, prefs);
    return prefs;
  },
};
