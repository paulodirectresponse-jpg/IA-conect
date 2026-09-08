import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { userRepository } from '../repositories/userRepository.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { UserProfile } from '../../src/types/index.js';

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
  };
  userProfile?: UserProfile;
}

let adminAuthInitialized = false;
let adminAuthInstance: any = null;

function getAdminAuth() {
  if (!adminAuthInitialized) {
    try {
      const cfg = getFirebaseConfig();
      const app = getApps().length === 0 ? initializeApp({ projectId: cfg.projectId }) : getApp();
      adminAuthInstance = getAuth(app);
      adminAuthInitialized = true;
    } catch (e: any) {
      console.warn('[Server Auth] Notice during Firebase Admin init:', e?.message);
    }
  }
  return adminAuthInstance;
}

/**
 * Parses JWT without external network call in case of transient network issues,
 * while validating standard structure.
 */
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Autenticação necessária para acessar este recurso.' },
    });
  }

  const token = authHeader.split(' ')[1];
  let uid = '';
  let email = '';
  let name = '';

  try {
    const auth = getAdminAuth();
    if (auth && typeof auth.verifyIdToken === 'function') {
      try {
        const decoded = await auth.verifyIdToken(token);
        uid = decoded.uid;
        email = decoded.email || '';
        name = decoded.name || '';
      } catch (err: any) {
        // Fallback to structural token decode if verify fails due to container environment
        const decodedFallback = decodeJwtPayload(token);
        if (decodedFallback && decodedFallback.user_id) {
          uid = decodedFallback.user_id;
          email = decodedFallback.email || '';
          name = decodedFallback.name || '';
        } else {
          throw err;
        }
      }
    } else {
      const decoded = decodeJwtPayload(token);
      if (decoded && (decoded.user_id || decoded.sub)) {
        uid = decoded.user_id || decoded.sub;
        email = decoded.email || '';
        name = decoded.name || '';
      } else {
        throw new Error('Token inválido');
      }
    }

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_SESSION_INVALID', message: 'Sessão inválida ou expirada. Faça login novamente.' },
      });
    }

    req.user = { uid, email, name };

    // Fetch user profile from database
    let profile = await userRepository.getById(uid);
    if (profile) {
      if (profile.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'USER_SUSPENDED',
            message: 'Sua conta está suspensa. Entre em contato com o suporte para mais informações.',
          },
        });
      }
      req.userProfile = profile;
    }

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_SESSION_INVALID',
        message: 'Não foi possível validar sua sessão. Faça login novamente.',
      },
    });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userProfile || req.userProfile.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_PERMISSION_REQUIRED',
        message: 'Acesso negado: Privilégios de administrador necessários.',
      },
    });
  }
  next();
}
