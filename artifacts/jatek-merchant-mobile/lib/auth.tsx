import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSchema, parseWith, type MerchantUser } from '@/lib/api-core';
import { apiRequest, getSessionToken, queryClient, setSessionToken, setUnauthorizedHandler } from '@/lib/query-client';

const TOKEN_KEY = 'jatek_merchant_token';

type Status = 'loading' | 'signedOut' | 'signedIn';
interface AuthValue {
  status: Status;
  token: string | null;
  loginUser: MerchantUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function resetPrivateCache() {
  await queryClient.cancelQueries();
  queryClient.clear();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [loginUser, setLoginUser] = useState<MerchantUser | null>(null);
  const tokenRef = useRef<string | null>(null);

  const applyToken = useCallback(async (next: string | null) => {
    tokenRef.current = next;
    setSessionToken(next);
    await resetPrivateCache().catch(() => undefined);
    setToken(next);
    setStatus(next ? 'signedIn' : 'signedOut');
    try {
      if (next) await AsyncStorage.setItem(TOKEN_KEY, next);
      else await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage failure: in-memory session state stays authoritative.
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((stale) => {
      if (stale !== tokenRef.current || stale !== getSessionToken()) return; // stale 401: ignore
      setLoginUser(null);
      applyToken(null).catch(() => undefined);
    });
    let alive = true;
    AsyncStorage.getItem(TOKEN_KEY)
      .then((t) => {
        if (!alive || tokenRef.current) return;
        tokenRef.current = t;
        setSessionToken(t);
        setToken(t);
        setStatus(t ? 'signedIn' : 'signedOut');
      })
      .catch(() => alive && setStatus('signedOut'));
    return () => { alive = false; setUnauthorizedHandler(null); };
  }, [applyToken]);

  const login = useCallback(async (email: string, password: string) => {
    const raw = await apiRequest('/api/backend/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
      token: null,
    });
    const res = parseWith(loginSchema, raw, 'connexion');
    setLoginUser(res.user);
    await applyToken(res.token);
  }, [applyToken]);

  const logout = useCallback(async () => {
    setLoginUser(null);
    await applyToken(null);
  }, [applyToken]);

  const value = useMemo(() => ({ status, token, loginUser, login, logout }), [status, token, loginUser, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
