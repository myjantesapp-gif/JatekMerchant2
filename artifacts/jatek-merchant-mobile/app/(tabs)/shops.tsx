import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useShops } from '@/lib/merchant-data';
import { ErrorState, SkeletonCards, StateView, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import { buildApiUrl, type Shop } from '@/lib/api-core';

function logoSrc(url?: string | null) {
  if (!url) return null;
  try { return url.startsWith('/api/') || url.startsWith('https://api.jatek.app') ? buildApiUrl(url) : null; } catch { return null; }
}

export default function ShopsScreen() {
  const c = useColors();
  const q = useShops();
  const bottom = useBottomPad();

  const renderItem = ({ item }: { item: Shop }) => {
    const logo = logoSrc(item.logoUrl);
    const open = item.isOpen;
    return (
      <View style={[ui.card, s.row, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]} testID={`shop-${item.id}`}>
        <View style={[s.logo, { backgroundColor: c.secondary, borderRadius: c.radius - 3 }]}>
          {logo ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" /> :
            <Text style={[s.initial, { color: c.secondaryForeground }]}>{item.name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.name, { color: c.foreground }]} numberOfLines={1}>{item.name}</Text>
          {item.address ? (
            <View style={s.line}>
              <Feather name="map-pin" size={12} color={c.mutedForeground} />
              <Text style={[s.meta, { color: c.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
            </View>
          ) : null}
          <View style={s.line}>
            {item.category ? <Text style={[s.tag, { color: c.mutedForeground, backgroundColor: c.muted }]}>{item.category}</Text> : null}
            {typeof open === 'boolean' ? (
              <View style={s.line}>
                <View style={[s.dot, { backgroundColor: open ? '#3f9e87' : c.mutedForeground }]} />
                <Text style={[s.meta, { color: c.foreground }]}>{open ? 'Ouverte' : 'Fermée'}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker={q.data ? `${q.data.length} boutique${q.data.length > 1 ? 's' : ''}` : 'Votre réseau'} title="Boutiques" />
      {q.isPending ? <SkeletonCards count={4} /> : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: bottom, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={q.isError ? <Text style={[s.meta, { color: c.destructive, marginBottom: 6 }]}>Actualisation échouée, données affichées possiblement obsolètes : {q.error.message}</Text> : null}
          ListEmptyComponent={<StateView icon="home" title="Aucune boutique" message="Aucune boutique n'est rattachée à votre compte." actionLabel="Actualiser" onAction={() => q.refetch()} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  logo: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: font.bold, fontSize: 20 },
  name: { fontFamily: font.semibold, fontSize: 16 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  meta: { fontFamily: font.regular, fontSize: 13, flexShrink: 1 },
  tag: { fontFamily: font.medium, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
