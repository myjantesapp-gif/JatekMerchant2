import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { fetchMe, setApiUnauthorizedHandler } from "@/lib/api";

const TOKEN_KEY = "jatek_jwt";
const USER_KEY = "jatek_user";
const SESSION_KEY = "jatek_auth_session_v1";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  loyaltyPoints: number;
  address?: string | null;
  avatarUrl?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function secureDel(key: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

type PersistedSession = { token: string; user: AuthUser };

async function readPersistedSession(): Promise<PersistedSession | null> {
  const rawSession = await secureGet(SESSION_KEY);
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession) as Partial<PersistedSession>;
      if (typeof parsed.token === "string" && parsed.token && parsed.user && typeof parsed.user === "object") {
        return { token: parsed.token, user: parsed.user as AuthUser };
      }
    } catch (err) {
      console.warn("[Auth] failed to parse persisted session:", err);
    }
    // A partial or corrupted atomic record must never be combined with legacy
    // keys, otherwise a stale user can appear to be logged in.
    await Promise.all([secureDel(SESSION_KEY), secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    return null;
  }

  // Migrate sessions written by older versions. Only a complete legacy pair
  // is accepted; a token without its user is treated as an interrupted write.
  const [legacyToken, legacyUserRaw] = await Promise.all([
    secureGet(TOKEN_KEY),
    secureGet(USER_KEY),
  ]);
  if (!legacyToken && !legacyUserRaw) return null;
  if (!legacyToken || !legacyUserRaw) {
    await Promise.all([secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    return null;
  }
  try {
    const legacyUser = JSON.parse(legacyUserRaw) as AuthUser;
    if (!legacyUser || typeof legacyUser !== "object") throw new Error("invalid user");
    const session = { token: legacyToken, user: legacyUser };
    await secureSet(SESSION_KEY, JSON.stringify(session));
    await Promise.all([secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    return session;
  } catch (err) {
    console.warn("[Auth] failed to migrate legacy session:", err);
    await Promise.all([secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    return null;
  }
}

async function readPersistedToken(): Promise<string | null> {
  const session = await secureGet(SESSION_KEY);
  if (session) {
    try {
      const parsed = JSON.parse(session) as Partial<PersistedSession>;
      return typeof parsed.token === "string" && parsed.token ? parsed.token : null;
    } catch {
      return null;
    }
  }
  return secureGet(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const invalidatingSessionRef = useRef(false);
  const activeTokenRef = useRef<string | null>(null);
  const sessionRevisionRef = useRef(0);
  const sessionStorageQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSessionStorage = useCallback((operation: () => Promise<void>) => {
    const queued = sessionStorageQueueRef.current
      .catch(() => undefined)
      .then(operation);
    sessionStorageQueueRef.current = queued;
    return queued;
  }, []);

  const invalidateSession = useCallback((requestToken: string | null = null) => {
    // A response can arrive after the customer has logged in again. Only the
    // token that made the rejected request is allowed to end the active session.
    if (!requestToken || requestToken !== activeTokenRef.current) return;
    if (invalidatingSessionRef.current) return;
    invalidatingSessionRef.current = true;
    sessionRevisionRef.current += 1;
    activeTokenRef.current = null;
    setToken(null);
    setUser(null);
    setSessionExpired(true);
    void enqueueSessionStorage(async () => {
      await Promise.all([secureDel(SESSION_KEY), secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    }).catch((err) => {
      console.warn("[Auth] failed to clear an invalid session:", err);
    });
  }, [enqueueSessionStorage]);

  useEffect(() => {
    // Wire up auth token getter for API client
    setAuthTokenGetter(readPersistedToken);
    setUnauthorizedHandler(invalidateSession);
    setApiUnauthorizedHandler(invalidateSession);

    // Load persisted auth on startup. SecureStore can throw on Android Expo
    // Go in some environments — never let it block the app from rendering.
    readPersistedSession()
      .then(async (session) => {
        if (!session) return;
        const { token: t, user: restoredUser } = session;
        // Make the restored token the active identity before its verification
        // request so a 401 can clear it instead of being treated as stale.
        activeTokenRef.current = t;

        // EventSource does not expose a failed handshake status on web. Verify
        // restored credentials through a normal protected request before
        // rendering an authenticated session, so a disabled account is
        // redirected immediately even when it opens the app while idle.
        try {
          await fetchMe();
        } catch (err) {
          if (invalidatingSessionRef.current) return; // 401 already cleared us
          // Preserve an existing session when the device is merely offline;
          // protected requests will still invalidate it if they later get 401.
          console.warn("[Auth] could not verify restored session:", err);
        }

        if (!invalidatingSessionRef.current) {
          activeTokenRef.current = t;
          setToken(t);
          setUser(restoredUser);
        }
      })
      .catch((err) => {
        console.warn("[Auth] secure storage unavailable:", err);
      })
      .finally(() => setIsLoading(false));
    return () => {
      setUnauthorizedHandler(null);
      setApiUnauthorizedHandler(null);
    };
  }, [invalidateSession]);

  const login = async (newToken: string, newUser: AuthUser) => {
    const revision = ++sessionRevisionRef.current;
    // One record makes login recoverable if the app is terminated during the
    // write. State changes only happen after that record is safely persisted.
    await enqueueSessionStorage(async () => {
      if (revision !== sessionRevisionRef.current) return;
      await secureSet(SESSION_KEY, JSON.stringify({ token: newToken, user: newUser }));
      await Promise.all([secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    });
    if (revision !== sessionRevisionRef.current) return;
    invalidatingSessionRef.current = false;
    activeTokenRef.current = newToken;
    setSessionExpired(false);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    const revision = ++sessionRevisionRef.current;
    invalidatingSessionRef.current = false;
    activeTokenRef.current = null;
    setSessionExpired(false);
    await enqueueSessionStorage(async () => {
      if (revision !== sessionRevisionRef.current) return;
      await Promise.all([secureDel(SESSION_KEY), secureDel(TOKEN_KEY), secureDel(USER_KEY)]);
    });
    if (revision !== sessionRevisionRef.current) return;
    setToken(null);
    setUser(null);
  };

  const updateUser = async (newUser: AuthUser) => {
    if (!token) return;
    const revision = sessionRevisionRef.current;
    const tokenAtStart = token;
    await enqueueSessionStorage(async () => {
      if (revision !== sessionRevisionRef.current || invalidatingSessionRef.current) return;
      await secureSet(SESSION_KEY, JSON.stringify({ token: tokenAtStart, user: newUser }));
    });
    if (revision !== sessionRevisionRef.current || invalidatingSessionRef.current) return;
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, sessionExpired, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
