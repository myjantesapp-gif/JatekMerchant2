import { fetch as expoFetch } from 'expo/fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MERCHANT_TOKEN_KEY = 'jatek_merchant_token';

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.jatek.app'
).replace(/\/+$/, '');

let unauthorizedHandler: ((requestToken: string) => void) | null = null;

export function getApiUrl(): string {
  return API_BASE_URL;
}

export function setApiUnauthorizedHandler(
  handler: ((requestToken: string) => void) | null,
): void {
  unauthorizedHandler = handler;
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(MERCHANT_TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  json?: unknown;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  token?: string | null;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token =
    options.token === undefined ? await getStoredToken() : options.token;
  const headers: Record<string, string> = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await expoFetch(new URL(path.replace(/^\/+/, ''), `${API_BASE_URL}/`).toString(), {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible. Vérifiez votre réseau puis réessayez.');
  }

  if (response.status === 401 && token) unauthorizedHandler?.(token);
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `La requête a échoué (${response.status}).`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}