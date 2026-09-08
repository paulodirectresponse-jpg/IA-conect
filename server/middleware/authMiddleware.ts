import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { userRepository } from '../repositories/userRepository.js';
import { getAdminApp } from '../repositories/firebaseAdminClient.js';
import { UserProfile } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; email: string; name?: string };
  userProfile?: UserProfile;
}

/** Production authentication is fail-closed: Firebase Admin must cryptographically
 * verify the ID token. Unverified JWT payload decoding is intentionally forbidden. */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Autenticação necessária.' } });
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token, true);
    if (!decoded.uid) throw new Error('Token sem UID');

    req.user = { uid: decoded.uid, email: decoded.email || '', name: decoded.name || '' };
    const profile = await userRepository.getById(decoded.uid);
    if (!profile) {
      return res.status(403).json({ success: false, error: { code: 'PROFILE_REQUIRED', message: 'Perfil da conta não encontrado.' } });
    }
    if (profile.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: { code: 'USER_SUSPENDED', message: 'Sua conta está suspensa.' } });
    }
    req.userProfile = profile;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_SESSION_INVALID', message: 'Sessão inválida ou expirada. Faça login novamente.' } });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userProfile || req.userProfile.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_PERMISSION_REQUIRED', message: 'Acesso administrativo necessário.' } });
  }
  next();
}
