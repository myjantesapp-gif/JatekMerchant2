import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE_URL, ApiError, buildApiUrl, frenchMessage, type RequestOptions } from '@/lib/api-core';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

client.interceptors.request.use((config) => {
  const checked = new URL(buildApiUrl(config.url ?? ''));
  config.baseURL = API_BASE_URL;
  config.url = `${checked.pathname}${checked.search}`;
  config.withCredentials = false;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status !== undefined) {
        const payload: unknown = error.response?.data;
        const message = payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : undefined;
        return Promise.reject(new ApiError(status, frenchMessage(status, message)));
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return Promise.reject(new ApiError(408, 'Le serveur ne répond pas après 10 secondes. Vérifiez votre connexion.'));
      }
    }
    return Promise.reject(new ApiError(0, 'Connexion impossible à api.jatek.app. Vérifiez votre réseau.'));
  },
);

export async function axiosRequestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const checked = new URL(buildApiUrl(path));
  const config: AxiosRequestConfig = {
    url: `${checked.pathname}${checked.search}`,
    method: options.method ?? 'GET',
    data: options.body,
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  };
  const response = await client.request<unknown>(config);
  return response.data;
}