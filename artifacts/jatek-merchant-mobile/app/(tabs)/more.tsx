import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import { Button, ErrorState, font, Skeleton, styles as ui } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useMe, useShops } from '@/lib/merchant-data';

const destinations = [
  { route: '/shop-profile', icon: 'shopping-bag' as const, title: 'Boutique', detail: 'Modifier le profil, les horaires et les frais de livraison.' },
  { route: '/reviews', icon: 'message-circle' as const, title: 'Avis clients', detail: 'Consulter les notes et commentaires reçus.' },
  { route: '/settings', icon: 'settings' as const, title: 'Paramètres', detail: 'Voir le compte, les permissions et se déconnecter.' },
  { route: '/(tabs)/shops', icon: 'map-pin' as const, title: 'Mes boutiques', detail: 'Retrouver les coordonnées et l’état de chaque boutique.' },
] as const;

export default function MoreScreen() {
  const c = useColors();
  const bottom = useBottomPad();
  const me = useMe();
  if (me.data?.user.role === 'employee') {
    return <EmployeeAccount user={me.data.user} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker="Votre espace" title="Plus" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottom }]}>
        {destinations.map((item) => (
          <Pressable
            key={item.route}
            testID={`more-${item.title.toLowerCase().replaceAll(' ', '-')}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.detail}`}
            onPress={() => router.push(item.route)}
            style={({ pressed }) => [
              ui.card,
              s.card,
              { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <View style={[s.icon, { backgroundColor: c.secondary }]}>
              <Feather name={item.icon} size={19} color={c.secondaryForeground} />
            </View>
            <View style={s.copy}>
              <Text style={[s.title, { color: c.foreground }]}>{item.title}</Text>
              <Text style={[s.detail, { color: c.mutedForeground }]}>{item.detail}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function EmployeeAccount({ user }: { user: { name?: string | null; email: string } }) {
  const c = useColors();
  const bottom = useBottomPad();
  const shops = useShops();
  const { logout } = useAuth();
  const shop = shops.data?.[0];
  const name = user.name?.trim() || user.email;
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  const confirmLogout = () => {
    if (Platform.OS === 'web') { void logout(); return; }
    Alert.alert('Se déconnecter ?', 'Les données de session seront effacées de cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker="Votre espace" title="Compte" />
      <ScrollView contentContainerStyle={[s.accountContent, { paddingBottom: bottom }]}>
        <View style={[ui.card, s.identity, { backgroundColor: c.ink, borderColor: c.ink, borderRadius: c.radius + 4 }]}>
          <View style={[s.avatar, { backgroundColor: c.primary }]}>
            <Text style={[s.avatarText, { color: c.primaryForeground }]}>{initials || 'JT'}</Text>
          </View>
          <Text style={[s.accountName, { color: c.inkForeground }]}>{name}</Text>
          <Text style={[s.accountEmail, { color: c.inkForeground }]}>{user.email}</Text>
          <View style={[s.role, { backgroundColor: c.accent }]}>
            <Text style={[s.roleText, { color: c.accentForeground }]}>Employé</Text>
          </View>
        </View>

        {shops.isPending ? (
          <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 10 }]}>
            <Skeleton width="35%" />
            <Skeleton width="65%" height={20} />
          </View>
        ) : shops.isError && !shops.data ? (
          <ErrorState error={shops.error} onRetry={() => void shops.refetch()} />
        ) : (
          <View style={[ui.card, s.shopCard, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}>
            <Text style={[s.shopEyebrow, { color: c.mutedForeground }]}>MA BOUTIQUE</Text>
            <Text style={[s.shopName, { color: c.foreground }]}>{shop?.name || 'Aucune boutique associée'}</Text>
            {shop?.address ? <Text style={[s.detail, { color: c.mutedForeground }]}>{shop.address}</Text> : null}
            {typeof shop?.isOpen === 'boolean' ? (
              <View style={s.shopStatus}>
                <View style={[s.dot, { backgroundColor: shop.isOpen ? c.secondaryForeground : c.mutedForeground }]} />
                <Text style={[s.detail, { color: c.mutedForeground }]}>{shop.isOpen ? 'Ouverte aux commandes' : 'Fermée aux commandes'}</Text>
              </View>
            ) : null}
          </View>
        )}

        <Button testID="employee-logout" label="Se déconnecter" icon="log-out" variant="danger" onPress={confirmLogout} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 10, paddingTop: 4, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: font.semibold, fontSize: 16 },
  detail: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  accountContent: { paddingHorizontal: 18, paddingTop: 4, gap: 14, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  identity: { alignItems: 'flex-start', gap: 4, padding: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontFamily: font.bold, fontSize: 18 },
  accountName: { fontFamily: font.display, fontSize: 21 },
  accountEmail: { fontFamily: font.regular, fontSize: 14 },
  role: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 10 },
  roleText: { fontFamily: font.semibold, fontSize: 12 },
  shopCard: { gap: 6 },
  shopEyebrow: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1 },
  shopName: { fontFamily: font.display, fontSize: 19 },
  shopStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});