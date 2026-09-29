import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useOrders } from '@/lib/merchant-data';
import { dateTime, money, statusInfo } from '@/lib/format';
import { ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import type { Order } from '@/lib/api-core';
import { OrderTimerBadge } from '@/components/OrderTiming';

const ACTIVE = new Set(['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'assigned', 'driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery', 'on_the_way', 'delivering']);
type Filter = 'all' | 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptées' },
  { key: 'preparing', label: 'En préparation' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
] as const;
const EMPTY_FILTER_LABEL: Record<Filter, string> = {
  all: 'Aucune commande',
  pending: 'Aucune commande en attente',
  accepted: 'Aucune commande acceptée',
  preparing: 'Aucune commande en préparation',
  ready: 'Aucune commande prête',
  delivered: 'Aucune commande livrée',
  cancelled: 'Aucune commande annulée',
};

export default function OrdersScreen() {
  const c = useColors();
  const q = useOrders();
  const bottom = useBottomPad();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const horizontalPadding = Math.min(24, Math.max(14, Math.round(width * 0.05)));
  const orders = q.data ?? [];

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    accepted: orders.filter((o) => o.status === 'accepted').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }), [orders]);
  const activeCount = useMemo(() => orders.filter((o) => ACTIVE.has(o.status)).length, [orders]);
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);
  const list = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return orders
      .filter((o) => filter === 'all' || o.status === filter)
      .filter((o) => {
        if (!term) return true;
        return [o.reference, String(o.id), o.userName, o.restaurantName]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(term);
      })
      .sort((a, b) => {
        const aPriority = a.status === 'pending' ? 0 : ACTIVE.has(a.status) ? 1 : 2;
        const bPriority = b.status === 'pending' ? 0 : ACTIVE.has(b.status) ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0);
      });
  }, [orders, filter, search]);

  const renderItem = ({ item }: { item: Order }) => {
    const reference = item.reference || String(item.id);
    return (
      <Pressable
        testID={`order-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Commande ${reference}, ${statusInfo(item.status).label}, ${money(item.total, item.currency)}`}
        accessibilityHint="Ouvrir le détail de la commande et ses actions"
        onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(item.id) } })}
        style={({ pressed }) => [ui.card, s.row, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, opacity: pressed ? 0.84 : 1 }]}
      >
        <View style={[s.bar, { backgroundColor: item.status === 'pending' ? c.accent : ACTIVE.has(item.status) ? c.primary : c.border }]} />
        <View style={s.content}>
          <View style={s.between}>
            <Text style={[s.ref, { color: c.foreground }]} numberOfLines={1}>#{reference}</Text>
            <Text style={[s.total, { color: c.foreground }]} numberOfLines={1}>{money(item.total, item.currency)}</Text>
          </View>
          <Text style={[s.meta, { color: c.mutedForeground }]} numberOfLines={2}>
            {item.userName || 'Client'} · {item.restaurantName || 'Boutique'}
          </Text>
          <View style={s.statusLine}>
            <StatusPill status={item.status} />
            <Text style={[s.meta, s.date, { color: c.mutedForeground }]}>{dateTime(item.createdAt)}</Text>
          </View>
          <OrderTimerBadge order={item} nowMs={nowMs} />
        </View>
        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </Pressable>
    );
  };

  const filterLabel = search.trim() ? 'Aucun résultat' : EMPTY_FILTER_LABEL[filter];
  const emptyMessage = search.trim()
    ? 'Essayez une autre référence, un autre client ou une autre boutique.'
    : 'Les nouvelles commandes de vos boutiques apparaîtront ici. Tirez pour actualiser.';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        kicker={q.data ? pendingCount ? `${pendingCount} à confirmer` : `${activeCount} en cours` : 'Jatek marchand'}
        title="Commandes"
      />
      {q.data ? (
        <>
          <View style={[s.search, { marginHorizontal: horizontalPadding, backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
            <Feather name="search" size={17} color={c.mutedForeground} />
            <TextInput
              testID="orders-search"
              accessibilityLabel="Rechercher une commande"
              value={search}
              onChangeText={setSearch}
              placeholder="Référence, client ou boutique"
              placeholderTextColor={c.mutedForeground}
              returnKeyType="search"
              autoCapitalize="none"
              style={[s.searchInput, { color: c.foreground }]}
            />
            {search ? (
              <Pressable
                testID="orders-search-clear"
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips, { paddingHorizontal: horizontalPadding }]} style={{ flexGrow: 0 }}>
            {FILTERS.map(({ key, label }) => {
              const selected = filter === key;
              const count = key === 'all' ? counts.all : counts[key];
              return (
                <Pressable
                  key={key}
                  testID={`filter-${key}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(key)}
                  style={[s.chip, { backgroundColor: selected ? c.ink : c.card, borderColor: selected ? c.ink : c.border }]}
                >
                  <Text style={[s.chipText, { color: selected ? c.inkForeground : c.foreground }]}>{label} · {count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      {q.isPending ? <SkeletonCards /> : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => String(o.id)}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingHorizontal: horizontalPadding, paddingBottom: bottom }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={q.isError ? (
            <Text accessibilityRole="alert" style={[s.stale, { color: c.destructive }]}>Actualisation échouée. Faites glisser vers le bas pour réessayer.</Text>
          ) : null}
          ListEmptyComponent={<StateView icon={search ? 'search' : 'inbox'} title={filterLabel} message={emptyMessage} actionLabel="Actualiser" onAction={() => q.refetch()} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  content: { flex: 1, minWidth: 0, gap: 7 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statusLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  ref: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  total: { flexShrink: 0, fontFamily: font.bold, fontSize: 15 },
  meta: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  date: { flexShrink: 0, textAlign: 'right' },
  search: { minHeight: 48, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 0, fontFamily: font.regular, fontSize: 14 },
  clear: { minWidth: 32, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 14, minHeight: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: font.semibold, fontSize: 13 },
  list: { paddingTop: 4, gap: 10, flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  stale: { fontFamily: font.medium, fontSize: 12, marginBottom: 6 },
});