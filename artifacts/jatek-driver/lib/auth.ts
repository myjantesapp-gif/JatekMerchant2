import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const TOKEN_KEY = "jatek_driver_token";
type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

const webStore = {
  getItemAsync: async (k: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(k);
  },
  setItemAsync: async (k: string, v: string): Promise<void> => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(k, v);
  },
  deleteItemAsync: async (k: string): Promise<void> => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(k);
  },
};

const store = Platform.OS === "web" ? webStore : SecureStore;

export async function getToken(): Promise<string | null> {
  try {
    return await store.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await store.setItemAsync(TOKEN_KEY, token);
  for (const listener of tokenListeners) listener(token);
}

export async function clearToken(): Promise<void> {
  await store.deleteItemAsync(TOKEN_KEY);
  for (const listener of tokenListeners) listener(null);
}

/**
 * Clears the persisted session only when it still belongs to the request that
 * was rejected. An older request must never log out a newer sign-in.
 */
export async function clearTokenIfMatches(expectedToken: string | null): Promise<boolean> {
  if (!expectedToken) return false;
  const currentToken = await getToken();
  if (currentToken !== expectedToken) return false;
  await clearToken();
  return true;
}

export function subscribeToTokenChanges(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}
