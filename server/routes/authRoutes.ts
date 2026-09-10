import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { authService } from '../services/authService.js';
import { creditWalletService } from '../services/creditWalletService.js';

export const authRouter = Router();

authRouter.post('/auth/register-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || req.body.email;
    const displayName = req.body.display_name || req.user!.name;
    const avatarUrl = req.body.avatar_url;

    const result = await authService.registerOrSyncProfile({
      userId: uid,
      email,
      displayName,
      avatarUrl,
    });

    const wallet = await creditWalletService.getAccount(uid);

    res.json({
      success: true,
      data: {
        user: result.user,
        wallet,
        is_new: result.isNew,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: err.code || 'AUTH_PROFILE_ERROR', message: err.message || 'Falha ao registrar perfil.' },
    });
  }
});

authRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    let user = req.userProfile;
    if (!user) {
      const syncResult = await authService.registerOrSyncProfile({
        userId: uid,
        email: req.user!.email,
        displayName: req.user!.name,
      });
      user = syncResult.user;
    }

    const wallet = await creditWalletService.getAccount(uid);

    res.json({
      success: true,
      data: {
        user,
        wallet,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'AUTH_ME_ERROR', message: 'Erro ao carregar dados do usuário autenticado.' },
    });
  }
});

authRouter.post('/admin/bootstrap', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const bootstrapSecret = (req.body?.bootstrap_secret || req.headers['x-bootstrap-secret']) as string | undefined;
    const updated = await authService.bootstrapFirstAdmin(uid, bootstrapSecret);
    res.json({
      success: true,
      data: {
        user: updated,
        message: 'Bootstrap concluído: você agora é Administrador da plataforma.',
      },
    });
  } catch (err: any) {
    res.status(403).json({
      success: false,
      error: { code: err.code || 'BOOTSTRAP_FORBIDDEN', message: err.message || 'Bootstrap não permitido.' },
    });
  }
});
