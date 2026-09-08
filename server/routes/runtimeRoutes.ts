import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getAdminStorage } from '../repositories/firebaseAdminClient.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { assetRepository, sanitizeAlias } from '../repositories/assetRepository.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';
import { AssetType, AssetCategory } from '../../src/types/index.js';

export const runtimeRouter = express.Router();

const rawUpload = express.raw({ type: () => true, limit: '500mb' });

function classify(mime:string, filename:string): AssetType {
  const ext=path.extname(filename).slice(1).toLowerCase();
  if(mime.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) return 'VIDEO';
  if(mime.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) return 'AUDIO';
  return 'IMAGE';
}
function maxFor(type:AssetType){ return ASSET_UPLOAD_LIMITS[type].max_bytes; }

/** Backend-mediated asset upload. Avoids browser-to-GCS CORS issues in previews. */
runtimeRouter.post('/assets/upload', requireAuth, rawUpload, async (req:AuthenticatedRequest,res) => {
  const uid=req.user!.uid;
  try {
    const body=req.body as Buffer;
    if(!Buffer.isBuffer(body) || body.length===0) return res.status(400).json({success:false,error:{code:'EMPTY_FILE',message:'Arquivo vazio ou inválido.'}});
    const originalName=decodeURIComponent(String(req.header('x-file-name') || 'asset.bin'));
    const displayName=decodeURIComponent(String(req.header('x-asset-name') || originalName));
    const requestedAlias=sanitizeAlias(decodeURIComponent(String(req.header('x-asset-alias') || displayName)));
    const category=(String(req.header('x-asset-category') || 'GENERIC').toUpperCase()) as AssetCategory;
    const mime=String(req.header('content-type') || 'application/octet-stream').split(';')[0];
    const type=classify(mime,originalName);
    if(body.length>maxFor(type)) return res.status(413).json({success:false,error:{code:'FILE_TOO_LARGE',message:'Arquivo excede o limite permitido.'}});

    const storage=getAdminStorage(); const cfg=getFirebaseConfig();
    if(!storage || !cfg.storageBucket) return res.status(503).json({success:false,error:{code:'STORAGE_NOT_CONFIGURED',message:'Firebase Storage ainda não está provisionado para este projeto.'}});
    const bucket=storage.bucket(cfg.storageBucket);
    const tempId=`ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext=path.extname(originalName).replace(/[^.a-zA-Z0-9]/g,'').toLowerCase() || '';
    const storagePath=`users/${uid}/assets/${tempId}/original${ext}`;
    const file=bucket.file(storagePath);
    await file.save(body,{resumable:false,contentType:mime,metadata:{cacheControl:'private,max-age=3600'}});

    try {
      const asset=await assetRepository.createAsset({owner_user_id:uid,type,category,name:displayName,alias:requestedAlias,storage_path:storagePath,mime_type:mime,size_bytes:body.length,status:'READY'});
      return res.json({success:true,data:asset});
    } catch(err){ await file.delete({ignoreNotFound:true}).catch(()=>{}); throw err; }
  } catch(err:any){
    console.error('[AssetUpload]',err?.code || err?.message);
    return res.status(500).json({success:false,error:{code:'ASSET_UPLOAD_FAILED',message:err?.message || 'Falha ao enviar asset.'}});
  }
});

runtimeRouter.get('/assets/:assetId/content', requireAuth, async (req:AuthenticatedRequest,res) => {
  try {
    const asset=await assetRepository.getAsset(req.params.assetId,req.user!.uid); if(!asset) return res.status(404).end();
    const storage=getAdminStorage(); const cfg=getFirebaseConfig(); if(!storage||!cfg.storageBucket) return res.status(503).end();
    res.setHeader('Content-Type',asset.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control','private,max-age=300');
    storage.bucket(cfg.storageBucket).file(asset.storage_path).createReadStream().on('error',()=>res.status(404).end()).pipe(res);
  } catch { res.status(500).end(); }
});
