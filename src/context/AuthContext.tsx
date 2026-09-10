import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { authService } from '../services/authService.js';
import { creditService } from '../services/creditService.js';
import { UserProfile } from '../types/index.js';
import { CreditAccount } from '../types/credits.js';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: FirebaseUser | null;
  profile: UserProfile | null;
  wallet: CreditAccount | null;
  isAdmin: boolean;
  isSuspended: boolean;
  loading: boolean;
  authError: string | null;
  refreshMe: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  claimBootstrapAdmin: (bootstrapSecret?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadUserData = async () => {
    try {
      setAuthError(null);
      const data = await authService.getMe();
      setProfile(data.user);
      setWallet(data.wallet);
    } catch (err: any) {
      console.warn('[AuthContext] Failed to load user profile/wallet:', err.message);
      setAuthError(err.message || 'Falha ao sincronizar perfil ou carteira.');
      if (err.code === 'USER_SUSPENDED' || (err.message && err.message.toLowerCase().includes('suspens'))) {
        setProfile((prev) => prev ? { ...prev, status: 'SUSPENDED' } : ({
          user_id: firebaseUser?.uid || '', email: firebaseUser?.email || '', display_name: firebaseUser?.displayName || '', role: 'USER', status: 'SUSPENDED', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        } as UserProfile));
      } else {
        setProfile(null);
        setWallet(null);
      }
    }
  };

  const refreshWallet = async () => {
    try { setWallet(await creditService.getAccount()); }
    catch (err) { console.warn('[AuthContext] Failed to refresh wallet:', err); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) await loadUserData();
      else { setProfile(null); setWallet(null); setAuthError(null); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onGenerationUpdated = () => { if (auth.currentUser) void refreshWallet(); };
    window.addEventListener('generation:updated', onGenerationUpdated);
    return () => window.removeEventListener('generation:updated', onGenerationUpdated);
  }, []);

  const refreshMe = async () => { if (auth.currentUser) await loadUserData(); };
  const claimBootstrapAdmin = async (bootstrapSecret?: string) => { await authService.claimBootstrapAdmin(bootstrapSecret); await loadUserData(); };
  const logout = async () => { await authService.logout(); setFirebaseUser(null); setProfile(null); setWallet(null); setAuthError(null); };
  const isAdmin = profile?.role === 'ADMIN';
  const isSuspended = profile?.status === 'SUSPENDED';

  return <AuthContext.Provider value={{firebaseUser,currentUser:firebaseUser,profile,wallet,isAdmin,isSuspended,loading,authError,refreshMe,refreshWallet,claimBootstrapAdmin,logout}}>{children}</AuthContext.Provider>;
};

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within an AuthProvider'); return ctx; };
