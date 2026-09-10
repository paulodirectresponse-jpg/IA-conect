import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { walletService } from './walletService.js';
import { UserProfile, WalletAccount } from '../types/index.js';

async function syncClientProfile(user:FirebaseUser,preferredDisplayName?:string):Promise<UserProfile>{const ref=doc(db,'users',user.uid),snap=await getDoc(ref),now=new Date().toISOString();if(snap.exists()){const current=snap.data()as UserProfile,patch:Partial<UserProfile>={last_login_at:now,updated_at:now},displayName=preferredDisplayName||user.displayName||current.display_name;if(displayName&&displayName!==current.display_name)patch.display_name=displayName;await setDoc(ref,patch,{merge:true});return{...current,...patch}as UserProfile;}const profile:UserProfile={user_id:user.uid,email:(user.email||'').toLowerCase().trim(),display_name:preferredDisplayName||user.displayName||(user.email?user.email.split('@')[0]:'Usuário'),avatar_url:user.photoURL||'',role:'USER',status:'ACTIVE',created_at:now,updated_at:now,last_login_at:now};await setDoc(ref,profile);return profile;}
async function localSessionSnapshot(user:FirebaseUser,displayName?:string){const profile=await syncClientProfile(user,displayName),wallet=await walletService.getSummary();return{user:profile,wallet};}
export const authService={
 async register(email:string,pass:string,displayName:string):Promise<{user:UserProfile;wallet:WalletAccount}>{const cred=await createUserWithEmailAndPassword(auth,email,pass);if(displayName){try{await updateProfile(cred.user,{displayName});}catch(e){console.warn('Profile name update skipped:',e);}}return localSessionSnapshot(cred.user,displayName);},
 async login(email:string,pass:string):Promise<{user:UserProfile;wallet:WalletAccount}>{const cred=await signInWithEmailAndPassword(auth,email,pass);return localSessionSnapshot(cred.user);},
 async logout(){await signOut(auth);},
 async resetPassword(email:string){await sendPasswordResetEmail(auth,email);},
 async getMe():Promise<{user:UserProfile;wallet:WalletAccount}>{if(!auth.currentUser)throw new Error('Usuário não autenticado.');return localSessionSnapshot(auth.currentUser);},
 async claimBootstrapAdmin(bootstrapSecret?:string):Promise<{user:UserProfile;message:string}>{return apiRequest('/api/admin/bootstrap',{method:'POST',body:bootstrapSecret?JSON.stringify({bootstrap_secret:bootstrapSecret}):undefined});},
};
