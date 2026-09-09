import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';

export type CreativeEntityKind = 'CHARACTER' | 'PRODUCT' | 'STYLE' | 'PROJECT';
export type CreativeEntityAssetRole = 'FACE' | 'BODY' | 'PRIMARY';

export interface CreativeEntity {
  entity_id: string;
  owner_user_id: string;
  kind: CreativeEntityKind;
  name: string;
  description: string;
  cover_asset_id?: string | null;
  cover_url?: string | null;
  asset_ids: string[];
  asset_roles?: Partial<Record<CreativeEntityAssetRole, string>>;
  project_id?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

async function readAll(): Promise<CreativeEntity[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const ref = doc(db, 'user_preferences', user.uid);
  const snap = await getDoc(ref);
  const rows = snap.exists() ? (snap.data() as any).creative_entities : [];
  return Array.isArray(rows) ? rows as CreativeEntity[] : [];
}

async function writeAll(rows: CreativeEntity[]) {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  await setDoc(doc(db, 'user_preferences', user.uid), {
    user_id: user.uid,
    creative_entities: rows,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export const creativeEntityService = {
  async list(kind: CreativeEntityKind, projectId?: string | null): Promise<CreativeEntity[]> {
    return (await readAll())
      .filter((row) => row.kind === kind)
      .filter((row) => kind === 'PROJECT' || projectId === undefined || (row.project_id || null) === (projectId || null))
      .filter((row) => row.status !== 'ARCHIVED')
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  },

  async listProjects(): Promise<CreativeEntity[]> {
    return this.list('PROJECT');
  },

  async save(input: Partial<CreativeEntity> & { kind: CreativeEntityKind; name: string }): Promise<CreativeEntity> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');
    const rows = await readAll();
    const now = new Date().toISOString();
    const entityId = input.entity_id || `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const previous = rows.find((row) => row.entity_id === entityId);
    const value: CreativeEntity = {
      entity_id: entityId,
      owner_user_id: user.uid,
      kind: input.kind,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      cover_asset_id: input.cover_asset_id ?? previous?.cover_asset_id ?? null,
      cover_url: input.cover_url ?? previous?.cover_url ?? null,
      asset_ids: input.asset_ids ?? previous?.asset_ids ?? [],
      asset_roles: input.asset_roles ?? previous?.asset_roles ?? {},
      project_id: input.kind === 'PROJECT' ? null : (input.project_id ?? previous?.project_id ?? null),
      status: input.status ?? previous?.status ?? 'ACTIVE',
      created_at: input.created_at || previous?.created_at || now,
      updated_at: now,
    };
    await writeAll([value, ...rows.filter((row) => row.entity_id !== entityId)]);
    return value;
  },

  async setProjectAssets(projectId: string, assetIds: string[]): Promise<CreativeEntity> {
    const rows = await readAll();
    const project = rows.find((row) => row.entity_id === projectId && row.kind === 'PROJECT');
    if (!project) throw new Error('Projeto não encontrado.');
    return this.save({ ...project, asset_ids: Array.from(new Set(assetIds)) });
  },

  async toggleProjectAsset(projectId: string, assetId: string): Promise<CreativeEntity> {
    const rows = await readAll();
    const project = rows.find((row) => row.entity_id === projectId && row.kind === 'PROJECT');
    if (!project) throw new Error('Projeto não encontrado.');
    const current = new Set(project.asset_ids || []);
    if (current.has(assetId)) current.delete(assetId); else current.add(assetId);
    return this.save({ ...project, asset_ids: Array.from(current) });
  },

  async archive(entityId: string): Promise<void> {
    const rows = await readAll();
    const target = rows.find((row) => row.entity_id === entityId);
    if (!target) return;
    await this.save({ ...target, status: 'ARCHIVED' });
  },

  async remove(entityId: string): Promise<void> {
    await writeAll((await readAll()).filter((row) => row.entity_id !== entityId));
  },
};
