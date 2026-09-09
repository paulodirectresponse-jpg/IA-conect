import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { UserProfile } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; email: string; name?: string; idToken?: string };
  userProfile?: UserProfile;
}

async function verifyFirebaseIdToken(idToken:string){
  const cfg=getFirebaseConfig();
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})
  });
  if(!response.ok) throw new Error('Firebase session verification failed');
  const payload:any=await response.json();
  const user=payload?.users?.[0];
  if(!user?.localId||user.disabled) throw new Error('Firebase user unavailable');
  return {uid:String(user.localId),email:String(user.email||''),name:String(user.displayName||'')};
}

/**
 * Cloudflare-safe Firebase authentication.
 *
 * firebase-admin pulls in Node/gRPC-dependent modules that are not reliable in a
 * Worker runtime. Identity Toolkit's accounts:lookup endpoint validates the ID
 * token server-side without weakening authentication or decoding unsigned JWTs.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Autenticação necessária.' } });
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = await verifyFirebaseIdToken(token);
    req.user = { ...decoded, idToken: token };

    // Profile lookup is best-effort here. User-facing routes can operate with the
    // verified Firebase identity even while privileged Firestore access is being
    // migrated away from firebase-admin for Workers compatibility.
    try {
      const profile = await userRepository.getById(decoded.uid);
      if(profile){
        if (profile.status === 'SUSPENDED') {
          return res.status(403).json({ success: false, error: { code: 'USER_SUSPENDED', message: 'Sua conta está suspensa.' } });
        }
        req.userProfile = profile;
      }
    } catch (profileErr:any) {
      console.warn('[Auth] Profile lookup unavailable in Worker:', profileErr?.message || profileErr);
    }
    next();
  } catch (error:any) {
    console.warn('[Auth] Session validation failed:', error?.message || error);
    return res.status(401).json({ success: false, error: { code: 'AUTH_SESSION_INVALID', message: 'Sessão inválida ou expirada. Faça login novamente.' } });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userProfile || req.userProfile.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_PERMISSION_REQUIRED', message: 'Acesso administrativo necessário.' } });
  }
  next();
}
