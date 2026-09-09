import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationService } from '../services/generationService.js';
import { smartRouterService } from '../services/smartRouterService.js';
import { walletService } from '../services/walletService.js';

export const generationRuntimeRouter = Router();

generationRuntimeRouter.post('/pricing/quote', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const mode = req.body.mode;
    const settings = req.body.settings || {};
    const decision = await smartRouterService.selectProvider({
      userId: uid,
      model_id: req.body.model_id,
      mode,
      prompt: req.body.prompt,
      negative_prompt: req.body.negative_prompt,
      duration_seconds: Number(settings.duration_seconds || 1),
      resolution: settings.resolution || '720p',
      aspect_ratio: settings.aspect_ratio || '16:9',
      number_of_outputs: Number(settings.number_of_outputs || 1),
      seed: settings.seed,
      motion_strength: settings.motion_strength,
    });
    const wallet = await walletService.getSummary(uid);
    const price = decision.selected.customer_price_cents;
    const requestId = `quote_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    res.json({
      success:true,
      data:{
        request_draft:{
          request_id:requestId,user_id:uid,model_id:req.body.model_id,mode,prompt:String(req.body.prompt||'').trim(),
          negative_prompt:req.body.negative_prompt,references:req.body.references||[],settings,
          has_pricing:true,estimated_cost_cents:price,customer_balance_available_cents:wallet.available_balance_cents,
          balance_after_generation_cents:wallet.available_balance_cents-price,has_sufficient_funds:wallet.available_balance_cents>=price,
          provider_id:decision.selected.provider_id,provider_cost_brl_cents:decision.selected.provider_cost_cents,
          safe_cost_brl_cents:decision.selected.safe_cost_cents,margin_percent:decision.selected.margin_percent,
          pricing_quoted_at:decision.selected.quoted_at,quote_estimated:decision.selected.quote_estimated,
          created_at:new Date().toISOString(),
        },
        notice:`Preço protegido por cotação ao vivo. Margem operacional: ${decision.selected.margin_percent.toFixed(1)}%.`,
      },
    });
  } catch (err:any) {
    res.status(400).json({success:false,error:{code:err?.code||'PRICING_QUOTE_ERROR',message:err?.message||'Não foi possível obter uma cotação segura.'}});
  }
});

generationRuntimeRouter.post('/generations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const host = req.get('host') || process.env.APP_URL;
    const authorization = String(req.headers.authorization || '');
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined;

    const generation = await generationService.createAndStartGeneration({
      userId: uid,
      model_id: req.body.model_id,
      mode: req.body.mode,
      prompt: req.body.prompt,
      negative_prompt: req.body.negative_prompt,
      duration_seconds: Number(req.body.duration_seconds || 1),
      resolution: req.body.resolution || '1K',
      aspect_ratio: req.body.aspect_ratio || '1:1',
      number_of_outputs: Number(req.body.number_of_outputs || 1),
      seed: req.body.seed,
      motion_strength: req.body.motion_strength,
      references: req.body.references || [],
      requested_provider_id: req.body.requested_provider_id,
      client_request_id: req.body.client_request_id,
      maximum_authorized_cost_cents: Number.isFinite(Number(req.body.maximum_authorized_cost_cents)) ? Number(req.body.maximum_authorized_cost_cents) : undefined,
      reqHost: host,
      idToken,
    });

    res.json({ success: true, data: generation });
  } catch (err: any) {
    const status = err?.code === 'WALLET_INSUFFICIENT_FUNDS' ? 402 : err?.code === 'PRICE_CHANGED_REQUOTE_REQUIRED' ? 409 : 400;
    res.status(status).json({
      success: false,
      error: {
        code: err?.code || 'GENERATION_ERROR',
        message: err?.message || 'Não foi possível iniciar a geração.',
      },
    });
  }
});
