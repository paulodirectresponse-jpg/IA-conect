import crypto from 'crypto';
import { WorkspacePreset } from '../../src/types/index.js';
import { DEFAULT_SYSTEM_PRESETS } from '../../src/config/constants.js';

const presetsMap = new Map<string, WorkspacePreset>();

// Seed default system presets
for (const preset of DEFAULT_SYSTEM_PRESETS) {
  presetsMap.set(preset.preset_id, preset as WorkspacePreset);
}

export const presetRepository = {
  async listPresets(userId: string): Promise<WorkspacePreset[]> {
    const list: WorkspacePreset[] = [];
    for (const p of presetsMap.values()) {
      if (p.user_id === 'system' || p.user_id === userId) {
        list.push(p);
      }
    }
    return list.sort((a, b) => {
      // System presets first, then newest
      if (a.user_id === 'system' && b.user_id !== 'system') return -1;
      if (b.user_id === 'system' && a.user_id !== 'system') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  },

  async getPreset(presetId: string, userId: string): Promise<WorkspacePreset | null> {
    const preset = presetsMap.get(presetId);
    if (!preset) return null;
    if (preset.user_id !== 'system' && preset.user_id !== userId) return null;
    return preset;
  },

  async createPreset(userId: string, data: Omit<WorkspacePreset, 'preset_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<WorkspacePreset> {
    const presetId = `prs_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const newPreset: WorkspacePreset = {
      ...data,
      preset_id: presetId,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    presetsMap.set(presetId, newPreset);
    return newPreset;
  },

  async deletePreset(presetId: string, userId: string): Promise<boolean> {
    const existing = presetsMap.get(presetId);
    if (!existing) {
      throw new Error('Preset não encontrado.');
    }
    if (existing.user_id === 'system') {
      throw new Error('Presets padrão do sistema não podem ser excluídos.');
    }
    if (existing.user_id !== userId) {
      throw new Error('Sem permissão para excluir este preset.');
    }

    presetsMap.delete(presetId);
    return true;
  },
};
