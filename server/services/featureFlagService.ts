import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { FeatureFlag } from '../../src/types/index.js';

async function ensureTemplatesV1Release(flags:FeatureFlag[]):Promise<FeatureFlag[]>{
  const markerPath='app_config/beta_templates_v1_release';
  const marker=await firestoreAdminRest.get(markerPath).catch(()=>({exists:true,data:{}} as any));
  if(marker.exists)return flags;
  const target=flags.find(flag=>flag.flag_key==='beta.templates');
  if(!target)return flags;
  const released={...target,is_enabled:true,updated_at:new Date().toISOString()};
  try{
    await catalogRepository.saveFeatureFlag(released);
    await firestoreAdminRest.set(markerPath,{release:'PR-15_TEMPLATES_V1',released_at:released.updated_at});
  }catch{return catalogRepository.listFeatureFlags();}
  return flags.map(flag=>flag.flag_key===released.flag_key?released:flag);
}

export const featureFlagService = {
  async getPublicFlags(): Promise<Record<string, boolean>> {
    const flags = await ensureTemplatesV1Release(await catalogRepository.listFeatureFlags());
    const result: Record<string, boolean> = {};
    for (const f of flags) {
      if (!f.is_private) result[f.flag_key] = f.is_enabled;
    }
    return result;
  },

  async getAllFlags(): Promise<FeatureFlag[]> {
    return ensureTemplatesV1Release(await catalogRepository.listFeatureFlags());
  },

  async toggleFlag(params: {
    adminId: string;
    adminEmail: string;
    flagKey: string;
    isEnabled: boolean;
    reason: string;
  }): Promise<FeatureFlag> {
    const { adminId, adminEmail, flagKey, isEnabled, reason } = params;
    const existing = await catalogRepository.getFeatureFlag(flagKey);
    if (!existing) throw new Error(`Feature flag ${flagKey} não encontrada.`);
    const updated: FeatureFlag = {...existing,is_enabled:isEnabled,updated_at:new Date().toISOString()};
    const saved = await catalogRepository.saveFeatureFlag(updated);
    await auditRepository.record({
      log_id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id: adminId,
      admin_email: adminEmail,
      action: 'FEATURE_FLAG_TOGGLED',
      entity_type: 'FEATURE_FLAG',
      entity_id: flagKey,
      before: { is_enabled: existing.is_enabled },
      after: { is_enabled: saved.is_enabled },
      reason: reason || `Alteração da flag ${flagKey}`,
      created_at: new Date().toISOString(),
    });
    return saved;
  },
};
