import crypto from 'crypto';
import { assetRepository } from '../repositories/assetRepository.js';
import { getAdminStorage } from '../repositories/firebaseAdminClient.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { Asset, StorageDiagnosticResult } from '../../src/types/index.js';

const STREAM_TOKEN_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET || 'ai-gen-stream-secure-key-2025';

export interface ResolvedAssetReference {
  asset_id: string;
  alias: string;
  name: string;
  type: string;
  category: string;
  provider_accessible_url: string;
  storage_path: string;
  mime_type: string;
}

export const assetReferenceResolver = {
  /**
   * Generates a tamper-proof signed streaming token for a private asset.
   * Providers can stream this URL directly without public bucket exposure.
   */
  createStreamToken(assetId: string, userId: string, durationMinutes = 60): string {
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    const payload = `${assetId}:${userId}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', STREAM_TOKEN_SECRET).update(payload).digest('hex');
    const tokenData = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
    return tokenData;
  },

  /**
   * Validates a stream token and extracts assetId and userId if valid.
   */
  verifyStreamToken(token: string): { assetId: string; userId: string } | null {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
      const { payload, hmac } = decoded;
      const expectedHmac = crypto.createHmac('sha256', STREAM_TOKEN_SECRET).update(payload).digest('hex');
      if (hmac !== expectedHmac) {
        return null;
      }
      const [assetId, userId, expiresAtStr] = payload.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() > expiresAt) {
        return null; // Expired
      }
      return { assetId, userId };
    } catch {
      return null;
    }
  },

  /**
   * Generates a provider-accessible URL for an asset.
   * Attempts Google Cloud Storage signed URL first.
   * If service account signing is unavailable in container, falls back to secure signed server stream proxy.
   */
  async getProviderAccessibleUrl(asset: Asset, reqHost?: string): Promise<string> {
    const storage = getAdminStorage();
    const config = getFirebaseConfig();

    if (storage && config.storageBucket && asset.storage_path) {
      try {
        const bucket = storage.bucket(config.storageBucket);
        const file = bucket.file(asset.storage_path);
        
        // Attempt native GCS V4 Signed URL (valid for 60 minutes)
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });
        if (signedUrl && signedUrl.startsWith('http')) {
          return signedUrl;
        }
      } catch (err: any) {
        // Log GCS signed URL fallback notice without crashing
        // Common in Cloud Run environments without custom signing key
      }
    }

    // Fallback: Generate secure signed stream proxy URL
    const token = this.createStreamToken(asset.asset_id, asset.owner_user_id, 60);
    const host = reqHost || process.env.APP_URL || 'http://localhost:3000';
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;
    return `${baseUrl}/api/assets/stream/${token}`;
  },

  /**
   * Resolves a list of asset IDs or aliases into provider-accessible references.
   * Verifies user ownership, asset READY status, and attaches secure temporary URLs.
   */
  async resolveReferenceAssetUrls(
    userId: string,
    assetIds: string[],
    reqHost?: string
  ): Promise<ResolvedAssetReference[]> {
    if (!assetIds || assetIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(assetIds));
    const resolvedList: ResolvedAssetReference[] = [];

    for (const id of uniqueIds) {
      const asset = await assetRepository.getAsset(id, userId);
      if (!asset) {
        throw new Error(`Asset '${id}' não encontrado ou sem permissão de acesso para o usuário.`);
      }

      if (asset.status !== 'READY') {
        throw new Error(`Asset '${asset.name}' (@${asset.alias}) não está pronto para geração (status: ${asset.status}).`);
      }

      const providerUrl = await this.getProviderAccessibleUrl(asset, reqHost);

      resolvedList.push({
        asset_id: asset.asset_id,
        alias: asset.alias,
        name: asset.name,
        type: asset.type,
        category: asset.category,
        provider_accessible_url: providerUrl,
        storage_path: asset.storage_path,
        mime_type: asset.mime_type,
      });
    }

    return resolvedList;
  },

  /**
   * Diagnostic probe for Admin to test storage bucket connectivity, permissions, and signed URL generation.
   */
  async runStorageDiagnostic(): Promise<StorageDiagnosticResult> {
    const startTime = Date.now();
    const config = getFirebaseConfig();
    const storage = getAdminStorage();

    if (!storage || !config.storageBucket) {
      return {
        is_configured: false,
        storage_bucket: config.storageBucket || 'Nenhum bucket configurado',
        write_test: 'SKIPPED',
        signed_url_test: 'SKIPPED',
        message: 'Firebase Storage não configurado ou bucket ausente na configuração.',
        checked_at: new Date().toISOString(),
      };
    }

    const bucket = storage.bucket(config.storageBucket);
    let writeTest: 'PASS' | 'FAIL' = 'FAIL';
    let signedUrlTest: 'PASS' | 'FAIL' = 'FAIL';
    let errorMessage: string | undefined;

    try {
      // 1. Test Write and Delete of probe file
      const probePath = `_diagnostics/probe_${Date.now()}.txt`;
      const probeFile = bucket.file(probePath);
      await probeFile.save(Buffer.from('probe_ok'), {
        contentType: 'text/plain',
        resumable: false,
      });
      writeTest = 'PASS';

      // 2. Test Signed URL generation
      try {
        const [url] = await probeFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        if (url && url.startsWith('http')) {
          signedUrlTest = 'PASS';
        }
      } catch (err: any) {
        // GCS signed URL needs signing credentials; fallback proxy works
        signedUrlTest = 'FAIL';
      }

      // Cleanup probe file
      await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
    } catch (e: any) {
      errorMessage = e?.message || 'Falha ao acessar bucket no teste diagnóstico';
      writeTest = 'FAIL';
    }

    const latency = Date.now() - startTime;

    return {
      is_configured: true,
      storage_bucket: config.storageBucket,
      write_test: writeTest,
      signed_url_test: signedUrlTest,
      message: writeTest === 'PASS' 
        ? 'Diagnóstico do Firebase Storage concluído com sucesso. Bucket acessível.' 
        : `Diagnóstico indicou restrição de acesso ao bucket: ${errorMessage}`,
      details: {
        latency_ms: latency,
        bucket_accessible: writeTest === 'PASS',
        error: errorMessage,
      },
      checked_at: new Date().toISOString(),
    };
  },
};
