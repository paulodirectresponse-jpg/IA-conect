import crypto from 'crypto';
import { WorkspacePreset } from '../../src/types/index.js';
import { DEFAULT_SYSTEM_PRESETS } from '../../src/config/constants.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

const safe=(value:string)=>encodeURIComponent(value);
let seedPromise:Promise<void>|null=null;

async function ensureSystemPresets() {
  if (!seedPromise) seedPromise = (async()=>{
    for (const preset of DEFAULT_SYSTEM_PRESETS as WorkspacePreset[]) {
      const path = `workspace_presets/${safe(preset.preset_id)}`;
      const existing = await firestoreAdminRest.get(path);
      if (!existing.exists) await firestoreAdminRest.set(path,preset);
    }
  })().catch((error)=>{seedPromise=null;throw error;});
  return seedPromise;
}

async function queryOwner(userId:string) {
  const rows = await firestoreAdminRest.runQuery({
    from:[{collectionId:'workspace_presets'}],
    where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
    limit:250,
  });
  return rows.map((row:any)=>row.data as WorkspacePreset);
}

export const presetRepository = {
  async listPresets(userId:string):Promise<WorkspacePreset[]> {
    await ensureSystemPresets();
    const [system,user] = await Promise.all([queryOwner('system'),queryOwner(userId)]);
    const merged = new Map<string,WorkspacePreset>();
    [...system,...user].forEach((preset)=>merged.set(preset.preset_id,preset));
    return [...merged.values()].sort((a,b)=>{
      if (a.user_id==='system'&&b.user_id!=='system') return -1;
      if (b.user_id==='system'&&a.user_id!=='system') return 1;
      return Date.parse(b.created_at)-Date.parse(a.created_at);
    });
  },

  async getPreset(presetId:string,userId:string):Promise<WorkspacePreset|null> {
    await ensureSystemPresets();
    const doc = await firestoreAdminRest.get(`workspace_presets/${safe(presetId)}`);
    if (!doc.exists) return null;
    const preset = doc.data as WorkspacePreset;
    return preset.user_id==='system'||preset.user_id===userId ? preset : null;
  },

  async createPreset(userId:string,data:Omit<WorkspacePreset,'preset_id'|'user_id'|'created_at'|'updated_at'>):Promise<WorkspacePreset> {
    const now = new Date().toISOString();
    const value:WorkspacePreset = {
      ...data,
      preset_id:`prs_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id:userId,
      created_at:now,
      updated_at:now,
    };
    await firestoreAdminRest.set(`workspace_presets/${safe(value.preset_id)}`,value);
    return value;
  },

  async deletePreset(presetId:string,userId:string):Promise<boolean> {
    const existing = await this.getPreset(presetId,userId);
    if (!existing) throw new Error('Preset não encontrado.');
    if (existing.user_id==='system') throw new Error('Presets padrão do sistema não podem ser excluídos.');
    if (existing.user_id!==userId) throw new Error('Sem permissão para excluir este preset.');
    await firestoreAdminRest.commit([{delete:firestoreAdminRest.docName(`workspace_presets/${safe(presetId)}`)}]);
    return true;
  },
};
