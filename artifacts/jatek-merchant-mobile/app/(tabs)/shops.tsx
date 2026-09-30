import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMe, useShops } from '@/lib/merchant-data';
import { ErrorState, SkeletonCards, StateView, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import { buildApiUrl, type Shop } from '@/lib/api-core';

function logoSrc(url?: string | null) {
  if (!url) return null;
  try { return url.startsWith('/api/') || url.startsWith('https://api.jatek.app') ? buildApiUrl(url) : null; } catch { return null; }
}

async function callShop(phone: string) {
  const number = phone.trim().replace(/[^\d+]/g, '');
  if (!number) return;
  try {
    await Linking.openURL(`tel:${number}`);
  } catch {
    Alert.alert('Appel indisponible', 'Impossible de lancer un appel depuis cet appareil.');
  }
}

export default function ShopsScreen() {
  const me = useMe();
  return me.data?.user.role === 'employee' ? <Redirect href="/(tabs)/orders" /> : <MerchantShopsScreen />;
}

function MerchantShopsScreen() {
  const c = useColors();
  const q = useShops();
  const bottom = useBottomPad();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const horizontalPadding = Math.min(24, Math.max(14, Math.round(width * 0.05)));
  const shops = q.data ?? [];
  const visibleShops = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    if (!term) return shops;
    return shops.filter((shop) => [shop.name, shop.address, shop.category, shop.phone].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(term));
  }, [shops, search]);

  const renderItem = ({ item }: { item: Shop }) => {
    const logo = logoSrc(item.logoUrl);
    const open = item.isOpen;
    return (
      <View style={[ui.card, s.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]} testID={`shop-${item.id}`}>
        <View style={[s.logo, { backgroundColor: c.secondary, borderRadius: c.radius - 3 }]}>
          {logo ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Logo ${item.name}`} /> :
            <Text style={[s.initial, { color: c.secondaryForeground }]}>{item.name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={s.details}>
          <Text style={[s.name, { color: c.foreground }]}>{item.name}</Text>
          {item.address ? (
            <View style={s.line}>
              <Feather name="map-pin" size={13} color={c.mutedForeground} />
              <Text style={[s.meta, s.address, { color: c.mutedForeground }]}>{item.address}</Text>
            </View>
          ) : null}
          <View style={s.tags}>
            {item.category ? <Text style={[s.tag, { color: c.mutedForeground, backgroundColor: c.muted }]}>{item.category}</Text> : null}
            {typeof open === 'boolean' ? (
              <View style={[s.openStatus, { backgroundColor: open ? '#3f9e8718' : c.muted }]}>
                <View style={[s.dot, { backgroundColor: open ? '#3f9e87' : c.mutedForeground }]} />
                <Text style={[s.meta, { color: open ? '#276d5c' : c.mutedForeground }]}>{open ? 'Ouverte' : 'Fermée'}</Text>
              </View>
            ) : null}
          </View>
          {item.phone ? (
            <Pressable
              testID={`call-shop-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Appeler ${item.name}, ${item.phone}`}
              onPress={() => void callShop(item.phone!)}
              style={({ pressed }) => [s.callButton, { borderColor: c.border, backgroundColor: pressed ? c.secondary : 'transparent' }]}
            >
              <Feather name="phone" size={15} color={c.primary} />
              <Text style={[s.callLabel, { color: c.primary }]}>{item.phone}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const emptyTitle = search.trim() ? 'Aucun résultat' : 'Aucune boutique';
  const emptyMessage = search.trim()
    ? 'Essayez un autre nom, une autre adresse ou une autre catégorie.'
    : "Aucune boutique n'est rattachée à votre compte.";

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        kicker={q.data ? `${shops.length} boutique${shops.length > 1 ? 's' : ''}` : 'Votre réseau'}
        title="Boutiques"
        right={q.data?.length ? (
          <Pressable
            testID="edit-shop-profile"
            accessibilityRole="button"
            accessibilityLabel="Modifier le profil de la boutique"
            onPress={() => router.push('/shop-profile')}
            style={({ pressed }) => [s.profileButton, { backgroundColor: c.primary, opacity: pressed ? 0.82 : 1 }]}
          >
            <Feather name="edit-3" size={15} color={c.primaryForeground} />
            <Text style={[s.profileButtonText, { color: c.primaryForeground }]}>Profil</Text>
          </Pressable>
        ) : undefined}
      />
      {q.isPending ? <SkeletonCards count={4} /> : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {shops.length > 0 ? (
            <View style={[s.search, { marginHorizontal: horizontalPadding, backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
              <Feather name="search" size={17} color={c.mutedForeground} />
              <TextInput
                testID="shops-search"
                accessibilityLabel="Rechercher une boutique"
                value={search}
                onChangeText={setSearch}
                placeholder="Nom, adresse ou catégorie"
                placeholderTextColor={c.mutedForeground}
                returnKeyType="search"
                autoCapitalize="none"
                style={[s.searchInput, { color: c.foreground }]}
              />
              {search ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Effacer la recherche"
                  hitSlop={8}
                  onPress={() => setSearch('')}
                  style={s.clear}
                >
                  <Feather name="x-circle" size={18} color={c.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <FlatList
            data={visibleShops}
            keyExtractor={(x) => String(x.id)}
            renderItem={renderItem}
            contentContainerStyle={[s.list, { paddingHorizontal: horizontalPadding, paddingBottom: bottom }]}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
            ListHeaderComponent={q.isError ? <Text accessibilityRole="alert" style={[s.meta, { color: c.destructive, marginBottom: 8 }]}>Actualisation échouée. Faites glisser vers le bas pour réessayer.</Text> : null}
            ListEmptyComponent={<StateView icon={search ? 'search' : 'home'} title={emptyTitle} message={emptyMessage} actionLabel="Actualiser" onAction={() => q.refetch()} />}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logo: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: font.bold, fontSize: 20 },
  details: { flex: 1, minWidth: 0, gap: 8 },
  name: { fontFamily: font.semibold, fontSize: 16, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  address: { flex: 1 },
  meta: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tag: { fontFamily: font.medium, fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  openStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  callButton: { minHeight: 44, maxWidth: '100%', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  callLabel: { fontFamily: font.semibold, fontSize: 13, flexShrink: 1 },
  search: { minHeight: 48, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 0, fontFamily: font.regular, fontSize: 14 },
  clear: { minWidth: 32, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  profileButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12 },
  profileButtonText: { fontFamily: font.semibold, fontSize: 12 },
  list: { paddingTop: 4, gap: 10, flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
});