import {
  QueryClient,
  type QueryFunctionContext,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

type MerchantQueryKey = readonly [
  string,
  Record<string, string | number | boolean | undefined>?,
];

async function merchantQuery({
  queryKey,
}: QueryFunctionContext) {
  const [path, params] = queryKey as MerchantQueryKey;
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return apiRequest(`${path}${query ? `?${query}` : ''}`);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: merchantQuery,
      staleTime: 20_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function merchantQueryKey(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): MerchantQueryKey {
  return params ? [path, params] : [path];
}