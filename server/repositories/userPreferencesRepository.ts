import { UserPreferences, GenerationMode } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

const safe=(value:string)=>encodeURIComponent(value);

function defaults(userId:string):UserPreferences {
  return {
    user_id:userId,
    favorite_model_ids:[],
    recent_model_ids:[],
    last_used_mode:'TEXT_TO_VIDEO',
    updated_at:new Date().toISOString(),
  };
}

export const userPreferencesRepository = {
  async getPreferences(userId:string):Promise<UserPreferences> {
    const path = `user_preferences/${safe(userId)}`;
    const existing = await firestoreAdminRest.get(path);
    if (existing.exists) {
      const data = existing.data as Partial<UserPreferences>;
      return {
        ...defaults(userId),
        ...data,
        user_id:userId,
        favorite_model_ids:Array.isArray(data.favorite_model_ids)?data.favorite_model_ids:[],
        recent_model_ids:Array.isArray(data.recent_model_ids)?data.recent_model_ids:[],
      };
    }
    const value = defaults(userId);
    await firestoreAdminRest.set(path,value);
    return value;
  },

  async savePreferences(userId:string,value:UserPreferences):Promise<UserPreferences> {
    const next = {...value,user_id:userId,updated_at:new Date().toISOString()};
    await firestoreAdminRest.set(`user_preferences/${safe(userId)}`,next);
    return next;
  },

  async toggleFavorite(userId:string,modelId:string):Promise<UserPreferences> {
    const prefs = await this.getPreferences(userId);
    const set = new Set(prefs.favorite_model_ids);
    set.has(modelId) ? set.delete(modelId) : set.add(modelId);
    return this.savePreferences(userId,{...prefs,favorite_model_ids:[...set]});
  },

  async trackRecentModel(userId:string,modelId:string,mode?:GenerationMode):Promise<UserPreferences> {
    const prefs = await this.getPreferences(userId);
    return this.savePreferences(userId,{
      ...prefs,
      recent_model_ids:[modelId,...prefs.recent_model_ids.filter((id)=>id!==modelId)].slice(0,5),
      last_used_mode:mode || prefs.last_used_mode,
    });
  },
};
