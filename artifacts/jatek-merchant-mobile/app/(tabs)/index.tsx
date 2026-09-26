import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useOrders } from '@/lib/merchant-data';
import { dateTime, money, statusInfo } from '@/lib/format';
import { ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import type { Order } from '@/lib/api-core';

const ACTIVE = new Set(['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'assigned', 'driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery', 'on_the_way', 'delivering']);
const CLOSED = new Set(['delivered', 'cancelled']);
type Filter = 'all' | 'active' | 'done';

export default function OrdersScreen() {
  const c = useColors();
  const q = useOrders();
  const bottom = useBottomPad();
  const [filter, setFilter] = useState<Filter>('all');
  const orders = q.data;
  const list = useMemo(() => (orders ?? []).filter((o) =>
    filter === 'all' ? true : filter === 'active' ? ACTIVE.has(o.status) : CLOSED.has(o.status)), [orders, filter]);
  const activeCount = useMemo(() => (orders ?? []).filter((o) => ACTIVE.has(o.status)).length, [orders]);

  const renderItem = ({ item }: { item: Order }) => (
    <Pressable
      testID={`order-${item.id}`}
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(item.id) } })}
      style={({ pressed }) => [ui.card, s.row, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[s.bar, { backgroundColor: ACTIVE.has(item.status) ? c.primary : c.border }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.between}>
          <Text style={[s.ref, { color: c.foreground }]}>#{item.reference || item.id}</Text>
          <Text style={[s.total, { color: c.foreground }]}>{money(item.total, item.currency)}</Text>
        </View>
        <Text style={[s.meta, { color: c.mutedForeground }]} numberOfLines={1}>
          {item.userName || 'Client'} · {item.restaurantName || 'Boutique'}
        </Text>
        <View style={s.between}>
          <StatusPill status={item.status} />
          <Text style={[s.meta, { color: c.mutedForeground }]}>{dateTime(item.createdAt)}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker={q.data ? `${activeCount} en cours` : 'Jatek marchand'} title="Commandes" />
      {q.data ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ flexGrow: 0 }}>
          {([['all', 'Toutes'], ['active', 'En cours'], ['done', 'Clôturées']] as const).map(([k, label]) => {
            const on = filter === k;
            return (
              <Pressable key={k} testID={`filter-${k}`} onPress={() => setFilter(k)}
                style={[s.chip, { backgroundColor: on ? c.ink : c.card, borderColor: on ? c.ink : c.border }]}>
                <Text style={[s.chipText, { color: on ? c.inkForeground : c.foreground }]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {q.isPending ? <SkeletonCards /> : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => String(o.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: bottom, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={q.isError ? (
            <Text style={[s.stale, { color: c.destructive }]}>Actualisation échouée, données affichées possiblement obsolètes : {q.error.message}</Text>
          ) : null}
          ListEmptyComponent={
            <StateView icon="inbox" title={filter === 'all' ? 'Aucune commande' : `Aucune commande ${statusInfo(filter === 'active' ? 'pending' : 'delivered') && (filter === 'active' ? 'en cours' : 'clôturée')}`}
              message="Les nouvelles commandes de vos boutiques apparaîtront ici. Tirez pour actualiser." actionLabel="Actualiser" onAction={() => q.refetch()} />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ref: { fontFamily: font.bold, fontSize: 15 },
  total: { fontFamily: font.bold, fontSize: 15 },
  meta: { fontFamily: font.regular, fontSize: 13 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: font.semibold, fontSize: 13 },
  stale: { fontFamily: font.medium, fontSize: 12, marginBottom: 6 },
});
