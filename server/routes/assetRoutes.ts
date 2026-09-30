import { Router, type Response as ExpressResponse } from 'express';
import path from 'path';
import { Readable } from 'node:stream';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { assetService } from '../services/assetService.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';
import { AssetCategory, AssetType } from '../../src/types/index.js';
import { legacyImageRecoveryService } from '../services/legacyImageRecoveryService.js';
import { assetReferenceResolver } from '../services/assetReferenceResolver.js';
import { hasR2AssetBucket, parseAssetByteRange, publicAssetKeyFromPath, publicAssetUrl, r2AssetStorageService } from '../services/r2AssetStorageService.js';

export const assetRouter = Router();

function classify(mime: string, filename: string): AssetType {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (mime.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) return 'VIDEO';
  if (mime.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) return 'AUDIO';
  if (mime.startsWith('model/') || ASSET_UPLOAD_LIMITS.MODEL_3D.allowed_extensions.includes(ext)) return 'MODEL_3D';
  return 'IMAGE';
}

function uploadTarget(assetId:string,kind:'original'|'thumbnail',storagePath:string){
  return{
    storage_path:storagePath,
    upload_url:`/api/assets/${encodeURIComponent(assetId)}/content?kind=${kind}`,
    public_url:publicAssetUrl(storagePath),
  };
}

