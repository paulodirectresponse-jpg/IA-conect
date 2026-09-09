import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { UserProfile, WalletAccount } from '../types/index.js';

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

    // Keep the Firebase session alive if backend profile synchronization fails.
    // AuthContext can surface/retry the synchronization error without bouncing the
    // user back to login and destroying an otherwise valid Firebase session.
    const token = await cred.user.getIdToken();
    return apiRequest<{ user: UserProfile; wallet: WalletAccount }>('/api/auth/register-profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        display_name: displayName,
      }),
    });
  },

  async login(email: string, pass: string): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const token = await cred.user.getIdToken();
    return apiRequest<{ user: UserProfile; wallet: WalletAccount }>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async getMe(): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    return apiRequest<{ user: UserProfile; wallet: WalletAccount }>('/api/auth/me');
  },

  async claimBootstrapAdmin(bootstrapSecret?: string): Promise<{ user: UserProfile; message: string }> {
    return apiRequest<{ user: UserProfile; message: string }>('/api/admin/bootstrap', {
      method: 'POST',
      body: bootstrapSecret ? JSON.stringify({ bootstrap_secret: bootstrapSecret }) : undefined,
    });
  },
};
