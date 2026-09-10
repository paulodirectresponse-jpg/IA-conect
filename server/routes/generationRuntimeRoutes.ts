import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationService } from '../services/generationService.js';
import { creditPricingService } from '../services/creditPricingService.js';
import { billingControlService } from '../services/billingControlService.js';

export const generationRuntimeRouter=Router();

generationRuntimeRouter.post('/pricing/quote',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{await billingControlService.assertNewGenerationAllowed();const uid=req.user!.uid,mode=req.body.mode,settings=req.body.settings||{};const q=await creditPricingService.preview({userId:uid,model_id:req.body.model_id,mode,prompt:req.body.prompt,negative_prompt:req.body.negative_prompt,duration_seconds:Number(settings.duration_seconds||1),resolution:settings.resolution||'720p',aspect_ratio:settings.aspect_ratio||'16:9',number_of_outputs:Number(settings.number_of_outputs||1),seed:settings.seed,motion_strength:settings.motion_strength,references:req.body.references||[],audio_enabled:settings.audio_enabled===undefined?undefined:Boolean(settings.audio_enabled),model_variant:settings.model_variant,pricing_options:settings.pricing_options});const price=q.retail.retail_credit_price,available=q.account.available_credits;res.json({success:true,data:{request_draft:{request_id:`quote_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,user_id:uid,model_id:req.body.model_id,mode,prompt:String(req.body.prompt||'').trim(),negative_prompt:req.body.negative_prompt,references:req.body.references||[],settings:{...settings,audio_enabled:q.signature.audio_enabled,model_variant:q.signature.model_variant,pricing_options:q.signature.pricing_options},has_pricing:true,retail_credit_price:price,authorized_credit_price:price,credit_balance_available:available,balance_after_generation_credits:available-price,has_sufficient_funds:available>=price,pricing_signature_hash:q.signature.hash,retail_pricing_id:q.retail.retail_pricing_id,retail_pricing_version:q.retail.version,max_allowed_cogs_cents:q.max_allowed_cogs_cents,pricing_health:q.health,estimated_cost_cents:price,customer_balance_available_cents:available,balance_after_generation_cents:available-price,created_at:new Date().toISOString()},notice:`Gerar • ${price.toLocaleString('pt-BR')} créditos`}});}catch(err:any){res.status(err?.code==='NO_SAFE_PROVIDER_AVAILABLE'?503:400).json({success:false,error:{code:err?.code||'PRICING_QUOTE_ERROR',message:err?.message||'Não foi possível obter o preço em créditos.'}});}
});

generationRuntimeRouter.post('/generations',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{await billingControlService.assertNewGenerationAllowed();const uid=req.user!.uid,host=req.get('host')||process.env.APP_URL,authorization=String(req.headers.authorization||''),idToken=authorization.startsWith('Bearer ')?authorization.slice(7):undefined;const g=await generationService.createAndStartGeneration({userId:uid,model_id:req.body.model_id,mode:req.body.mode,prompt:req.body.prompt,negative_prompt:req.body.negative_prompt,duration_seconds:Number(req.body.duration_seconds||1),resolution:req.body.resolution||'1K',aspect_ratio:req.body.aspect_ratio||'1:1',number_of_outputs:Number(req.body.number_of_outputs||1),seed:req.body.seed,motion_strength:req.body.motion_strength,audio_enabled:req.body.audio_enabled===undefined?undefined:Boolean(req.body.audio_enabled),model_variant:req.body.model_variant,pricing_options:req.body.pricing_options,references:req.body.references||[],requested_provider_id:req.body.requested_provider_id,client_request_id:req.body.client_request_id,authorized_credit_price:Number.isFinite(Number(req.body.authorized_credit_price))?Number(req.body.authorized_credit_price):Number.isFinite(Number(req.body.maximum_authorized_cost_cents))?Number(req.body.maximum_authorized_cost_cents):undefined,retail_pricing_id:req.body.retail_pricing_id,pricing_signature_hash:req.body.pricing_signature_hash,reqHost:host,idToken});res.json({success:true,data:g});}
 catch(err:any){const status=err?.code==='CREDIT_INSUFFICIENT_FUNDS'?402:err?.code==='PRICE_CHANGED_REQUOTE_REQUIRED'?409:err?.code==='NO_SAFE_PROVIDER_AVAILABLE'?503:400;res.status(status).json({success:false,error:{code:err?.code||'GENERATION_ERROR',message:err?.message||'Não foi possível iniciar a geração.',missing_credits:err?.missing_credits}});}
});

generationRuntimeRouter.get('/generations',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{const rows=await generationService.listUserGenerations(req.user!.uid,Math.min(100,Math.max(1,Number(req.query.limit||50))));return res.json({success:true,data:rows});}
 catch(err:any){return res.status(500).json({success:false,error:{code:'GENERATION_LIST_ERROR',message:err?.message||'Não foi possível carregar as gerações.'}});}
});

generationRuntimeRouter.get('/generations/:generationId',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{const generation=await generationService.getGeneration(req.params.generationId,req.user!.uid);if(!generation)return res.status(404).json({success:false,error:{code:'GENERATION_NOT_FOUND',message:'Geração não encontrada.'}});return res.json({success:true,data:generation});}
 catch(err:any){return res.status(500).json({success:false,error:{code:'GENERATION_GET_ERROR',message:err?.message||'Não foi possível carregar a geração.'}});}
});

generationRuntimeRouter.post('/generations/:generationId/cancel',requireAuth,async(req:AuthenticatedRequest,res)=>{
 try{const generation=await generationService.cancelGeneration(req.params.generationId,req.user!.uid);return res.json({success:true,data:generation});}
 catch(err:any){const message=err?.message||'Não foi possível cancelar esta geração.';const providerLocked=/não permite cancelar|processamento/i.test(message);return res.status(providerLocked?409:400).json({success:false,error:{code:providerLocked?'GENERATION_CANCEL_UNAVAILABLE':err?.code||'GENERATION_CANCEL_ERROR',message}});}
});
