import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import { font, styles as ui } from '@/components/ui';

const destinations = [
  { route: '/shop-profile', icon: 'shopping-bag' as const, title: 'Boutique', detail: 'Modifier le profil, les horaires et les frais de livraison.' },
  { route: '/reviews', icon: 'message-circle' as const, title: 'Avis clients', detail: 'Consulter les notes et commentaires reçus.' },
  { route: '/settings', icon: 'settings' as const, title: 'Paramètres', detail: 'Voir le compte, les permissions et se déconnecter.' },
  { route: '/(tabs)/shops', icon: 'map-pin' as const, title: 'Mes boutiques', detail: 'Retrouver les coordonnées et l’état de chaque boutique.' },
] as const;

export default function MoreScreen() {
  const c = useColors();
  const bottom = useBottomPad();
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

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 10, paddingTop: 4, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: font.semibold, fontSize: 16 },
  detail: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
});