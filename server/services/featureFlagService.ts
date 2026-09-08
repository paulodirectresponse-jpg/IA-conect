import crypto from 'crypto';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { FeatureFlag } from '../../src/types/index.js';

export const featureFlagService = {
  async getPublicFlags(): Promise<Record<string, boolean>> {
    const flags = await catalogRepository.listFeatureFlags();
    const result: Record<string, boolean> = {};
    for (const f of flags) {
      if (!f.is_private) {
        result[f.flag_key] = f.is_enabled;
      }
    }
    return result;
  },

  async getAllFlags(): Promise<FeatureFlag[]> {
    return catalogRepository.listFeatureFlags();
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
    if (!existing) {
      throw new Error(`Feature flag ${flagKey} não encontrada.`);
    }

    const updated: FeatureFlag = {
      ...existing,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    };

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
