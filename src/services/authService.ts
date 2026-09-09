import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { UserProfile, WalletAccount } from '../types/index.js';

function emptyWallet(userId: string): WalletAccount {
  return {
    account_id: userId,
    user_id: userId,
    currency: 'BRL',
    available_balance_cents: 0,
    reserved_balance_cents: 0,
    total_balance_cents: 0,
    total_deposited_cents: 0,
    total_used_cents: 0,
    updated_at: new Date().toISOString(),
  } as WalletAccount;
}

async function syncClientProfile(user: FirebaseUser, preferredDisplayName?: string): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();

  if (snap.exists()) {
    const current = snap.data() as UserProfile;
    const patch: Partial<UserProfile> = {
      last_login_at: now,
      updated_at: now,
    };
    const displayName = preferredDisplayName || user.displayName || current.display_name;
    if (displayName && displayName !== current.display_name) patch.display_name = displayName;
    await setDoc(ref, patch, { merge: true });
    return { ...current, ...patch } as UserProfile;
  }

  // Client bootstrap is intentionally conservative. Security Rules only permit
  // a newly authenticated user to create their own ACTIVE/USER profile. Admin
  // promotion remains a separate privileged backend operation.
  const profile: UserProfile = {
    user_id: user.uid,
    email: (user.email || '').toLowerCase().trim(),
    display_name: preferredDisplayName || user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
    avatar_url: user.photoURL || '',
    role: 'USER',
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  } as UserProfile;
  await setDoc(ref, profile);
  return profile;
}

async function readWallet(userId: string): Promise<WalletAccount> {
  try {
    const snap = await getDoc(doc(db, 'wallet_accounts', userId));
    return snap.exists() ? (snap.data() as WalletAccount) : emptyWallet(userId);
  } catch (err) {
    console.warn('[AuthService] Wallet read unavailable, using zero-balance view:', err);
    return emptyWallet(userId);
  }
}

async function localSessionSnapshot(user: FirebaseUser, displayName?: string) {
  const profile = await syncClientProfile(user, displayName);
  const wallet = await readWallet(user.uid);
  return { user: profile, wallet };
}

export const authService = {
  async register(email: string, pass: string, displayName: string): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch (e) {
        console.warn('Profile name update skipped:', e);
      }
    }
    return localSessionSnapshot(cred.user, displayName);
  },

  async login(email: string, pass: string): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return localSessionSnapshot(cred.user);
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async getMe(): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    if (!auth.currentUser) throw new Error('Usuário não autenticado.');
    return localSessionSnapshot(auth.currentUser);
  },

  async claimBootstrapAdmin(bootstrapSecret?: string): Promise<{ user: UserProfile; message: string }> {
    return apiRequest<{ user: UserProfile; message: string }>('/api/admin/bootstrap', {
      method: 'POST',
      body: bootstrapSecret ? JSON.stringify({ bootstrap_secret: bootstrapSecret }) : undefined,
    });
  },
};
