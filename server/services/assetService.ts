import { assetRepository, sanitizeAlias } from '../repositories/assetRepository.js';
import { Asset, AssetType, AssetCategory } from '../../src/types/index.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';

export const assetService = {
  validateUpload(params: {
    mime_type: string;
    size_bytes: number;
    filename: string;
  }): { type: AssetType; extension: string } {
    const { mime_type, size_bytes, filename } = params;

    let detectedType: AssetType | null = null;
    let extension = '';

    if (filename && filename.includes('.')) {
      extension = filename.split('.').pop()?.toLowerCase() || '';
    }

    if (mime_type.startsWith('image/') || ASSET_UPLOAD_LIMITS.IMAGE.allowed_extensions.includes(extension)) {
      detectedType = 'IMAGE';
      if (size_bytes > ASSET_UPLOAD_LIMITS.IMAGE.max_bytes) {
        throw new Error(`Imagem excede o limite máximo permitido de 25 MB.`);
      }
    } else if (mime_type.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(extension)) {
      detectedType = 'VIDEO';
      if (size_bytes > ASSET_UPLOAD_LIMITS.VIDEO.max_bytes) {
        throw new Error(`Vídeo excede o limite máximo permitido de 500 MB.`);
      }
    } else if (mime_type.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(extension)) {
      detectedType = 'AUDIO';
      if (size_bytes > ASSET_UPLOAD_LIMITS.AUDIO.max_bytes) {
        throw new Error(`Áudio excede o limite máximo permitido de 100 MB.`);
      }
    } else {
      throw new Error(`Tipo de mídia não suportado (${mime_type || extension}). Permitidos: imagens (JPG, PNG, WEBP), vídeos (MP4, MOV, WEBM), áudios (MP3, WAV, M4A).`);
    }

    return { type: detectedType, extension: extension || 'bin' };
  },

  async registerAsset(params: {
    userId: string;
    assetId?: string;
    name: string;
    alias?: string;
    category?: AssetCategory;
    mime_type: string;
    size_bytes: number;
    filename: string;
    storage_path?: string;
    public_url?: string;
    width?: number | null;
    height?: number | null;
    duration_seconds?: number | null;
  }): Promise<Asset> {
    const validation = this.validateUpload({
      mime_type: params.mime_type,
      size_bytes: params.size_bytes,
      filename: params.filename,
    });

    const category: AssetCategory = params.category || (validation.type === 'AUDIO' ? 'AUDIO_REFERENCE' : 'PRODUCT');

    return assetRepository.createAsset({
      asset_id: params.assetId,
      owner_user_id: params.userId,
      type: validation.type,
      category,
      name: params.name || params.filename || 'Novo Asset',
      alias: params.alias,
      storage_path: params.storage_path || `users/${params.userId}/assets/generated_${Date.now()}/original.${validation.extension}`,
      public_url: params.public_url,
      thumbnail_url: validation.type === 'IMAGE' ? params.public_url : undefined,
      mime_type: params.mime_type,
      size_bytes: params.size_bytes,
      width: params.width,
      height: params.height,
      duration_seconds: params.duration_seconds,
      status: 'READY',
    });
  },
};
