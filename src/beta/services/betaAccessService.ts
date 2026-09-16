import { apiRequestCached } from '../../services/apiClient.js';

export const BETA_FLAG_KEY = 'beta.enabled';

export async function getBetaEnabled(force = false): Promise<boolean> {
  const flags = await apiRequestCached<Record<string, boolean>>('/api/feature-flags/public', 30_000, force);
  return flags[BETA_FLAG_KEY] === true;
}
