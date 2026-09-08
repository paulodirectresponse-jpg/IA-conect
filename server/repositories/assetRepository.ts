import crypto from 'crypto';
import { Asset, AssetType, AssetCategory, AssetStatus } from '../../src/types/index.js';

// In-memory store fallback synchronized with Firestore REST
const assetsMap = new Map<string, Asset>();

export function sanitizeAlias(nameOrAlias: string): string {
  return nameOrAlias
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export const assetRepository = {
  async listUserAssets(
    userId: string,
    filters?: {
      type?: AssetType;
      category?: AssetCategory;
      search?: string;
    }
  ): Promise<Asset[]> {
    const list: Asset[] = [];
    const searchLower = filters?.search?.toLowerCase().trim();

    for (const asset of assetsMap.values()) {
      if (asset.owner_user_id !== userId) continue;
      if (asset.deleted_at) continue; // Soft-deleted

      if (filters?.type && asset.type !== filters.type) continue;
      if (filters?.category && asset.category !== filters.category) continue;
      if (searchLower) {
        const matchesName = asset.name.toLowerCase().includes(searchLower);
        const matchesAlias = asset.alias.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesAlias) continue;
      }

      list.push(asset);
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getAsset(assetId: string, userId: string): Promise<Asset | null> {
    const asset = assetsMap.get(assetId);
    if (!asset || asset.owner_user_id !== userId || asset.deleted_at) {
      return null;
    }
    return asset;
  },

  async findByAlias(alias: string, userId: string): Promise<Asset | null> {
    const clean = sanitizeAlias(alias);
    for (const asset of assetsMap.values()) {
      if (asset.owner_user_id === userId && !asset.deleted_at && asset.alias === clean) {
        return asset;
      }
    }
    return null;
  },

  async createAsset(params: {
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
  }): Promise<Asset> {
    const assetId = `ast_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Compute unique alias
    let desiredAlias = sanitizeAlias(params.alias || params.name);
    if (!desiredAlias) {
      desiredAlias = `asset_${Date.now().toString().slice(-4)}`;
    }

    // Ensure alias is unique per user
    let finalAlias = desiredAlias;
    let counter = 1;
    while (await this.findByAlias(finalAlias, params.owner_user_id)) {
      finalAlias = `${desiredAlias}_${counter}`;
      counter++;
    }

    const now = new Date().toISOString();
    const newAsset: Asset = {
      asset_id: assetId,
      owner_user_id: params.owner_user_id,
      type: params.type,
      category: params.category,
      name: params.name.trim(),
      alias: finalAlias,
      storage_path: params.storage_path,
      public_url: params.public_url || '',
      thumbnail_url: params.thumbnail_url || params.public_url || '',
      mime_type: params.mime_type,
      size_bytes: params.size_bytes,
      width: params.width ?? null,
      height: params.height ?? null,
      duration_seconds: params.duration_seconds ?? null,
      status: params.status || 'READY',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    assetsMap.set(assetId, newAsset);
    return newAsset;
  },

  async updateAsset(
    assetId: string,
    userId: string,
    updates: {
      name?: string;
      alias?: string;
      category?: AssetCategory;
      status?: AssetStatus;
      public_url?: string;
    }
  ): Promise<Asset> {
    const existing = await this.getAsset(assetId, userId);
    if (!existing) {
      throw new Error('Asset não encontrado ou sem permissão de acesso.');
    }

    if (updates.alias && updates.alias !== existing.alias) {
      const cleanAlias = sanitizeAlias(updates.alias);
      if (!cleanAlias) {
        throw new Error('Alias inválido. Use caracteres alfanuméricos e sublinhados.');
      }
      const collision = await this.findByAlias(cleanAlias, userId);
      if (collision && collision.asset_id !== assetId) {
        throw new Error(`O alias @${cleanAlias} já está em uso por outro asset.`);
      }
      existing.alias = cleanAlias;
    }

    if (updates.name !== undefined) existing.name = updates.name.trim();
    if (updates.category !== undefined) existing.category = updates.category;
    if (updates.status !== undefined) existing.status = updates.status;
    if (updates.public_url !== undefined) existing.public_url = updates.public_url;
    existing.updated_at = new Date().toISOString();

    assetsMap.set(assetId, existing);
    return existing;
  },

  async softDeleteAsset(assetId: string, userId: string): Promise<boolean> {
    const existing = await this.getAsset(assetId, userId);
    if (!existing) {
      throw new Error('Asset não encontrado ou sem permissão.');
    }

    existing.deleted_at = new Date().toISOString();
    existing.updated_at = new Date().toISOString();
    assetsMap.set(assetId, existing);
    return true;
  },
};
