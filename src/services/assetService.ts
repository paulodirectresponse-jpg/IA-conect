import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { storage, auth, db } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { Asset, AssetType, AssetCategory } from '../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../config/constants.js';

export interface UploadAssetParams {
  file: File;
  name?: string;
  alias?: string;
  category?: AssetCategory;
  onProgress?: (percent: number) => void;
}

export function sanitizeAlias(nameOrAlias: string): string {
  return nameOrAlias
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export const assetService = {
  async listAssets(filters?: {
    type?: AssetType;
    category?: AssetCategory;
    search?: string;
  }): Promise<Asset[]> {
    const user = auth.currentUser;
    if (user) {
      try {
        const assetsRef = collection(db, 'assets');
        const q = query(assetsRef, where('owner_user_id', '==', user.uid));
        const snapshot = await getDocs(q);

        const list: Asset[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Asset;
          if (!data.deleted_at) {
            list.push(data);
          }
        });

        const searchLower = filters?.search?.toLowerCase().trim();
        const filtered = list.filter((asset) => {
          if (filters?.type && asset.type !== filters.type) return false;
          if (filters?.category && asset.category !== filters.category) return false;
          if (searchLower) {
            const matchesName = asset.name.toLowerCase().includes(searchLower);
            const matchesAlias = asset.alias.toLowerCase().includes(searchLower);
            if (!matchesName && !matchesAlias) return false;
          }
          return true;
        });

        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return filtered;
      } catch (firestoreErr) {
        console.warn('[AssetService] Direct Firestore query fallback to API:', firestoreErr);
      }
    }

    // Fallback through API if not signed in or on network error
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    const queryString = params.toString();
    return apiRequest<Asset[]>(`/api/assets${queryString ? `?${queryString}` : ''}`);
  },

  async uploadAsset(params: UploadAssetParams): Promise<Asset> {
    const { file, name, alias, category = 'PRODUCT', onProgress } = params;
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado para fazer upload.');
    }

    // 1. Client-Side Size & Mime Validation
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    let detectedType: AssetType = 'IMAGE';

    if (file.type.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(extension)) {
      detectedType = 'VIDEO';
      if (file.size > ASSET_UPLOAD_LIMITS.VIDEO.max_bytes) {
        throw new Error('O vídeo excede o limite máximo permitido de 500 MB.');
      }
    } else if (file.type.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(extension)) {
      detectedType = 'AUDIO';
      if (file.size > ASSET_UPLOAD_LIMITS.AUDIO.max_bytes) {
        throw new Error('O áudio excede o limite máximo permitido de 100 MB.');
      }
    } else {
      if (file.size > ASSET_UPLOAD_LIMITS.IMAGE.max_bytes) {
        throw new Error('A imagem excede o limite máximo permitido de 25 MB.');
      }
    }

    const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storagePath = `users/${user.uid}/assets/${assetId}/original.${extension}`;

    let publicUrl = '';

    // 2. Real Firebase Storage Upload
    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(Math.round(progress));
          },
          (error) => {
            console.warn('[AssetService] Storage uploadTask warning:', error);
            reject(error);
          },
          async () => {
            try {
              publicUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    } catch (storageErr: any) {
      console.warn('[AssetService] Firebase Storage upload fallback triggered:', storageErr?.message);
      publicUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      if (onProgress) onProgress(100);
    }

    // 3. Compute unique alias
    let desiredAlias = sanitizeAlias(alias || name || file.name.split('.')[0]);
    if (!desiredAlias) desiredAlias = `asset_${Date.now().toString().slice(-4)}`;

    const existingAssets = await this.listAssets();
    let finalAlias = desiredAlias;
    let counter = 1;
    while (existingAssets.some((a) => a.alias === finalAlias && a.asset_id !== assetId)) {
      finalAlias = `${desiredAlias}_${counter}`;
      counter++;
    }

    const now = new Date().toISOString();
    const newAsset: Asset = {
      asset_id: assetId,
      owner_user_id: user.uid,
      type: detectedType,
      category,
      name: (name || file.name).trim(),
      alias: finalAlias,
      storage_path: storagePath,
      public_url: publicUrl,
      thumbnail_url: detectedType === 'IMAGE' ? publicUrl : undefined,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      width: null,
      height: null,
      duration_seconds: null,
      status: 'READY',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // 4. Save to Firestore directly
    try {
      await setDoc(doc(db, 'assets', assetId), newAsset);
    } catch (fsErr) {
      console.warn('[AssetService] Firestore setDoc fallback to API:', fsErr);
      await apiRequest<Asset>('/api/assets', {
        method: 'POST',
        body: JSON.stringify(newAsset),
      });
    }

    return newAsset;
  },

  async updateAsset(
    assetId: string,
    updates: {
      name?: string;
      alias?: string;
      category?: AssetCategory;
      public_url?: string;
    }
  ): Promise<Asset> {
    const user = auth.currentUser;
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      ...updates,
      updated_at: now,
    };
    if (updates.alias) {
      updatePayload.alias = sanitizeAlias(updates.alias);
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'assets', assetId), updatePayload);
        const refreshed = await this.listAssets();
        const found = refreshed.find((a) => a.asset_id === assetId);
        if (found) return found;
      } catch (err) {
        console.warn('[AssetService] updateDoc fallback to API:', err);
      }
    }

    return apiRequest<Asset>(`/api/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteAsset(assetId: string): Promise<void> {
    const user = auth.currentUser;
    const now = new Date().toISOString();
    if (user) {
      try {
        await updateDoc(doc(db, 'assets', assetId), {
          deleted_at: now,
          updated_at: now,
        });
        return;
      } catch (err) {
        console.warn('[AssetService] soft delete fallback to API:', err);
      }
    }

    await apiRequest(`/api/assets/${assetId}`, {
      method: 'DELETE',
    });
  },
};
