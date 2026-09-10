import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationService } from '../services/generationService.js';
import { creditPricingService } from '../services/creditPricingService.js';
import { billingControlService } from '../services/billingControlService.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { promptCompilerService } from '../services/promptCompilerService.js';
import { GenerationMode } from '../../src/types/index.js';
import { publicGenerationError } from '../services/publicGenerationError.js';

export const generationRouter = Router();

function publicGeneration(g:any) {
  const publicFailure = g.error_code || g.error_message
    ? publicGenerationError({code:g.error_code,message:g.error_message}, 'A geração não pôde ser concluída.')
    : null;
  return {
    generation_id:g.generation_id,
    user_id:g.user_id,
    status:g.status,
    model_id:g.model_id,
    mode:g.mode,
    original_prompt:g.original_prompt,
    compiled_prompt:g.compiled_prompt,
    prompt_compiler_version:g.prompt_compiler_version,
    negative_prompt:g.negative_prompt,
    duration_seconds:g.duration_seconds,
    resolution:g.resolution,
    aspect_ratio:g.aspect_ratio,
    number_of_outputs:g.number_of_outputs,
    seed:g.seed,
    motion_strength:g.motion_strength,
    audio_enabled:g.audio_enabled,
    model_variant:g.model_variant,
    references:g.references,
    retail_credit_price:g.retail_credit_price,
    final_credit_cost:g.final_credit_cost,
    client_request_id:g.client_request_id,
    progress_percent:g.progress_percent,
    result_asset_id:g.result_asset_id,
    result_asset_ids:g.result_asset_ids,
    result_url:g.result_url,
    result_urls:g.result_urls,
    thumbnail_url:g.thumbnail_url,
    error_code:publicFailure?.code ?? null,
    error_message:publicFailure?.message ?? null,
    attempt_count:g.attempt_count,
    references_count:g.references_count,
    created_at:g.created_at,
    submitted_at:g.submitted_at,
    completed_at:g.completed_at,
    failed_at:g.failed_at,
  };
}

function publicGenerationError(err:any, fallback:string) {
  const code = String(err?.code || 'GENERATION_ERROR');
  if (code === 'CREDIT_INSUFFICIENT_FUNDS') {
    return { code, message:'Créditos insuficientes para esta geração.', missing_credits:err?.missing_credits };
  }
  if (code === 'PRICE_CHANGED_REQUOTE_REQUIRED') {
    return { code, message:'O preço desta configuração foi atualizado. Revise o valor e tente novamente.' };
  }
  if (['NO_SAFE_PROVIDER_AVAILABLE','COGS_BUDGET_EXHAUSTED','PROVIDER_NOT_CONFIGURED','LIVE_QUOTE_UNAVAILABLE','LIVE_QUOTE_INVALID'].includes(code)) {
    return { code:'GENERATION_TEMPORARILY_UNAVAILABLE', message:'Esta configuração está temporariamente indisponível. Tente outra configuração ou modelo.' };
  }
  if (code === 'REFERENCE_NOT_FOUND') return { code, message:'Uma das referências não está mais disponível.' };
  if (code === 'REFERENCE_NOT_READY') return { code, message:'Uma das referências ainda está sendo processada.' };
  if (code === 'REFERENCE_REQUIRED') return { code, message:'Adicione a referência necessária para esta geração.' };
  if (code === 'VALIDATION_ERROR') return { code, message:String(err?.message || fallback) };
  return { code, message:fallback };
}

