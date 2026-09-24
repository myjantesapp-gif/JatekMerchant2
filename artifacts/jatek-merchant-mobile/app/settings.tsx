import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, LoadingState, PrimaryButton, ScreenFrame, SectionTitle } from '@/components/MerchantUI';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useColors } from '@/hooks/useColors';
import { merchantQueryKey } from '@/lib/query-client';
import type { BackendMe } from '@/lib/types';
import { dateLabel } from '@/lib/types';

const roleLabels: Record<string, string> = {
  restaurant_owner: 'Propriétaire',
  merchant: 'Marchand',
  manager: 'Responsable',
  employee: 'Employé',
  admin: 'Administrateur',
  super_admin: 'Super administrateur',
};

export default function MerchantSettingsScreen() {
  const colors = useColors();
  const { logout } = useMerchantAuth();
  const me = useQuery<BackendMe>({ queryKey: merchantQueryKey('/api/backend/me') });

  const confirmLogout = () => {
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau vos identifiants marchand.', [
      { text: 'Rester connecté', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  return (
    <ScreenFrame
      title="Paramètres"
      eyebrow="VOTRE COMPTE"
      subtitle="Informations de compte et accès associés."
      showSettings={false}
      back={() => router.back()}
      onRefresh={() => void me.refetch()}
      refreshing={me.isRefetching}
    >
      {me.isLoading ? (
        <LoadingState />
      ) : me.isError || !me.data?.user ? (
        <LoadingState
          error={me.error instanceof Error ? me.error.message : 'Impossible de charger votre compte.'}
          onRetry={() => void me.refetch()}
        />
      ) : (
        <>
          <Card style={styles.profileCard}>
            <View style={[styles.profileIcon, { backgroundColor: colors.sidebar }]}>
              <Feather name="user" size={25} color={colors.accent} />
            </View>
            <Text style={[styles.userName, { color: colors.foreground }]}>{me.data.user.name}</Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{me.data.user.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.roleText, { color: colors.secondaryForeground }]}>
                {roleLabels[me.data.user.role] ?? me.data.user.role}
              </Text>
            </View>
          </Card>
          <Card>
            <SectionTitle title="Informations du compte" />
            <AccountRow label="Téléphone" value={me.data.user.phone || 'Non renseigné'} />
            <AccountRow
              label="Membre depuis"
              value={me.data.user.createdAt ? dateLabel(me.data.user.createdAt).split(' à ')[0] : '—'}
            />
            <AccountRow label="Boutiques associées" value={String(me.data.scopedShopIds?.length ?? 0)} />
          </Card>
          <Card>
            <SectionTitle title="Autorisations" />
            {(me.data.permissions ?? []).length ? (
              <View style={styles.permissionList}>
                {me.data.permissions.map((permission) => (
                  <View key={permission} style={[styles.permission, { backgroundColor: colors.muted }]}>
                    <Feather name="check" size={12} color={colors.secondaryForeground} />
                    <Text style={[styles.permissionText, { color: colors.foreground }]}>{permission}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.noPermissions, { color: colors.mutedForeground }]}>
                Les permissions sont définies par le compte gestionnaire.
              </Text>
            )}
          </Card>
          <PrimaryButton
            label="Se déconnecter"
            onPress={confirmLogout}
            variant="outline"
            icon={<Feather name="log-out" size={17} color={colors.foreground} />}
            testID="button-merchant-logout"
          />
          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            Jatek Marchand · Les informations du compte sont gérées par votre administrateur.
          </Text>
        </>
      )}
    </ScreenFrame>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.accountRow, { borderColor: colors.border }]}>
      <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.accountValue, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { alignItems: 'center', paddingVertical: 23 },
  profileIcon: { width: 58, height: 58, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  userName: { marginTop: 12, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  userEmail: { marginTop: 4, fontSize: 12 },
  roleBadge: { marginTop: 12, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  roleText: { fontSize: 10, fontWeight: '800' },
  accountRow: { minHeight: 45, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  accountLabel: { flex: 1, fontSize: 12 },
  accountValue: { maxWidth: '58%', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  permissionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  permission: { minHeight: 29, borderRadius: 9, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  permissionText: { fontSize: 10, fontWeight: '700' },
  noPermissions: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  footer: { fontSize: 10, lineHeight: 16, textAlign: 'center' },
});