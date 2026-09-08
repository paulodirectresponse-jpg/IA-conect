import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
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
import firebaseConfig from '../../firebase-applet-config.json';
import { apiRequest } from './apiClient.js';
import { Asset, AssetType, AssetCategory } from '../types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../config/constants.js';

// Reduce maximum retry time so client does not hang for 10 minutes on network or CORS issues
try {
  storage.maxUploadRetryTime = 30000;
  storage.maxOperationRetryTime = 30000;
} catch (e) {
  // Safe ignore if environment does not allow mutation
}

export interface UploadAssetParams {
  file: File;
  name?: string;
  alias?: string;
  category?: AssetCategory;
  onProgress?: (percent: number) => void;
  onTaskReady?: (task: { cancel: () => void }) => void;
  timeoutMs?: number;
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

export function mapStorageError(error: any): string {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === 'storage/unauthorized') {
    return 'Permissão negada no Firebase Storage. Verifique se sua sessão está ativa e as regras de acesso.';
  }
  if (code === 'storage/canceled') {
    return 'Upload cancelado pelo usuário.';
  }
  if (code === 'storage/bucket-not-found') {
    return 'Bucket de armazenamento não encontrado. Verifique a configuração do Firebase Storage.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Cota de armazenamento do Firebase Storage excedida.';
  }
  if (code === 'storage/retry-limit-exceeded') {
    return 'Tempo limite esgotado ao conectar ao Firebase Storage. Verifique sua conexão e configurações de CORS.';
  }
  if (code === 'storage/object-not-found') {
    return 'Arquivo não encontrado no Storage.';
  }
  if (code === 'storage/unknown' || message.includes('CORS') || message.includes('Network') || message.includes('Failed to fetch')) {
    return `Falha ao conectar com o Firebase Storage (${code || 'Network/CORS'}). Verifique se o bucket está ativo e com CORS configurado.`;
  }
  return message || 'Erro inesperado durante o upload para o Firebase Storage.';
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
    const { file, name, alias, category = 'PRODUCT', onProgress, onTaskReady, timeoutMs = 90000 } = params;

    // PRE-UPLOAD DIAGNOSTICS & CHECKS
    const user = auth.currentUser;
    if (!user) {
      console.error('[Storage Diagnostic] Upload rejeitado: Usuário não autenticado.');
      throw new Error('Usuário não autenticado para fazer upload.');
    }

    if (!storage) {
      console.error('[Storage Diagnostic] Upload rejeitado: Firebase Storage não inicializado.');
      throw new Error('Serviço Firebase Storage indisponível no cliente.');
    }

    const configuredBucket = firebaseConfig.storageBucket?.trim();
    if (!configuredBucket) {
      console.error('[Storage Diagnostic] Upload rejeitado: firebaseConfig.storageBucket está vazio.');
      throw new Error('Configuração ausente: storageBucket não está preenchido no firebase-applet-config.json.');
    }

    if (!file || file.size === 0) {
      console.error('[Storage Diagnostic] Upload rejeitado: Arquivo inválido ou com 0 bytes.');
      throw new Error('Arquivo vazio ou inválido selecionado para upload.');
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
    const storageRef = ref(storage, storagePath);

    console.log('[Storage Diagnostic] Iniciando upload direto para Firebase Storage:', {
      userId: user.uid,
      bucket: configuredBucket,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    let publicUrl = '';

    // 2. Real Firebase Storage Upload with Resumable Task and Generous Safety Watchdog
    try {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      if (onTaskReady) {
        onTaskReady({
          cancel: () => {
            try {
              console.log('[Storage Diagnostic] Cancelamento manual solicitado pelo usuário.');
              uploadTask.cancel();
            } catch (e) {
              console.warn('[AssetService] Error cancelling upload task:', e);
            }
          },
        });
      }

      await new Promise<void>((resolve, reject) => {
        let isSettled = false;

        // Watchdog failsafe timeout (default 90s) - ONLY for frozen network socket protection
        const safetyWatchdog = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            try {
              uploadTask.cancel();
            } catch (e) {}
            console.error('[Storage Diagnostic] Timeout de segurança atingido (90s sem finalização):', {
              bucket: configuredBucket,
              path: storagePath,
            });
            reject(
              new Error('Tempo limite de rede esgotado durante o envio. Verifique sua conexão e tente novamente.')
            );
          }
        }, timeoutMs);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const total = snapshot.totalBytes || file.size;
            const progress = total > 0 ? Math.round((snapshot.bytesTransferred / total) * 100) : 0;
            if (onProgress) {
              onProgress(Math.min(100, Math.max(0, progress)));
            }
          },
          (error) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(safetyWatchdog);

            // Technical Diagnostic Logging (without exposing credentials)
            console.error('[Storage Diagnostic] Falha reportada pelo Firebase Storage:', {
              errorCode: error?.code,
              errorMessage: error?.message,
              errorServerResponse: (error as any)?.serverResponse,
              bucket: configuredBucket,
              storagePath,
            });

            const userMsg = mapStorageError(error);
            reject(new Error(userMsg));
          },
          async () => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(safetyWatchdog);
            try {
              publicUrl = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('[Storage Diagnostic] Upload concluído com sucesso. Download URL obtida.');
              if (onProgress) onProgress(100);
              resolve();
            } catch (err: any) {
              console.error('[Storage Diagnostic] Falha ao obter Download URL do arquivo enviado:', {
                errorCode: err?.code,
                errorMessage: err?.message,
                storagePath,
              });
              reject(new Error(`Falha ao obter URL pública do asset: ${err?.message || 'Storage error'}`));
            }
          }
        );
      });
    } catch (storageErr: any) {
      throw new Error(storageErr?.message || 'Falha no upload para o Firebase Storage.');
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

    // 4. Save metadata to Firestore (with orphan cleanup if save fails)
    try {
      await setDoc(doc(db, 'assets', assetId), newAsset);
    } catch (fsErr: any) {
      console.error('[AssetService] Firestore setDoc failed:', fsErr);
      // Attempt orphan cleanup of storage object to prevent zombie storage
      try {
        await deleteObject(storageRef);
      } catch (delErr) {
        console.warn('[AssetService] Orphan cleanup failed:', delErr);
      }
      throw new Error(`Falha ao salvar metadados do asset no Firestore: ${fsErr?.message || 'Erro de persistência'}`);
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
