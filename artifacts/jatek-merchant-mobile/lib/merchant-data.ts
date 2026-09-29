import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, meSchema, orderDetailSchema, ordersSchema, parseWith, shopsSchema } from '@/lib/api-core';
import { apiRequest, sessionKey } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';

// All hooks use the shared default fetcher; schemas validate via `select`.
export function useMe() {
  const { token } = useAuth();
  return useQuery({
    queryKey: sessionKey('/api/backend/me', token),
    enabled: !!token,
    select: (d: unknown) => parseWith(meSchema, d, 'profil'),
  });
}

export function useShops() {
  const { token } = useAuth();
  return useQuery({
    queryKey: sessionKey('/api/backend/shops', token),
    enabled: !!token,
    select: (d: unknown) => parseWith(shopsSchema, d, 'boutiques'),
  });
}

/** Shared live order feed; React Query pauses polling while the app is backgrounded. */
export function useOrders() {
  const { token } = useAuth();
  return useQuery({
    queryKey: sessionKey('/api/backend/orders?limit=100', token),
    enabled: !!token,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    select: (d: unknown) => parseWith(ordersSchema, d, 'commandes'),
  });
}

export function useOrder(id: number) {
  const { token } = useAuth();
  const valid = Number.isInteger(id) && id > 0;
  return useQuery({
    queryKey: sessionKey(`/api/backend/orders/${valid ? id : 0}`, token),
    enabled: !!token && valid,
    select: (d: unknown) => parseWith(orderDetailSchema, d, 'commande'),
  });
}

export type MerchantOrderStatus = 'accepted' | 'preparing' | 'ready';

export function nextMerchantOrderStatus(status: string): MerchantOrderStatus | null {
  if (status === 'pending') return 'accepted';
  if (status === 'accepted' || status === 'confirmed') return 'preparing';
  if (status === 'preparing') return 'ready';
  return null;
}

export function useUpdateOrderStatus() {
  const { token } = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, prepTimeMinutes }: { id: number; status: MerchantOrderStatus; prepTimeMinutes?: number }) => {
      if (!token) throw new ApiError(401, 'Session absente.');
      const data = await apiRequest(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: { status, ...(status === 'accepted' && prepTimeMinutes !== undefined ? { prepTimeMinutes } : {}) },
        token,
      });
      return parseWith(orderDetailSchema, data, 'commande');
    },
    onSuccess: async (order) => {
      client.setQueryData(sessionKey(`/api/backend/orders/${order.id}`, token), order);
      await client.invalidateQueries({
        queryKey: sessionKey('/api/backend/orders?limit=100', token),
      });
    },
  });
}

export function useRejectOrder() {
  const { token } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const normalizedReason = reason.trim();
      if (normalizedReason.length < 3 || normalizedReason.length > 500) {
        throw new ApiError(400, 'Le motif doit contenir entre 3 et 500 caractères.');
      }
      const data = await apiRequest(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled', reason: normalizedReason },
        token: token ?? (() => { throw new ApiError(401, 'Session absente.'); })(),
      });
      return parseWith(orderDetailSchema, data, 'commande');
    },
    onSuccess: async (order) => {
      client.setQueryData(sessionKey(`/api/backend/orders/${order.id}`, token), order);
      await client.invalidateQueries({ queryKey: sessionKey('/api/backend/orders?limit=100', token) });
    },
  });
}

export function useExtendPrepTime() {
  const { token } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, prepTimeMinutes }: { id: number; prepTimeMinutes: number }) => {
      if (!token) throw new ApiError(401, 'Session absente.');
      const data = await apiRequest(`/api/orders/${id}/prep-time`, {
        method: 'PATCH',
        body: { prepTimeMinutes },
        token,
      });
      return parseWith(orderDetailSchema, data, 'commande');
    },
    onSuccess: async (order) => {
      client.setQueryData(sessionKey(`/api/backend/orders/${order.id}`, token), order);
      await client.invalidateQueries({ queryKey: sessionKey('/api/backend/orders?limit=100', token) });
    },
  });
}

export function useDeleteMerchantAccount() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (userId: number) => {
      if (!token) throw new ApiError(401, 'Session absente.');
      await apiRequest(`/api/users/${userId}`, { method: 'DELETE', token });
    },
  });
}
