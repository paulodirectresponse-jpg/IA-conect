import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { UserProfile, WalletAccount } from '../types/index.js';

type SessionSnapshot={user:UserProfile;wallet:WalletAccount};

async function syncSession(displayName?:string):Promise<SessionSnapshot>{
  if(!auth.currentUser)throw new Error('Usuário não autenticado.');
  return apiRequest<SessionSnapshot>('/api/auth/register-profile',{
    method:'POST',
    body:JSON.stringify({
      display_name:displayName||auth.currentUser.displayName||undefined,
      avatar_url:auth.currentUser.photoURL||undefined,
    }),
  });
}

export const authService={
  async register(email:string,pass:string,displayName:string):Promise<SessionSnapshot>{
    const cred=await createUserWithEmailAndPassword(auth,email,pass);
    if(displayName){
      try{await updateProfile(cred.user,{displayName});}
      catch(e){console.warn('Profile name update skipped:',e);}
    }
    return syncSession(displayName);
  },

  async login(email:string,pass:string):Promise<SessionSnapshot>{
    await signInWithEmailAndPassword(auth,email,pass);
    return apiRequest<SessionSnapshot>('/api/auth/me');
  },

  async logout(){await signOut(auth);},
  async resetPassword(email:string){await sendPasswordResetEmail(auth,email);},

  async getMe():Promise<SessionSnapshot>{
    if(!auth.currentUser)throw new Error('Usuário não autenticado.');
    return apiRequest<SessionSnapshot>('/api/auth/me');
  },

  async claimBootstrapAdmin(bootstrapSecret?:string):Promise<{user:UserProfile;message:string}>{
    return apiRequest('/api/admin/bootstrap',{method:'POST',body:bootstrapSecret?JSON.stringify({bootstrap_secret:bootstrapSecret}):undefined});
  },
};
