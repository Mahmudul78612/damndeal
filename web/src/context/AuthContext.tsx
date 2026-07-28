'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';
import { User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  showLoginModal: boolean;
  loginRedirect: string;
  openLoginModal: (redirect?: string) => void;
  closeLoginModal: () => void;
  login: (phone: string) => Promise<any>;
  verifyOtp: (phone: string, otp: string) => Promise<any>;
  firebaseVerify: (idToken: string) => Promise<any>;
  completeProfile: (name: string, email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRedirect, setLoginRedirect] = useState('');

  const openLoginModal = useCallback((redirect?: string) => {
    setLoginRedirect(redirect || '');
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
    setLoginRedirect('');
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('dd_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.user);
    } catch {
      localStorage.removeItem('dd_token');
      localStorage.removeItem('dd_refresh');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (phone: string) => {
    return api.post('/auth/send-otp', { phone });
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    localStorage.setItem('dd_token', res.accessToken);
    localStorage.setItem('dd_refresh', res.refreshToken);
    setUser(res.user);
    return res;
  };

  const firebaseVerify = async (idToken: string) => {
    const res = await api.post('/auth/firebase-verify', { idToken });
    localStorage.setItem('dd_token', res.accessToken);
    localStorage.setItem('dd_refresh', res.refreshToken);
    setUser(res.user);
    return res;
  };

  const completeProfile = async (name: string, email: string) => {
    const res = await api.put('/auth/complete-profile', { name, email });
    setUser(res.user);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_refresh');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, showLoginModal, loginRedirect, openLoginModal, closeLoginModal, login, verifyOtp, firebaseVerify, completeProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
