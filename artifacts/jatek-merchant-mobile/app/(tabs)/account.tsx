import React from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/merchant-data';
import { Button, ErrorState, Skeleton, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';

const ROLE: Record<string, string> = {
  admin: 'Administrateur', super_admin: 'Super administrateur', merchant: 'Marchand', restaurant_owner: 'Propriétaire', shop_manager: 'Gérant', staff: 'Équipe',
};

export default function AccountScreen() {
  const c = useColors();
  const { logout } = useAuth();
  const q = useMe();
  const bottom = useBottomPad();

  const confirmLogout = () => {
    if (Platform.OS === 'web') { void logout(); return; }
    Alert.alert('Se déconnecter ?', 'Les données de session seront effacées de cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const u = q.data?.user;
  const name = (u?.name as string | undefined) || u?.email || '';
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker="Profil" title="Compte" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16, paddingBottom: bottom, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
      >
        {q.isPending ? (
          <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 10 }]}>
            <Skeleton width={56} height={56} style={{ borderRadius: 28 }} />
            <Skeleton width="60%" /><Skeleton width="40%" />
          </View>
        ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : u ? (
          <>
            <View style={[s.idCard, { backgroundColor: c.ink, borderRadius: c.radius + 4 }]}>
              <View style={[s.avatar, { backgroundColor: c.primary }]}>
                <Text style={[s.avatarText, { color: c.primaryForeground }]}>{name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={[s.name, { color: c.inkForeground }]} numberOfLines={1}>{name}</Text>
              <Text style={[s.email, { color: '#b9b3aa' }]} numberOfLines={1}>{u.email}</Text>
              <View style={[s.role, { backgroundColor: c.accent }]}>
                <Text style={[s.roleText, { color: c.accentForeground }]}>{ROLE[u.role] ?? u.role}</Text>
              </View>
            </View>
            <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 12 }]}>
              <Row label="Boutiques autorisées" value={q.data.scopedShopIds?.length ? String(q.data.scopedShopIds.length) : 'Toutes'} />
              <Row label="Permissions" value={String(q.data.permissions?.length ?? 0)} />
              <Row label="Source des données" value="api.jatek.app" />
            </View>
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Button testID="logout" label="Se déconnecter" icon="log-out" variant="danger" onPress={confirmLogout} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[s.rowValue, { color: c.foreground }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  idCard: { padding: 20, gap: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontFamily: font.bold, fontSize: 18 },
  name: { fontFamily: font.bold, fontSize: 20 },
  email: { fontFamily: font.regular, fontSize: 14 },
  role: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 10 },
  roleText: { fontFamily: font.semibold, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: font.regular, fontSize: 14 },
  rowValue: { fontFamily: font.semibold, fontSize: 14 },
});
