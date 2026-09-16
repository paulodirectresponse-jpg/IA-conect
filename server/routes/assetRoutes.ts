import { Router } from 'express';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { assetService } from '../services/assetService.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';
import { AssetType } from '../../src/types/index.js';

export const assetRouter = Router();

function classify(mime: string, filename: string): AssetType {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (mime.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) return 'VIDEO';
  if (mime.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) return 'AUDIO';
  if (mime.startsWith('model/') || ASSET_UPLOAD_LIMITS.MODEL_3D.allowed_extensions.includes(ext)) return 'MODEL_3D';
  return 'IMAGE';
}

function storageConfig() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  const bucket = String(process.env.SUPABASE_BUCKET || 'ia-conect-assets').trim();
  if (!supabaseUrl || !secretKey || !bucket) throw new Error('SUPABASE_NOT_CONFIGURED');
  return { supabaseUrl, secretKey, bucket };
}

function encodedStoragePath(storagePath:string) {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

function publicStorageUrl(supabaseUrl:string,bucket:string,storagePath:string) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedStoragePath(storagePath)}`;
}

async function signUploadPath(config:ReturnType<typeof storageConfig>,storagePath:string) {
  const encodedBucket = encodeURIComponent(config.bucket);
  const encodedPath = encodedStoragePath(storagePath);
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/upload/sign/${encodedBucket}/${encodedPath}`, {
    method:'POST',
    headers:{Authorization:`Bearer ${config.secretKey}`,apikey:config.secretKey,'Content-Type':'application/json'},
    body:'{}',
  });
  const responseText = await response.text();
  let signedData:any = {};
  try { signedData = JSON.parse(responseText); } catch {}
  if (!response.ok) {
    console.error('[SupabaseSignedUpload]', response.status, responseText);
    throw new Error('SUPABASE_SIGN_FAILED');
  }
  const relativeUrl = String(signedData?.url || '');
  if (!relativeUrl) throw new Error('SUPABASE_INVALID_RESPONSE');
  const signedUrl = relativeUrl.startsWith('http') ? relativeUrl : `${config.supabaseUrl}/storage/v1${relativeUrl}`;
  let token = '';
  try { token = new URL(signedUrl).searchParams.get('token') || ''; } catch {}
  return { signed_url:signedUrl, token };
}

async function publicObjectExists(url:string) {
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(url, { method:'HEAD', redirect:'follow' });
      if (response.ok) return true;
    } catch {}
    if (attempt === 0) await new Promise((resolve)=>setTimeout(resolve,150));
  }
  return false;
}

