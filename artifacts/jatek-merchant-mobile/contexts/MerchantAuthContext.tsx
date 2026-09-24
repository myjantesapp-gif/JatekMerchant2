import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiRequest,
  MERCHANT_TOKEN_KEY,
  setApiUnauthorizedHandler,
} from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import type { MerchantUser } from '@/lib/types';

type AuthContextValue = {
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const MerchantAuthContext = createContext<AuthContextValue | null>(null);

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeToken = useRef<string | null>(null);

  const clearSession = useCallback(async (requestToken?: string) => {
    if (requestToken && requestToken !== activeToken.current) return;
    activeToken.current = null;
    setToken(null);
    await AsyncStorage.removeItem(MERCHANT_TOKEN_KEY).catch(() => undefined);
    queryClient.clear();
  }, []);

  useEffect(() => {
    setApiUnauthorizedHandler((requestToken) => {
      void clearSession(requestToken);
    });
    AsyncStorage.getItem(MERCHANT_TOKEN_KEY)
      .then(async (storedToken) => {
        if (!storedToken) return;
        activeToken.current = storedToken;
        try {
          await apiRequest('/api/backend/me', { token: storedToken });
          if (activeToken.current === storedToken) setToken(storedToken);
        } catch (error) {
          // Keep a valid-looking session while offline; the API will still
          // invalidate it immediately if a protected request returns 401.
          if (
            error instanceof Error &&
            'status' in error &&
            (error as { status?: number }).status === 401
          ) {
            await clearSession(storedToken);
          } else if (activeToken.current === storedToken) {
            setToken(storedToken);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));

    return () => setApiUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ token: string; user: MerchantUser }>(
      '/api/backend/login',
      { method: 'POST', json: { email: email.trim(), password }, token: null },
    );
    await AsyncStorage.setItem(MERCHANT_TOKEN_KEY, response.token);
    activeToken.current = response.token;
    setToken(response.token);
    queryClient.clear();
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ token, isLoading, login, logout }),
    [token, isLoading, login, logout],
  );

  return (
    <MerchantAuthContext.Provider value={value}>
      {children}
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth(): AuthContextValue {
  const context = useContext(MerchantAuthContext);
  if (!context) {
    throw new Error('useMerchantAuth must be used inside MerchantAuthProvider');
  }
  return context;
}