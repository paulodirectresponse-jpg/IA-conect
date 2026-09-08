import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { authService } from '../services/authService.js';
import { walletService } from '../services/walletService.js';
import { UserProfile, WalletAccount } from '../types/index.js';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  wallet: WalletAccount | null;
  isAdmin: boolean;
  loading: boolean;
  refreshMe: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  claimBootstrapAdmin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async () => {
    try {
      const data = await authService.getMe();
      setProfile(data.user);
      setWallet(data.wallet);
    } catch (err: any) {
      console.warn('[AuthContext] Failed to load user profile/wallet:', err.message);
      setProfile(null);
      setWallet(null);
    }
  };

  const refreshWallet = async () => {
    try {
      const w = await walletService.getSummary();
      setWallet(w);
    } catch (err) {
      console.warn('[AuthContext] Failed to refresh wallet:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserData();
      } else {
        setProfile(null);
        setWallet(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshMe = async () => {
    if (auth.currentUser) {
      await loadUserData();
    }
  };

  const claimBootstrapAdmin = async () => {
    await authService.claimBootstrapAdmin();
    await loadUserData();
  };

  const logout = async () => {
    await authService.logout();
    setFirebaseUser(null);
    setProfile(null);
    setWallet(null);
  };

  const isAdmin = profile?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        wallet,
        isAdmin,
        loading,
        refreshMe,
        refreshWallet,
        claimBootstrapAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