assetRouter.post('/assets/upload-ticket', requireAuth, async (req:AuthenticatedRequest,res) => {
  const uid=req.user!.uid;
  try {
    const filename=String(req.body?.filename||'asset.bin');
    const mime=String(req.body?.mime_type||'application/octet-stream').split(';')[0];
    const size=Number(req.body?.size_bytes||0);
    const name=String(req.body?.name||filename).trim()||filename;
    const alias=req.body?.alias?String(req.body.alias):undefined;
    const category=req.body?.category;

    if (!size || size<=0) return res.status(400).json({success:false,error:{code:'EMPTY_FILE',message:'Arquivo vazio ou inválido.'}});

    const validation=assetService.validateUpload({mime_type:mime,size_bytes:size,filename});
    const config=storageConfig();
    const assetId=`ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const safeExt=String(validation.extension||'bin').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()||'bin';
    const storagePath=`users/${uid}/assets/${assetId}/original.${safeExt}`;
    const thumbnailStoragePath=validation.type==='IMAGE'?`users/${uid}/assets/${assetId}/thumbnail.webp`:undefined;

    const [originalSigned,thumbnailSigned]=await Promise.all([
      signUploadPath(config,storagePath),
      thumbnailStoragePath?signUploadPath(config,thumbnailStoragePath):Promise.resolve(null),
    ]);

    const publicUrl=publicStorageUrl(config.supabaseUrl,config.bucket,storagePath);
    const thumbnailUrl=thumbnailStoragePath?publicStorageUrl(config.supabaseUrl,config.bucket,thumbnailStoragePath):publicUrl;
    const asset=await assetService.reserveUpload({
      userId:uid,
      assetId,
      name,
      alias,
      category,
      mime_type:mime,
      size_bytes:size,
      filename,
      storage_path:storagePath,
      thumbnail_storage_path:thumbnailStoragePath,
      public_url:publicUrl,
      thumbnail_url:thumbnailUrl,
    });

    return res.json({success:true,data:{
      asset,
      original:{storage_path:storagePath,public_url:publicUrl,...originalSigned},
      thumbnail:thumbnailStoragePath&&thumbnailSigned?{storage_path:thumbnailStoragePath,public_url:thumbnailUrl,...thumbnailSigned}:null,
      bucket:config.bucket,
    }});
  } catch (err:any) {
    const message=String(err?.message||err);
    if (message==='SUPABASE_NOT_CONFIGURED') return res.status(503).json({success:false,error:{code:'SUPABASE_NOT_CONFIGURED',message:'Armazenamento temporariamente indisponível.'}});
    if (message==='SUPABASE_SIGN_FAILED'||message==='SUPABASE_INVALID_RESPONSE') return res.status(502).json({success:false,error:{code:message,message:'Não foi possível preparar o envio agora.'}});
    if (/excede|não suportado/i.test(message)) return res.status(400).json({success:false,error:{code:'UPLOAD_VALIDATION_ERROR',message}});
    console.error('[UploadTicket]',message);
    return res.status(500).json({success:false,error:{code:'UPLOAD_TICKET_FAILED',message:'Não foi possível preparar o envio.'}});
  }
});

assetRouter.post('/assets/:assetId/complete', requireAuth, async (req:AuthenticatedRequest,res) => {
  const uid=req.user!.uid;
  try {
    const asset=await assetRepository.getAsset(req.params.assetId,uid);
    if(!asset)return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Arquivo não encontrado.'}});
    if(asset.status==='READY')return res.json({success:true,data:asset});
    if(asset.status!=='UPLOADING')return res.status(409).json({success:false,error:{code:'INVALID_UPLOAD_STATE',message:'O arquivo não está em envio.'}});

    const [originalReady,thumbnailReady]=await Promise.all([
      asset.public_url?publicObjectExists(asset.public_url):Promise.resolve(false),
      asset.type==='IMAGE'?(asset.thumbnail_url?publicObjectExists(asset.thumbnail_url):Promise.resolve(false)):Promise.resolve(true),
    ]);
    if(!originalReady||!thumbnailReady){
      return res.status(409).json({success:false,error:{code:'UPLOAD_NOT_VISIBLE',message:'O armazenamento ainda não confirmou todos os arquivos enviados.'}});
    }

    const completed=await assetService.completeUpload({
      userId:uid,
      assetId:asset.asset_id,
      width:req.body?.width==null?null:Number(req.body.width),
      height:req.body?.height==null?null:Number(req.body.height),
      duration_seconds:req.body?.duration_seconds==null?null:Number(req.body.duration_seconds),
    });
    return res.json({success:true,data:completed});
  } catch(err:any){
    console.error('[CompleteUpload]',err?.message||err);
    return res.status(400).json({success:false,error:{code:'UPLOAD_COMPLETE_FAILED',message:err?.message||'Não foi possível finalizar o envio.'}});
  }
});

assetRouter.post('/assets/signed-upload', requireAuth, async (req: AuthenticatedRequest, res) => {
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

    const config=storageConfig();
    const assetId = `ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(filename).replace(/[^.a-zA-Z0-9]/g, '').toLowerCase();
    const storagePath = `users/${uid}/assets/${assetId}/original${ext}`;
    const signed=await signUploadPath(config,storagePath);
    const publicUrl=publicStorageUrl(config.supabaseUrl,config.bucket,storagePath);

    return res.json({success:true,data:{asset_id:assetId,type,storage_path:storagePath,...signed,public_url:publicUrl,bucket:config.bucket}});
  } catch (err:any) {
    console.error('[SupabaseSignedUpload]', err?.message || err);
    const code=err?.message==='SUPABASE_NOT_CONFIGURED'?'SUPABASE_NOT_CONFIGURED':'SIGNED_UPLOAD_FAILED';
    const status=code==='SUPABASE_NOT_CONFIGURED'?503:500;
    return res.status(status).json({success:false,error:{code,message:'Não foi possível preparar o upload.'}});
  }
});

assetRouter.get('/assets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const type = req.query.type as any;
    const category = req.query.category as any;
    const search = req.query.search as string;

    const assets = await assetRepository.listUserAssets(uid, { type, category, search });
    res.json({ success: true, data: assets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ASSETS_LIST_ERROR', message: err.message || 'Erro ao listar arquivos.' } });
  }
});

assetRouter.post('/assets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const {
      asset_id,
      name,
      alias,
      category,
      mime_type,
      size_bytes,
      filename,
      storage_path,
      public_url,
      width,
      height,
      duration_seconds,
    } = req.body;

    const asset = await assetService.registerAsset({
      userId: uid,
      assetId: asset_id,
      name,
      alias,
      category,
      mime_type: mime_type || 'image/jpeg',
      size_bytes: size_bytes || 0,
      filename: filename || name || 'asset',
      storage_path,
      public_url,
      width,
      height,
      duration_seconds,
    });

    res.json({ success: true, data: asset });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_CREATE_ERROR', message: err.message } });
  }
});

assetRouter.patch('/assets/:assetId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const assetId = req.params.assetId;
    const { name, alias, category, status, public_url, media_metadata } = req.body;

    const updated = await assetRepository.updateAsset(assetId, uid, {
      name,
      alias,
      category,
      status,
      public_url,
      media_metadata:media_metadata&&typeof media_metadata==='object'?media_metadata:undefined,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_UPDATE_ERROR', message: err.message } });
  }
});

assetRouter.delete('/assets/:assetId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const assetId = req.params.assetId;

    await assetRepository.softDeleteAsset(assetId, uid);
    res.json({ success: true, message: 'Arquivo removido com sucesso.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'ASSET_DELETE_ERROR', message: err.message } });
  }
});

// ==========================================
// STAGE 2: PRESETS
// ==========================================

// ==========================================
// ETAPA 3: REAL PAYMENTS & DEPOSITS (PIX & CARD)
// ==========================================

/**
 * Creates a deposit payment order via PIX or Credit Card.
 */
