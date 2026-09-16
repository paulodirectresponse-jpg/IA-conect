import { apiRequestCached } from '../../services/apiClient.js';

export const BETA_FLAG_KEY = 'beta.enabled';

export async function getPublicBetaFlags(force=false):Promise<Record<string,boolean>>{
  return apiRequestCached<Record<string,boolean>>('/api/feature-flags/public',30_000,force);
}

export async function getBetaEnabled(force = false): Promise<boolean> {
  const flags = await getPublicBetaFlags(force);
  return flags[BETA_FLAG_KEY] === true;
}
