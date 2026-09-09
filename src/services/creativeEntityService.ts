import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';

export type CreativeEntityKind = 'CHARACTER' | 'PRODUCT' | 'STYLE' | 'PROJECT';

export interface CreativeEntity {
  entity_id: string;
  owner_user_id: string;
  kind: CreativeEntityKind;
  name: string;
  description: string;
  cover_asset_id?: string | null;
  cover_url?: string | null;
  asset_ids: string[];
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
  async list(kind: CreativeEntityKind): Promise<CreativeEntity[]> {
    return (await readAll()).filter((row) => row.kind === kind).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  },

  async save(input: Partial<CreativeEntity> & { kind: CreativeEntityKind; name: string }): Promise<CreativeEntity> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado.');
    const rows = await readAll();
    const now = new Date().toISOString();
    const entityId = input.entity_id || `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const value: CreativeEntity = {
      entity_id: entityId,
      owner_user_id: user.uid,
      kind: input.kind,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      cover_asset_id: input.cover_asset_id || null,
      cover_url: input.cover_url || null,
      asset_ids: input.asset_ids || [],
      created_at: input.created_at || now,
      updated_at: now,
    };
    await writeAll([value, ...rows.filter((row) => row.entity_id !== entityId)]);
    return value;
  },

  async remove(entityId: string): Promise<void> {
    await writeAll((await readAll()).filter((row) => row.entity_id !== entityId));
  },
};
