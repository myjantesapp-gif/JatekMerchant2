import { setAuthTokenGetter, setBaseUrl, setUnauthorizedHandler } from '@workspace/api-client-react';

export const API_BASE_URL = 'https://api.jatek.app';
export const TOKEN_KEY = 'jatek_merchant_token';

setBaseUrl(API_BASE_URL);
setAuthTokenGetter(() => window.localStorage.getItem(TOKEN_KEY));
setUnauthorizedHandler(() => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('jatek-auth-change'));
});

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event('jatek-auth-change'));
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('jatek-auth-change'));
}