generationRouter.post('/generations/quote', requireAuth, async (req:AuthenticatedRequest, res) => {
  try {
    await billingControlService.assertNewGenerationAllowed();

    const uid = req.user!.uid;
    const mode = String(req.body.mode || 'TEXT_TO_VIDEO') as GenerationMode;
    const settings = req.body.settings || {};
    const prompt = String(req.body.prompt || '').trim();
    if (!req.body.model_id || !prompt) {
      return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'Modelo e prompt são obrigatórios.'}});
    }

    const model = await catalogRepository.getModel(String(req.body.model_id));
    if (!model || model.status === 'INACTIVE') {
      return res.status(400).json({success:false,error:{code:'MODEL_NOT_FOUND',message:'Modelo indisponível.'}});
    }

    const imageMode = mode === 'TEXT_TO_IMAGE' || mode === 'IMAGE_TO_IMAGE';
    const duration = imageMode ? 1 : Math.max(1, Number(settings.duration_seconds || 5));
    const resolution = String(settings.resolution || (imageMode ? '1K' : '720p'));
    const aspectRatio = String(settings.aspect_ratio || '16:9');
    const outputs = Math.max(1, Math.min(4, Number(settings.number_of_outputs || 1)));
    const references = req.body.references || [];

    const q = await creditPricingService.preview({
      userId:uid,
      model_id:model.model_id,
      mode,
      prompt,
      negative_prompt:req.body.negative_prompt,
      duration_seconds:duration,
      resolution,
      aspect_ratio:aspectRatio,
      number_of_outputs:outputs,
      seed:settings.seed,
      motion_strength:settings.motion_strength,
      references,
      audio_enabled:settings.audio_enabled === undefined ? undefined : Boolean(settings.audio_enabled),
      model_variant:settings.model_variant,
      pricing_options:settings.pricing_options,
    });

    const compiled = promptCompilerService.compile({
      original_prompt:prompt,
      references,
      negative_prompt:req.body.negative_prompt,
      generation_settings:{
        model_id:model.model_id,
        mode,
        duration_seconds:duration,
        resolution,
        aspect_ratio:aspectRatio,
      },
    });

    const price = q.retail.retail_credit_price;
    const available = q.account.available_credits;
    const retail:any = q.retail;

    return res.json({
      success:true,
      data:{
        request_draft:{
          request_id:`quote_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          user_id:uid,
          model_id:model.model_id,
          model_name:model.name,
          mode,
          prompt,
          compiled_prompt:compiled.compiled_prompt,
          prompt_compiler_version:compiled.prompt_compiler_version,
          negative_prompt:req.body.negative_prompt,
          references,
          settings:{
            duration_seconds:duration,
            resolution,
            aspect_ratio:aspectRatio,
            number_of_outputs:outputs,
            seed:settings.seed ?? null,
            motion_strength:settings.motion_strength,
            audio_enabled:q.signature.audio_enabled,
            model_variant:q.signature.model_variant,
            pricing_options:q.signature.pricing_options,
          },
          has_pricing:true,
          retail_credit_price:price,
          unit_credit_price:retail.unit_credit_price,
          pricing_unit:retail.pricing_unit,
          base_duration_seconds:retail.base_duration_seconds,
          billing_units:retail.billing_units,
          authorized_credit_price:price,
          credit_balance_available:available,
          balance_after_generation_credits:available-price,
          has_sufficient_funds:available>=price,
          pricing_signature_hash:q.signature.hash,
          retail_pricing_id:q.retail.retail_pricing_id,
          retail_pricing_version:q.retail.version,
          estimated_cost_cents:price,
          customer_balance_available_cents:available,
          balance_after_generation_cents:available-price,
          created_at:new Date().toISOString(),
        },
        notice:`Preço confirmado: ${price.toLocaleString('pt-BR')} créditos.`,
      },
    });
  } catch (err:any) {
    const error = publicGenerationError(err, 'Não foi possível confirmar o preço desta configuração.');
    const status = err?.code === 'CREDIT_INSUFFICIENT_FUNDS' ? 402 : err?.code === 'NO_SAFE_PROVIDER_AVAILABLE' ? 503 : 400;
    return res.status(status).json({success:false,error});
  }
});

generationRouter.post('/generations', requireAuth, async (req:AuthenticatedRequest, res) => {
  try {
    await billingControlService.assertNewGenerationAllowed();
    const uid = req.user!.uid;
    const host = req.get('host') || process.env.APP_URL;
    const authorization = String(req.headers.authorization || '');
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined;

    const g = await generationService.createAndStartGeneration({
      userId:uid,
      model_id:req.body.model_id,
      mode:req.body.mode,
      prompt:req.body.prompt,
      negative_prompt:req.body.negative_prompt,
      duration_seconds:Number(req.body.duration_seconds || 1),
      resolution:req.body.resolution || '1K',
      aspect_ratio:req.body.aspect_ratio || '1:1',
      number_of_outputs:Number(req.body.number_of_outputs || 1),
      seed:req.body.seed,
      motion_strength:req.body.motion_strength,
      audio_enabled:req.body.audio_enabled === undefined ? undefined : Boolean(req.body.audio_enabled),
      model_variant:req.body.model_variant,
      pricing_options:req.body.pricing_options,
      references:req.body.references || [],
      requested_provider_id:req.body.requested_provider_id,
      client_request_id:req.body.client_request_id,
      authorized_credit_price:Number.isFinite(Number(req.body.authorized_credit_price))
        ? Number(req.body.authorized_credit_price)
        : Number.isFinite(Number(req.body.maximum_authorized_cost_cents))
          ? Number(req.body.maximum_authorized_cost_cents)
          : undefined,
      retail_pricing_id:req.body.retail_pricing_id,
      pricing_signature_hash:req.body.pricing_signature_hash,
      reqHost:host,
      idToken,
    });

    return res.json({success:true,data:publicGeneration(g)});
  } catch (err:any) {
    const error = publicGenerationError(err, 'Não foi possível iniciar a geração.');
    const status = err?.code === 'CREDIT_INSUFFICIENT_FUNDS'
      ? 402
      : err?.code === 'PRICE_CHANGED_REQUOTE_REQUIRED'
        ? 409
        : err?.code === 'NO_SAFE_PROVIDER_AVAILABLE'
          ? 503
          : 400;
    return res.status(status).json({success:false,error});
  }
});

generationRouter.get('/generations', requireAuth, async (req:AuthenticatedRequest, res) => {
  try {
    const rows = await generationService.listUserGenerations(
      req.user!.uid,
      Math.min(100, Math.max(1, Number(req.query.limit || 50))),
    );
    return res.json({success:true,data:rows.map(publicGeneration)});
  } catch {
    return res.status(500).json({success:false,error:{code:'GENERATION_LIST_ERROR',message:'Não foi possível carregar as gerações.'}});
  }
});

generationRouter.get('/generations/:generationId', requireAuth, async (req:AuthenticatedRequest, res) => {
  try {
    const generation = await generationService.getGeneration(req.params.generationId, req.user!.uid);
    if (!generation) {
      return res.status(404).json({success:false,error:{code:'GENERATION_NOT_FOUND',message:'Geração não encontrada.'}});
    }
    return res.json({success:true,data:publicGeneration(generation)});
  } catch {
    return res.status(500).json({success:false,error:{code:'GENERATION_GET_ERROR',message:'Não foi possível carregar a geração.'}});
  }
});

generationRouter.post('/generations/:generationId/cancel', requireAuth, async (req:AuthenticatedRequest, res) => {
  try {
    const generation = await generationService.cancelGeneration(req.params.generationId, req.user!.uid);
    return res.json({success:true,data:publicGeneration(generation)});
  } catch (err:any) {
    const providerLocked = /não permite cancelar|processamento/i.test(String(err?.message || ''));
    return res.status(providerLocked ? 409 : 400).json({
      success:false,
      error:{
        code:providerLocked ? 'GENERATION_CANCEL_UNAVAILABLE' : 'GENERATION_CANCEL_ERROR',
        message:providerLocked ? 'Esta geração já está em processamento e não pode mais ser cancelada.' : 'Não foi possível cancelar esta geração.',
      },
    });
  }
});
