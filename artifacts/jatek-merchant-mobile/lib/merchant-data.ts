import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { meSchema, orderDetailSchema, ordersSchema, parseWith, shopsSchema } from '@/lib/api-core';
import { sessionKey } from '@/lib/query-client';
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

function useScreenFocused() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return focused;
}

/** Polls every 30 s only while this screen is focused and the app is in the foreground. */
export function useOrders() {
  const { token } = useAuth();
  const focused = useScreenFocused();
  return useQuery({
    queryKey: sessionKey('/api/backend/orders?limit=100', token),
    enabled: !!token,
    refetchInterval: focused ? 30_000 : false,
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
