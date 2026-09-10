import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { paymentService } from '../services/paymentService.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';
import { AssetType } from '../../src/types/index.js';

export const runtimeRouter = express.Router();

function classify(mime: string, filename: string): AssetType {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (mime.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) return 'VIDEO';
  if (mime.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) return 'AUDIO';
  return 'IMAGE';
}

runtimeRouter.post('/assets/signed-upload', requireAuth, async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  try {
    const filename = String(req.body?.filename || 'asset.bin');
    const mime = String(req.body?.mime_type || 'application/octet-stream').split(';')[0];
    const size = Number(req.body?.size_bytes || 0);
    if (!size || size <= 0) {
      return res.status(400).json({ success:false,error:{code:'EMPTY_FILE',message:'Arquivo vazio ou inválido.'}});
    }

    const type = classify(mime, filename);
    if (size > ASSET_UPLOAD_LIMITS[type].max_bytes) {
      return res.status(413).json({success:false,error:{code:'FILE_TOO_LARGE',message:'O arquivo excede o limite máximo permitido.'}});
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const secretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim();
    const bucket = String(process.env.SUPABASE_BUCKET || 'ia-conect-assets').trim();
    if (!supabaseUrl || !secretKey || !bucket) {
      return res.status(503).json({success:false,error:{code:'SUPABASE_NOT_CONFIGURED',message:'Armazenamento temporariamente indisponível.'}});
    }

    const assetId = `ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(filename).replace(/[^.a-zA-Z0-9]/g, '').toLowerCase();
    const storagePath = `users/${uid}/assets/${assetId}/original${ext}`;
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    const encodedBucket = encodeURIComponent(bucket);

    const signResponse = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${encodedBucket}/${encodedPath}`, {
      method:'POST',
      headers:{Authorization:`Bearer ${secretKey}`,apikey:secretKey,'Content-Type':'application/json'},
      body:'{}',
    });

    const responseText = await signResponse.text();
    let signedData:any = {};
    try { signedData = JSON.parse(responseText); } catch {}

    if (!signResponse.ok) {
      console.error('[SupabaseSignedUpload]', signResponse.status, responseText);
      return res.status(502).json({success:false,error:{code:'SUPABASE_SIGN_FAILED',message:'Não foi possível preparar o upload agora.'}});
    }

    const relativeUrl = String(signedData?.url || '');
    if (!relativeUrl) {
      return res.status(502).json({success:false,error:{code:'SUPABASE_INVALID_RESPONSE',message:'Não foi possível preparar o upload agora.'}});
    }

    const signedUrl = relativeUrl.startsWith('http') ? relativeUrl : `${supabaseUrl}/storage/v1${relativeUrl}`;
    let token = '';
    try { token = new URL(signedUrl).searchParams.get('token') || ''; } catch {}
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;

    return res.json({success:true,data:{asset_id:assetId,type,storage_path:storagePath,signed_url:signedUrl,token,public_url:publicUrl,bucket}});
  } catch (err:any) {
    console.error('[SupabaseSignedUpload]', err?.message || err);
    return res.status(500).json({success:false,error:{code:'SIGNED_UPLOAD_FAILED',message:'Não foi possível preparar o upload.'}});
  }
});

// Public endpoint: Mercado Pago authenticates the event with its webhook signature.
runtimeRouter.post('/payments/webhook', async (req, res) => {
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  if (!dataId) return res.status(200).json({ok:true,ignored:true});

  try {
    const result = await paymentService.processWebhook({
      headers:req.headers as any,
      dataId,
      eventType:String(req.body?.type || req.query.type || ''),
      action:String(req.body?.action || ''),
    });
    return res.status(200).json({ok:true,...result});
  } catch (err:any) {
    if (err?.code === 'INVALID_WEBHOOK_SIGNATURE') return res.status(401).json({ok:false});
    console.error('[MercadoPagoWebhook]', err?.message || err);
    return res.status(500).json({ok:false});
  }
});
