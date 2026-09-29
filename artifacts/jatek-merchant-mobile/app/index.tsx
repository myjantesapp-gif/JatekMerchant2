import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';
import { ErrorState, font } from '@/components/ui';
import { useMe } from '@/lib/merchant-data';

export default function IndexRoute() {
  const { status } = useAuth();
  const c = useColors();
  const me = useMe();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!me.data && me.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
        <Text style={{ color: c.mutedForeground, fontFamily: font.medium }}>Chargement de votre espace…</Text>
      </View>
    );
  }
  if (!me.data && me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  return <Redirect href={me.data?.user.role === 'employee' ? '/(tabs)/orders' : '/(tabs)/overview'} />;
}