import crypto from 'crypto';
import { Asset, AssetType, AssetCategory, AssetStatus } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

export type AssetOrigin = 'UPLOAD' | 'GENERATED';

export function sanitizeAlias(nameOrAlias: string): string {
  return nameOrAlias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
}

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firestore Admin indisponível.');
  return db;
}

export interface CreateAssetParams {
  owner_user_id: string;
  type: AssetType;
  category: AssetCategory;
  name: string;
  alias?: string;
  storage_path: string;
  public_url?: string;
  thumbnail_url?: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  status?: AssetStatus;
  origin?: AssetOrigin;
  source_generation_id?: string | null;
  source_model_id?: string | null;
  source_provider_id?: string | null;
}

export const assetRepository = {
  async listUserAssets(userId: string, filters?: { type?: AssetType; category?: AssetCategory; search?: string }): Promise<Asset[]> {
    const snap = await dbOrThrow().collection('assets').where('owner_user_id', '==', userId).get();
    const search = filters?.search?.toLowerCase().trim();
    return snap.docs.map(d => d.data() as Asset).filter(a => {
      if (a.deleted_at) return false;
      if (filters?.type && a.type !== filters.type) return false;
      if (filters?.category && a.category !== filters.category) return false;
      if (search && !a.name.toLowerCase().includes(search) && !a.alias.toLowerCase().includes(search)) return false;
      return true;
    }).sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at));
  },

  async getAsset(assetId: string, userId: string): Promise<Asset | null> {
    const doc = await dbOrThrow().collection('assets').doc(assetId).get();
    if (!doc.exists) return null;
    const asset = doc.data() as Asset;
    return asset.owner_user_id === userId && !asset.deleted_at ? asset : null;
  },

  async findByAlias(alias: string, userId: string): Promise<Asset | null> {
    const clean = sanitizeAlias(alias);
    const snap = await dbOrThrow().collection('assets').where('owner_user_id','==',userId).where('alias','==',clean).limit(1).get();
    if (snap.empty) return null;
    const asset = snap.docs[0].data() as Asset;
    return asset.deleted_at ? null : asset;
  },

  async createAsset(params: CreateAssetParams): Promise<Asset> {
    const assetId = `ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const base = sanitizeAlias(params.alias || params.name) || `asset_${Date.now().toString().slice(-6)}`;
    let alias = base;
    let i = 1;
    while (await this.findByAlias(alias, params.owner_user_id)) alias = `${base}_${i++}`;
    const now = new Date().toISOString();
    const asset = {
      asset_id: assetId,
      owner_user_id: params.owner_user_id,
      type: params.type,
      category: params.category,
      name: params.name.trim(),
      alias,
      storage_path: params.storage_path,
      public_url: params.public_url || '',
      thumbnail_url: params.thumbnail_url || params.public_url || '',
      mime_type: params.mime_type,
      size_bytes: params.size_bytes,
      width: params.width ?? null,
      height: params.height ?? null,
      duration_seconds: params.duration_seconds ?? null,
      status: params.status || 'READY',
      origin: params.origin || 'UPLOAD',
      source_generation_id: params.source_generation_id ?? null,
      source_model_id: params.source_model_id ?? null,
      source_provider_id: params.source_provider_id ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as Asset & {
      origin: AssetOrigin;
      source_generation_id: string | null;
      source_model_id: string | null;
      source_provider_id: string | null;
    };
    await dbOrThrow().collection('assets').doc(assetId).set(asset);
    return asset;
  },

  async updateAsset(assetId:string,userId:string,updates:{name?:string;alias?:string;category?:AssetCategory;status?:AssetStatus;public_url?:string}): Promise<Asset> {
    const existing = await this.getAsset(assetId,userId);
    if(!existing) throw new Error('Asset não encontrado ou sem permissão.');
    if (updates.alias && updates.alias !== existing.alias) {
      const clean = sanitizeAlias(updates.alias);
      if(!clean) throw new Error('Alias inválido.');
      const collision = await this.findByAlias(clean,userId);
      if(collision && collision.asset_id!==assetId) throw new Error(`O alias @${clean} já está em uso.`);
      updates.alias = clean;
    }
    const payload = { ...updates, updated_at:new Date().toISOString() };
    await dbOrThrow().collection('assets').doc(assetId).update(payload);
    return { ...existing, ...payload } as Asset;
  },

  async softDeleteAsset(assetId:string,userId:string): Promise<boolean> {
    const existing=await this.getAsset(assetId,userId);
    if(!existing) throw new Error('Asset não encontrado ou sem permissão.');
    const now=new Date().toISOString();
    await dbOrThrow().collection('assets').doc(assetId).update({deleted_at:now,updated_at:now});
    return true;
  }
};
