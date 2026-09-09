import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generationService } from '../services/generationService.js';

export const generationRuntimeRouter = Router();

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
      reqHost: host,
      idToken,
    });

    res.json({ success: true, data: generation });
  } catch (err: any) {
    const status = err?.code === 'WALLET_INSUFFICIENT_FUNDS' ? 402 : 400;
    res.status(status).json({
      success: false,
      error: {
        code: err?.code || 'GENERATION_ERROR',
        message: err?.message || 'Não foi possível iniciar a geração.',
      },
    });
  }
});
