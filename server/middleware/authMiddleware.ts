import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { userRepository } from '../repositories/userRepository.js';
import { getAdminApp } from '../repositories/firebaseAdminClient.js';
import { UserProfile } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; email: string; name?: string };
  userProfile?: UserProfile;
}

/**
 * Production authentication is fail-closed: Firebase Admin must cryptographically
 * verify the ID token. A missing Firestore profile is NOT an authentication failure:
 * /auth/me and /auth/register-profile are responsible for creating/syncing it on the
 * first authenticated request.
 */
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

    // Existing profiles are loaded for suspension/admin checks. Missing profiles are
    // allowed through so the auth endpoints can create them deterministically.
    const profile = await userRepository.getById(decoded.uid);
    if (profile?.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: { code: 'USER_SUSPENDED', message: 'Sua conta está suspensa.' } });
    }
    if (profile) req.userProfile = profile;

    next();
  } catch (error) {
    console.warn('[Auth] Token verification/profile lookup failed:', (error as any)?.message || error);
    return res.status(401).json({ success: false, error: { code: 'AUTH_SESSION_INVALID', message: 'Sessão inválida ou expirada. Faça login novamente.' } });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userProfile || req.userProfile.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_PERMISSION_REQUIRED', message: 'Acesso administrativo necessário.' } });
  }
  next();
}
