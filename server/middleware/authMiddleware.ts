import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';
import { UserProfile } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?:{uid:string;email:string;name?:string;idToken?:string};
  userProfile?:UserProfile;
}

async function verifyFirebaseIdToken(idToken:string){
  const cfg=getFirebaseConfig();
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({idToken}),
  });
  if(!response.ok)throw new Error('Firebase session verification failed');
  const payload:any=await response.json();
  const user=payload?.users?.[0];
  if(!user?.localId||user.disabled)throw new Error('Firebase user unavailable');
  return{uid:String(user.localId),email:String(user.email||''),name:String(user.displayName||'')};
}

export async function requireAuth(req:AuthenticatedRequest,res:Response,next:NextFunction){
  const authHeader=req.headers.authorization;
  if(!authHeader?.startsWith('Bearer ')){
    return res.status(401).json({success:false,error:{code:'AUTH_REQUIRED',message:'Autenticação necessária.'}});
  }

  const token=authHeader.slice('Bearer '.length).trim();
  let decoded:{uid:string;email:string;name?:string};
  try{
    decoded=await verifyFirebaseIdToken(token);
  }catch(error:any){
    console.warn('[Auth] Firebase session validation failed:',error?.message||error);
    return res.status(401).json({success:false,error:{code:'AUTH_SESSION_INVALID',message:'Sessão inválida ou expirada. Faça login novamente.'}});
  }

  req.user={...decoded,idToken:token};

  try{
    const profile=await userRepository.getById(decoded.uid);
    if(profile?.status==='SUSPENDED'){
      return res.status(403).json({success:false,error:{code:'USER_SUSPENDED',message:'Sua conta está suspensa.'}});
    }
    if(profile)req.userProfile=profile;
  }catch(error:any){
    console.error('[Auth] Account datastore unavailable:',error?.message||error);
    return res.status(503).json({
      success:false,
      error:{
        code:'AUTH_BACKEND_UNAVAILABLE',
        message:'A sessão está válida, mas os dados da conta estão temporariamente indisponíveis.',
      },
    });
  }

  next();
}

export function requireAdmin(req:AuthenticatedRequest,res:Response,next:NextFunction){
  if(!req.userProfile||req.userProfile.role!=='ADMIN'){
    return res.status(403).json({success:false,error:{code:'ADMIN_PERMISSION_REQUIRED',message:'Acesso administrativo necessário.'}});
  }
  next();
}