async function reserveAssetUpload(params:{userId:string;filename:string;name?:string;alias?:string;category?:AssetCategory;mime:string;size:number}){
  if(!hasR2AssetBucket())throw Object.assign(new Error('Cloudflare R2 não está configurado.'),{code:'ASSET_STORAGE_UNAVAILABLE'});
  const validation=assetService.validateUpload({mime_type:params.mime,size_bytes:params.size,filename:params.filename});
  const assetId=`ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const safeExt=String(validation.extension||'bin').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()||'bin';
  const storagePath=`users/${params.userId}/assets/${assetId}/original.${safeExt}`;
  const thumbnailStoragePath=validation.type==='IMAGE'?`users/${params.userId}/assets/${assetId}/thumbnail.webp`:undefined;
  const asset=await assetService.reserveUpload({
    userId:params.userId,
    assetId,
    name:params.name||params.filename,
    alias:params.alias,
    category:params.category,
    mime_type:params.mime,
    size_bytes:params.size,
    filename:params.filename,
    storage_path:storagePath,
    thumbnail_storage_path:thumbnailStoragePath,
    public_url:publicAssetUrl(storagePath),
    thumbnail_url:thumbnailStoragePath?publicAssetUrl(thumbnailStoragePath):publicAssetUrl(storagePath),
  });
  return{
    asset,
    original:uploadTarget(assetId,'original',storagePath),
    thumbnail:thumbnailStoragePath?uploadTarget(assetId,'thumbnail',thumbnailStoragePath):null,
    bucket:'ia-conect-assets',
  };
}

async function pipeWebStreamToResponse(stream:ReadableStream<Uint8Array>,res:ExpressResponse){
  await stream.pipeTo(new WritableStream<Uint8Array>({
    async write(chunk){
      if(res.destroyed)throw new Error('CLIENT_DISCONNECTED');
      if(res.write(Buffer.from(chunk)))return;
      await new Promise<void>((resolve,reject)=>{
        const onDrain=()=>{cleanup();resolve();};
        const onError=(error:Error)=>{cleanup();reject(error);};
        const cleanup=()=>{res.off('drain',onDrain);res.off('error',onError);};
        res.once('drain',onDrain);
        res.once('error',onError);
      });
    },
    close(){res.end();},
    abort(reason){if(!res.destroyed)res.destroy(reason instanceof Error?reason:undefined);},
  }));
}

async function publicMediaResponse(req:AuthenticatedRequest,res:ExpressResponse){
  const key=publicAssetKeyFromPath(req.originalUrl.split('?')[0]);
  if(!key)return res.status(404).end();
  try{
    const metadata=await r2AssetStorageService.head(key);
    if(!metadata)return res.status(404).end();
    const headers=new Headers();
    metadata.writeHttpMetadata(headers);
    headers.set('etag',metadata.httpEtag);
    headers.set('content-length',String(metadata.size));
    headers.set('accept-ranges','bytes');
    headers.set('x-content-type-options','nosniff');
    if(!headers.has('cache-control'))headers.set('cache-control','public, max-age=31536000, immutable');
    if(req.method==='HEAD')return res.status(200).set(Object.fromEntries(headers)).end();
    const range=parseAssetByteRange(req.get('range')||null,metadata.size);
    if(range==='UNSATISFIABLE'){
      headers.set('content-range',`bytes */${metadata.size}`);
      headers.set('content-length','0');
      return res.status(416).set(Object.fromEntries(headers)).end();
    }
    const object=await r2AssetStorageService.get(key,range||undefined);
    if(!object)return res.status(404).end();
    object.writeHttpMetadata(headers);
    headers.set('etag',object.httpEtag);
    headers.set('content-length',String(range?range.length:metadata.size));
    if(range)headers.set('content-range',range.contentRange);
    if(!headers.has('cache-control'))headers.set('cache-control','public, max-age=31536000, immutable');
    res.status(range?206:200).set(Object.fromEntries(headers));
    await pipeWebStreamToResponse(object.body,res);
    return undefined;
  }catch(error:any){
    console.error('[R2AssetReadFailed]',JSON.stringify({code:String(error?.code||'R2_READ_FAILED')}));
    if(res.headersSent){res.destroy();return undefined;}
    return res.status(503).json({success:false,error:{code:'ASSET_STORAGE_UNAVAILABLE',reason_code:String(error?.code||'R2_READ_FAILED'),message:'O arquivo não pôde ser lido do armazenamento.'}});
  }
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

    const data=await reserveAssetUpload({userId:uid,filename,name,alias,category,mime,size});
    return res.json({success:true,data});
  } catch (err:any) {
    const code=String(err?.code||(/excede|não suportado/i.test(String(err?.message||''))?'UPLOAD_VALIDATION_ERROR':'UPLOAD_TICKET_FAILED'));
    const status=code==='ASSET_STORAGE_UNAVAILABLE'?503:code==='UPLOAD_VALIDATION_ERROR'?400:502;
    console.error('[UploadTicketFailed]',JSON.stringify({code,status}));
    return res.status(status).json({success:false,error:{code,message:code==='ASSET_STORAGE_UNAVAILABLE'?'O armazenamento de arquivos está indisponível.':String(err?.message||'Não foi possível preparar o envio.')}});
  }
});

assetRouter.put('/assets/:assetId/content', requireAuth, async (req:AuthenticatedRequest,res) => {
  const uid=req.user!.uid;
  const assetId=String(req.params.assetId||'');
  const kind=String(req.query.kind||'original');
  try{
    if(!hasR2AssetBucket())return res.status(503).json({success:false,error:{code:'ASSET_STORAGE_UNAVAILABLE',message:'O armazenamento de arquivos está indisponível.'}});
    if(kind!=='original'&&kind!=='thumbnail')return res.status(400).json({success:false,error:{code:'UPLOAD_PART_INVALID',message:'Parte do upload inválida.'}});
    const asset=await assetRepository.getAsset(assetId,uid);
    if(!asset)return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Arquivo não encontrado.'}});
    if(asset.status!=='UPLOADING')return res.status(409).json({success:false,error:{code:'INVALID_UPLOAD_STATE',message:'O arquivo não está em envio.'}});
    const storagePath=kind==='thumbnail'?asset.thumbnail_storage_path:asset.storage_path;
    if(!storagePath||kind==='thumbnail'&&asset.type!=='IMAGE')return res.status(400).json({success:false,error:{code:'UPLOAD_PART_INVALID',message:'Parte do upload inválida.'}});
    const maxBytes=kind==='thumbnail'?5*1024*1024:ASSET_UPLOAD_LIMITS[asset.type].max_bytes;
    const expectedMime=(kind==='thumbnail'?'image/webp':asset.mime_type||'application/octet-stream').split(';')[0].toLowerCase();
    const requestMime=String(req.get('content-type')||'application/octet-stream').split(';')[0].toLowerCase();
    if(requestMime!=='application/octet-stream'&&requestMime!==expectedMime)return res.status(415).json({success:false,error:{code:'UPLOAD_MIME_MISMATCH',message:'O tipo do arquivo enviado não corresponde ao arquivo reservado.'}});
    const contentLength=Number(req.get('content-length')||0);
    if(!Number.isSafeInteger(contentLength)||contentLength<=0||contentLength>maxBytes)return res.status(contentLength>maxBytes?413:400).json({success:false,error:{code:contentLength>maxBytes?'FILE_TOO_LARGE':'EMPTY_FILE',message:'Tamanho do arquivo inválido.'}});
    if(kind==='original'&&contentLength!==asset.size_bytes)return res.status(400).json({success:false,error:{code:'UPLOAD_SIZE_MISMATCH',message:'O tamanho do arquivo não corresponde ao ticket de envio.'}});
    const stored=await r2AssetStorageService.putUploadedStream({
      storagePath,
      stream:Readable.toWeb(req),
      mimeType:expectedMime,
      expectedBytes:contentLength,
      maxBytes,
    });
    return res.json({success:true,data:{storage_path:stored.storage_path,size_bytes:stored.size_bytes}});
  }catch(error:any){
    const code=String(error?.code||'R2_UPLOAD_FAILED');
    const status=code==='ASSET_STORAGE_UNAVAILABLE'?503:code==='ASSET_ARCHIVE_TOO_LARGE'?413:code==='ASSET_UPLOAD_SIZE_MISMATCH'?400:502;
    console.error('[R2AssetUploadFailed]',JSON.stringify({asset_id:assetId,kind,code,status}));
    return res.status(status).json({success:false,error:{code,message:code==='ASSET_STORAGE_UNAVAILABLE'?'O armazenamento de arquivos está indisponível.':'O arquivo não foi confirmado no armazenamento; tente novamente.'}});
  }
});

assetRouter.get('/assets/media/*', (req:AuthenticatedRequest,res)=>publicMediaResponse(req,res));
assetRouter.head('/assets/media/*', (req:AuthenticatedRequest,res)=>publicMediaResponse(req,res));

assetRouter.post('/assets/:assetId/complete', requireAuth, async (req:AuthenticatedRequest,res) => {
  const uid=req.user!.uid;
  try {
    const asset=await assetRepository.getAsset(req.params.assetId,uid);
    if(!asset)return res.status(404).json({success:false,error:{code:'ASSET_NOT_FOUND',message:'Arquivo não encontrado.'}});
    if(asset.status==='READY'){
      if(await r2AssetStorageService.exists(asset.storage_path))return res.json({success:true,data:asset});
      return res.status(409).json({success:false,error:{code:'ASSET_STORAGE_OBJECT_MISSING',message:'O registro existe, mas o arquivo não está disponível no armazenamento.'}});
    }
    if(asset.status!=='UPLOADING')return res.status(409).json({success:false,error:{code:'INVALID_UPLOAD_STATE',message:'O arquivo não está em envio.'}});

    const [originalReady,thumbnailReady]=await Promise.all([
      r2AssetStorageService.exists(asset.storage_path),
      asset.thumbnail_storage_path?r2AssetStorageService.exists(asset.thumbnail_storage_path):Promise.resolve(true),
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
    const code=String(err?.code||'UPLOAD_COMPLETE_FAILED');
    console.error('[CompleteUploadFailed]',JSON.stringify({code}));
    return res.status(code==='ASSET_STORAGE_UNAVAILABLE'?503:502).json({success:false,error:{code,message:'Não foi possível confirmar o arquivo no armazenamento.'}});
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

    const data=await reserveAssetUpload({userId:uid,filename,name:filename,mime,size});
    return res.json({success:true,data:{asset_id:data.asset.asset_id,type,storage_path:data.original.storage_path,signed_url:data.original.upload_url,upload_url:data.original.upload_url,public_url:data.original.public_url,bucket:data.bucket}});
  } catch (err:any) {
    const code=String(err?.code||'SIGNED_UPLOAD_FAILED');
    console.error('[LegacyUploadTicketFailed]',JSON.stringify({code}));
    const status=code==='ASSET_STORAGE_UNAVAILABLE'?503:400;
    return res.status(status).json({success:false,error:{code,message:'Não foi possível preparar o upload.'}});
  }
});

assetRouter.post('/assets/recover-generated', requireAuth, async (req:AuthenticatedRequest,res) => {
  try{
    const storage=await assetReferenceResolver.runStorageDiagnostic();
    if(!storage.is_configured||storage.read_test!=='PASS'){
      return res.status(503).json({success:false,error:{code:'ASSET_STORAGE_UNAVAILABLE',message:'A recuperação está pausada até o armazenamento confirmar gravação e leitura. Nenhum registro foi alterado.',details:{storage}}});
    }
    const cursor=Math.max(0,Math.floor(Number(req.body?.cursor)||0));
    const limit=Math.min(5,Math.max(1,Math.floor(Number(req.body?.limit)||3)));
    const data=await legacyImageRecoveryService.runBatch({userId:req.user!.uid,cursor,limit});
    return res.json({success:true,data});
  }catch(err:any){
    const code=String(err?.code||'GENERATED_ASSET_RECOVERY_FAILED');
    const httpStatus=Number(err?.status);
    console.error('[RecoverGeneratedAssets]',JSON.stringify({code,...(Number.isInteger(httpStatus)?{http_status:httpStatus}:{})}));
    return res.status(500).json({success:false,error:{code:'GENERATED_ASSET_RECOVERY_FAILED',reason_code:code,...(Number.isInteger(httpStatus)?{http_status:httpStatus}:{}),message:'Não foi possível recuperar o histórico de imagens agora.'}});
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
