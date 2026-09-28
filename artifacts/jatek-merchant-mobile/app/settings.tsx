import React from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/merchant-data';
import { Button, ErrorState, Skeleton, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import type { MerchantUser } from '@/lib/api-core';

const ROLE: Record<string, string> = {
  admin: 'Administrateur',
  super_admin: 'Super administrateur',
  manager: 'Manager',
  restaurant_owner: 'Propriétaire',
  merchant: 'Marchand',
  shop_manager: 'Gérant',
  staff: 'Équipe',
  employee: 'Employé',
};

function labelPermission(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function memberDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SettingsScreen() {
  const c = useColors();
  const { logout } = useAuth();
  const q = useMe();
  const bottom = useBottomPad();
  const u = q.data?.user as (MerchantUser & { phone?: string | null; createdAt?: string | null; joinedAt?: string | null }) | undefined;
  const name = u?.name || u?.email || '';
  const permissions = q.data?.permissions ?? [];

  const confirmLogout = () => {
    if (Platform.OS === 'web') { void logout(); return; }
    Alert.alert('Se déconnecter ?', 'Les données de session seront effacées de cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker="Votre compte" title="Paramètres" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottom }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
      >
        {q.isPending ? (
          <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 12 }]}>
            <Skeleton width={56} height={56} style={{ borderRadius: 28 }} /><Skeleton width="60%" /><Skeleton width="42%" />
          </View>
        ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : u ? (
          <>
            <View style={[s.identity, { backgroundColor: c.ink, borderRadius: c.radius + 4 }]}>
              <View style={[s.avatar, { backgroundColor: c.primary }]}>
                <Text style={[s.avatarText, { color: c.primaryForeground }]}>{name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={[s.name, { color: c.inkForeground }]}>{name}</Text>
              <Text style={[s.email, { color: c.inkForeground }]}>{u.email}</Text>
              <View style={[s.role, { backgroundColor: c.accent }]}>
                <Text style={[s.roleText, { color: c.accentForeground }]}>{ROLE[u.role] ?? u.role}</Text>
              </View>
            </View>
            <View style={[ui.card, s.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}>
              <Row label="Téléphone" value={u.phone || '—'} />
              <Row label="Membre depuis" value={memberDate(u.createdAt || u.joinedAt)} />
              <Row label="Boutiques autorisées" value={q.data.scopedShopIds?.length ? String(q.data.scopedShopIds.length) : 'Toutes'} />
            </View>
            <View style={[ui.card, s.permissionCard, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}>
              <Text style={[s.sectionTitle, { color: c.foreground }]}>Permissions effectives</Text>
              {permissions.length ? (
                <View style={s.permissions}>
                  {permissions.map((permission) => (
                    <View key={permission} style={[s.permission, { backgroundColor: c.secondary }]}>
                      <Text style={[s.permissionText, { color: c.secondaryForeground }]}>{labelPermission(permission)}</Text>
                    </View>
                  ))}
                </View>
              ) : <Text style={[s.muted, { color: c.mutedForeground }]}>Aucune permission détaillée fournie.</Text>}
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
  content: { paddingHorizontal: 18, paddingTop: 4, gap: 14, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  identity: { padding: 20, gap: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontFamily: font.bold, fontSize: 18 },
  name: { fontFamily: font.display, fontSize: 21 },
  email: { fontFamily: font.regular, fontSize: 14 },
  role: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 10 },
  roleText: { fontFamily: font.semibold, fontSize: 12 },
  card: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  rowLabel: { fontFamily: font.regular, fontSize: 14, flexShrink: 1 },
  rowValue: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  permissionCard: { gap: 12 },
  sectionTitle: { fontFamily: font.display, fontSize: 18 },
  permissions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permission: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  permissionText: { fontFamily: font.semibold, fontSize: 12 },
  muted: { fontFamily: font.regular, fontSize: 13 },
});