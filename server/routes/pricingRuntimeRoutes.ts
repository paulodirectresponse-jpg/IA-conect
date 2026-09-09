import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { smartRouterService } from '../services/smartRouterService.js';
import { walletService } from '../services/walletService.js';
import { GenerationMode } from '../../src/types/index.js';

export const pricingRuntimeRouter = Router();

pricingRuntimeRouter.post('/workspace/validate-and-preview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { model_id, mode, prompt, negative_prompt, references, settings } = req.body || {};
    if (!model_id || !prompt?.trim()) {
      return res.status(400).json({ success:false, error:{ code:'VALIDATION_ERROR', message:'Modelo e prompt são obrigatórios.' } });
    }

    const generationMode = String(mode || 'TEXT_TO_VIDEO') as GenerationMode;
    const imageMode = generationMode === 'TEXT_TO_IMAGE' || generationMode === 'IMAGE_TO_IMAGE';
    const duration = imageMode ? 1 : Math.max(1, Number(settings?.duration_seconds || 5));
    const resolution = String(settings?.resolution || (imageMode ? '1K' : '720p'));
    const aspectRatio = String(settings?.aspect_ratio || '16:9');
    const outputs = Math.max(1, Math.min(4, Number(settings?.number_of_outputs || 1)));

    const decision = await smartRouterService.selectProvider({
      userId: uid,
      model_id,
      mode: generationMode,
      duration_seconds: duration,
      resolution,
      aspect_ratio: aspectRatio,
      number_of_outputs: outputs,
      prompt: String(prompt).trim(),
      negative_prompt,
      seed: settings?.seed,
      motion_strength: settings?.motion_strength,
    });

    const price = decision.selected.customer_price_cents;
    const wallet = await walletService.getSummary(uid);
    const available = wallet.available_balance_cents;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    return res.json({
      success:true,
      data:{
        request_draft:{
          request_id: requestId,
          user_id: uid,
          model_id,
          mode: generationMode,
          prompt: String(prompt).trim(),
          negative_prompt,
          references: references || [],
          settings:{
            duration_seconds: duration,
            resolution,
            aspect_ratio: aspectRatio,
            number_of_outputs: outputs,
            seed: settings?.seed ?? null,
            motion_strength: settings?.motion_strength,
          },
          has_pricing:true,
          estimated_cost_cents:price,
          customer_balance_available_cents:available,
          balance_after_generation_cents:available-price,
          has_sufficient_funds:available>=price,
          pricing_snapshot:{
            provider_id:decision.selected.provider_id,
            provider_cost_usd:decision.selected.provider_cost_usd,
            provider_cost_brl_cents:decision.selected.provider_cost_cents,
            safe_cost_brl_cents:decision.selected.safe_cost_cents,
            customer_price_cents:decision.selected.customer_price_cents,
            margin_percent:decision.selected.margin_percent,
            quoted_at:decision.selected.quoted_at,
            quote_estimated:decision.selected.quote_estimated,
          },
          created_at:new Date().toISOString(),
        },
        notice:'Preço confirmado ao vivo com margem protegida antes da geração.',
      },
    });
  } catch (err:any) {
    const code=err?.code || 'LIVE_PRICING_FAILED';
    const status=code==='NO_SAFE_PROVIDER_AVAILABLE' ? 503 : 400;
    return res.status(status).json({ success:false, error:{ code, message:err?.message || 'Não foi possível confirmar um preço seguro.' } });
  }
});
