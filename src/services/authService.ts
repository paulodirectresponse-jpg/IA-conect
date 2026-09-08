import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { apiRequest } from './apiClient.js';
import { UserProfile, WalletAccount } from '../types/index.js';

export const authService = {
  async register(email: string, pass: string, displayName: string): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    // Call server to establish user profile and zero-balance wallet
    const res = await apiRequest<{ user: UserProfile; wallet: WalletAccount }>('/api/auth/register-profile', {
      method: 'POST',
      body: JSON.stringify({
        display_name: displayName,
      }),
    });

    return res;
  },

  async login(email: string, pass: string): Promise<{ user: UserProfile; wallet: WalletAccount }> {
    await signInWithEmailAndPassword(auth, email, pass);
    const res = await apiRequest<{ user: UserProfile; wallet: WalletAccount }>('/api/auth/me');
    return res;
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

  async claimBootstrapAdmin(): Promise<{ user: UserProfile; message: string }> {
    return apiRequest<{ user: UserProfile; message: string }>('/api/admin/bootstrap', {
      method: 'POST',
    });
  },
};
