import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useOrders } from '@/lib/merchant-data';
import { dateTime, money, statusInfo } from '@/lib/format';
import { ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';
import type { Order } from '@/lib/api-core';
import { OrderTimerBadge } from '@/components/OrderTiming';
import { countOrdersByFilter, filterAndSortOrders, isActiveOrderStatus, ORDER_FILTERS, type OrderFilter } from '@/lib/order-list';

const EMPTY_FILTER_LABEL: Record<OrderFilter, string> = {
  all: 'Aucune commande',
  pending: 'Aucune commande à confirmer',
  preparing: 'Aucune commande en préparation',
  ready: 'Aucune commande prête',
  delivery: 'Aucune commande en livraison',
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
  const horizontalPadding = width < 350 ? 12 : width < 600 ? 16 : Math.min(24, Math.round(width * 0.05));
  const orders = q.data ?? [];

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => countOrdersByFilter(orders), [orders]);
  const activeCount = useMemo(() => orders.filter((o) => isActiveOrderStatus(o.status) && o.status !== 'pending').length, [orders]);
  const pendingCount = counts.pending;
  const list = useMemo(() => filterAndSortOrders(orders, filter, search), [orders, filter, search]);

  const renderItem = ({ item }: { item: Order }) => {
    const reference = item.reference || String(item.id);
    return (
      <Pressable
        testID={`order-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Commande ${reference}, ${statusInfo(item.status).label}, ${item.userName || 'Client'}, ${money(item.total, item.currency)}`}
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
          <View style={s.detailLine}>
            <Feather name="user" size={13} color={c.mutedForeground} />
            <Text style={[s.meta, s.detailText, { color: c.mutedForeground }]} numberOfLines={1}>{item.userName || 'Client'}</Text>
          </View>
          <View style={s.detailLine}>
            <Feather name="shopping-bag" size={13} color={c.mutedForeground} />
            <Text style={[s.meta, s.detailText, { color: c.mutedForeground }]} numberOfLines={1}>{item.restaurantName || 'Boutique'}</Text>
          </View>
          <View style={s.statusLine}>
            <StatusPill status={item.status} />
            <View style={s.dateLine}>
              <Feather name="clock" size={12} color={c.mutedForeground} />
              <Text style={[s.meta, s.date, { color: c.mutedForeground }]} numberOfLines={1}>{dateTime(item.createdAt)}</Text>
            </View>
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
      <View style={s.controls}>
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
          <View style={[s.filterHeader, { paddingHorizontal: horizontalPadding }]}>
            <View>
              <Text style={[s.filterTitle, { color: c.foreground }]}>Statut des commandes</Text>
              <Text style={[s.filterSubtitle, { color: c.mutedForeground }]}>
                {list.length} sur {orders.length} {orders.length > 1 ? 'commandes' : 'commande'}
              </Text>
            </View>
            {filter !== 'all' || search.trim() ? (
              <Pressable
                testID="orders-clear-filters"
                accessibilityRole="button"
                accessibilityLabel="Effacer les filtres et la recherche"
                onPress={() => { setFilter('all'); setSearch(''); }}
                style={s.resetButton}
              >
                <Text style={[s.resetText, { color: c.primary }]}>Effacer</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[s.chips, { paddingHorizontal: horizontalPadding }]}>
            {ORDER_FILTERS.map(({ key, label }) => {
              const selected = filter === key;
              const count = counts[key];
              return (
                <Pressable
                  key={key}
                  testID={`filter-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${count} ${count > 1 ? 'commandes' : 'commande'}`}
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(key)}
                  style={[s.chip, { backgroundColor: selected ? c.ink : c.card, borderColor: selected ? c.ink : c.border }]}
                >
                  <Text style={[s.chipText, { color: selected ? c.inkForeground : c.foreground }]} numberOfLines={1}>{label}</Text>
                  <View style={[s.chipCount, { backgroundColor: selected ? c.inkForeground : c.muted }]}>
                    <Text style={[s.chipCountText, { color: selected ? c.ink : c.mutedForeground }]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
      </View>
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
  content: { flex: 1, minWidth: 0, gap: 7, paddingVertical: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statusLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  detailText: { flex: 1 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  ref: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  total: { flexShrink: 0, fontFamily: font.bold, fontSize: 15 },
  meta: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  date: { flexShrink: 0, textAlign: 'right' },
  controls: { paddingBottom: 8 },
  search: { minHeight: 48, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 0, fontFamily: font.regular, fontSize: 14 },
  clear: { minWidth: 32, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 },
  filterTitle: { fontFamily: font.semibold, fontSize: 14 },
  filterSubtitle: { fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  resetButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  resetText: { fontFamily: font.semibold, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, minHeight: 42, maxWidth: '100%', borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  chipText: { flexShrink: 1, fontFamily: font.semibold, fontSize: 12 },
  chipCount: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontFamily: font.bold, fontSize: 11, textAlign: 'center' },
  list: { paddingTop: 4, gap: 10, flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  stale: { fontFamily: font.medium, fontSize: 12, marginBottom: 6 },
});