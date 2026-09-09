import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { firestoreRestCall, getFirebaseConfig } from '../repositories/firestoreClient.js';
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

function unwrapFirestoreValue(value:any):any {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(unwrapFirestoreValue);
  if ('mapValue' in value) return unwrapFirestoreFields(value.mapValue?.fields || {});
  return undefined;
}

function unwrapFirestoreFields(fields:any):any {
  const result:Record<string,any> = {};
  for (const [key,value] of Object.entries(fields || {})) result[key] = unwrapFirestoreValue(value);
  return result;
}

async function getProfileWithUserToken(uid:string, idToken:string):Promise<UserProfile|null> {
  try {
    const doc = await firestoreRestCall(`users/${encodeURIComponent(uid)}`, 'GET', undefined, idToken);
    const data = unwrapFirestoreFields(doc?.fields || {});
    if (!data?.user_id) data.user_id = uid;
    return data as UserProfile;
  } catch (err:any) {
    console.warn('[Auth] Firestore REST profile lookup unavailable:', err?.message || err);
    return null;
  }
}

/**
 * Cloudflare-safe Firebase authentication.
 * Identity Toolkit validates the Firebase ID token, while the profile is loaded
 * with the same user token through Firestore REST. This avoids firebase-admin/
 * gRPC limitations inside Workers and keeps role checks server-side.
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

    // Primary path for Workers: profile lookup authorized by the user's own ID token.
    let profile = await getProfileWithUserToken(decoded.uid, token);

    // Fallback for runtimes where firebase-admin is available.
    if (!profile) {
      try { profile = await userRepository.getById(decoded.uid); }
      catch (profileErr:any) { console.warn('[Auth] Admin profile fallback unavailable:', profileErr?.message || profileErr); }
    }

    if (profile) {
      if (profile.status === 'SUSPENDED') {
        return res.status(403).json({ success: false, error: { code: 'USER_SUSPENDED', message: 'Sua conta está suspensa.' } });
      }
      req.userProfile = profile;
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
