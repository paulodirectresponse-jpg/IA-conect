import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { smartRouterService } from '../services/smartRouterService.js';
import { walletService } from '../services/walletService.js';
import { promptCompilerService } from '../services/promptCompilerService.js';
import { paymentService } from '../services/paymentService.js';
import { ASSET_UPLOAD_LIMITS } from '../../src/config/constants.js';
import { AssetType, GenerationMode } from '../../src/types/index.js';

export const runtimeRouter = express.Router();

const jsonBody = express.json({ limit: '4mb' });

function classify(mime: string, filename: string): AssetType {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (mime.startsWith('video/') || ASSET_UPLOAD_LIMITS.VIDEO.allowed_extensions.includes(ext)) return 'VIDEO';
  if (mime.startsWith('audio/') || ASSET_UPLOAD_LIMITS.AUDIO.allowed_extensions.includes(ext)) return 'AUDIO';
  return 'IMAGE';
}

runtimeRouter.post('/assets/signed-upload', requireAuth, jsonBody, async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  try {
    const filename = String(req.body?.filename || 'asset.bin');
    const mime = String(req.body?.mime_type || 'application/octet-stream').split(';')[0];
    const size = Number(req.body?.size_bytes || 0);
    if (!size || size <= 0) return res.status(400).json({ success:false,error:{code:'EMPTY_FILE',message:'Arquivo vazio ou inválido.'}});
    const type = classify(mime, filename);
    if (size > ASSET_UPLOAD_LIMITS[type].max_bytes) return res.status(413).json({success:false,error:{code:'FILE_TOO_LARGE',message:'O arquivo excede o limite máximo permitido de 50 MB.'}});
    const supabaseUrl=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
    const secretKey=String(process.env.SUPABASE_SECRET_KEY||'').trim();
    const bucket=String(process.env.SUPABASE_BUCKET||'ia-conect-assets').trim();
    if(!supabaseUrl||!secretKey||!bucket)return res.status(503).json({success:false,error:{code:'SUPABASE_NOT_CONFIGURED',message:'Supabase Storage não está configurado no servidor.'}});
    const assetId=`ast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext=path.extname(filename).replace(/[^.a-zA-Z0-9]/g,'').toLowerCase();
    const storagePath=`users/${uid}/assets/${assetId}/original${ext}`;
    const encodedPath=storagePath.split('/').map(encodeURIComponent).join('/');
    const encodedBucket=encodeURIComponent(bucket);
    const signResponse=await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${encodedBucket}/${encodedPath}`,{method:'POST',headers:{Authorization:`Bearer ${secretKey}`,apikey:secretKey,'Content-Type':'application/json'},body:'{}'});
    const responseText=await signResponse.text();let signedData:any={};try{signedData=JSON.parse(responseText);}catch{}
    if(!signResponse.ok){console.error('[SupabaseSignedUpload]',signResponse.status,responseText);return res.status(502).json({success:false,error:{code:'SUPABASE_SIGN_FAILED',message:signedData?.message||signedData?.error||`Supabase respondeu HTTP ${signResponse.status}.`}});}
    const relativeUrl=String(signedData?.url||'');if(!relativeUrl)return res.status(502).json({success:false,error:{code:'SUPABASE_INVALID_RESPONSE',message:'O Supabase não retornou uma URL válida para o upload.'}});
    const signedUrl=relativeUrl.startsWith('http')?relativeUrl:`${supabaseUrl}/storage/v1${relativeUrl}`;let token='';try{token=new URL(signedUrl).searchParams.get('token')||'';}catch{}
    const publicUrl=`${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
    return res.json({success:true,data:{asset_id:assetId,type,storage_path:storagePath,signed_url:signedUrl,token,public_url:publicUrl,bucket}});
  }catch(err:any){console.error('[SupabaseSignedUpload]',err?.message||err);return res.status(500).json({success:false,error:{code:'SIGNED_UPLOAD_FAILED',message:err?.message||'Não foi possível preparar o upload.'}});}
});

runtimeRouter.post('/workspace/validate-and-preview',requireAuth,jsonBody,async(req:AuthenticatedRequest,res)=>{
 try{
  const uid=req.user!.uid;const{model_id,mode,prompt,negative_prompt,references=[],settings={}}=req.body;
  if(!prompt?.trim())return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'O prompt é obrigatório.'}});
  const model=await catalogRepository.getModel(model_id);if(!model||model.status==='INACTIVE')return res.status(400).json({success:false,error:{code:'MODEL_NOT_FOUND',message:'Modelo indisponível.'}});
  const resolvedMode=(mode||'TEXT_TO_VIDEO') as GenerationMode;let quote:any=null;
  try{quote=await smartRouterService.selectProvider({userId:uid,model_id:model.model_id,mode:resolvedMode,duration_seconds:Number(settings.duration_seconds||5),resolution:String(settings.resolution||'720p'),number_of_outputs:Number(settings.number_of_outputs||1)});}catch(e:any){if(e?.code!=='NO_PROVIDER_AVAILABLE')throw e;}
  const wallet=await walletService.getSummary(uid);const estimated=quote?.selected?.customer_price_cents??null;
  const compiled=promptCompilerService.compile({original_prompt:prompt,references,negative_prompt,generation_settings:{model_id:model.model_id,mode:resolvedMode,duration_seconds:Number(settings.duration_seconds||5),resolution:String(settings.resolution||'720p'),aspect_ratio:String(settings.aspect_ratio||'16:9')}});
  const requestDraft={request_id:`req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,user_id:uid,model_id:model.model_id,model_name:model.name,mode:resolvedMode,prompt:prompt.trim(),compiled_prompt:compiled.compiled_prompt,prompt_compiler_version:compiled.prompt_compiler_version,references,settings:{...settings,duration_seconds:Number(settings.duration_seconds||5),resolution:String(settings.resolution||'720p'),aspect_ratio:String(settings.aspect_ratio||'16:9'),number_of_outputs:Number(settings.number_of_outputs||1)},estimated_cost_cents:estimated,customer_balance_available_cents:wallet.available_balance_cents,balance_after_generation_cents:estimated==null?wallet.available_balance_cents:wallet.available_balance_cents-estimated,has_sufficient_funds:estimated!=null&&wallet.available_balance_cents>=estimated,created_at:new Date().toISOString()};
  return res.json({success:true,data:{request_draft:requestDraft,notice:estimated!=null?'Preço calculado pela rota configurada mais econômica. Nenhum saldo foi debitado ainda.':'Nenhum provider configurado e precificado está disponível para esta combinação.'}});
 }catch(err:any){return res.status(400).json({success:false,error:{code:err?.code||'VALIDATION_FAILED',message:err?.message||'Falha na validação.'}});}
});

// Mercado Pago webhook must be public but cryptographically verified.
runtimeRouter.post('/payments/webhook',jsonBody,async(req,res)=>{
 const dataId=String(req.query['data.id']||req.body?.data?.id||'');
 if(!dataId)return res.status(200).json({ok:true,ignored:true});
 try{
  const result=await paymentService.processWebhook({headers:req.headers as any,dataId,eventType:String(req.body?.type||req.query.type||''),action:String(req.body?.action||'')});
  return res.status(200).json({ok:true,...result});
 }catch(err:any){
  if(err?.code==='INVALID_WEBHOOK_SIGNATURE')return res.status(401).json({ok:false});
  console.error('[MercadoPagoWebhook]',err?.message);
  return res.status(500).json({ok:false});
 }
});
