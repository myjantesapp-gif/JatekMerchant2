import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, Field, LoadingState, PrimaryButton, ScreenFrame, StatusBadge } from '@/components/MerchantUI';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { merchantQueryKey } from '@/lib/query-client';
import type { MerchantOrder } from '@/lib/types';
import { dateLabel, money, nextOrderStatus } from '@/lib/types';

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'ready', label: 'Prêtes' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
];

export default function MerchantOrdersScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const orders = useQuery<MerchantOrder[]>({
    queryKey: merchantQueryKey('/api/backend/orders', {
      status: filter === 'all' ? undefined : filter,
      search: search.trim() || undefined,
      limit: 100,
    }),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/orders/${id}/status`, {
        method: 'PATCH',
        json: { status },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['/api/backend/orders'] });
      void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
    },
  });

  return (
    <ScreenFrame
      title="Commandes"
      eyebrow="TABLEAU DE SERVICE"
      subtitle="Suivez les commandes et faites avancer la préparation."
      onRefresh={() => void orders.refetch()}
      refreshing={orders.isRefetching}
    >
      <Field
        label="Rechercher"
        value={search}
        onChangeText={setSearch}
        placeholder="Référence, client, boutique…"
        testID="input-order-search"
        autoCorrect={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((item) => {
          const selected = filter === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`button-filter-${item.value}`}
              onPress={() => setFilter(item.value)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selected ? colors.sidebar : colors.muted,
                  borderColor: selected ? colors.sidebar : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selected ? '#ffffff' : colors.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {updateStatus.isError ? (
        <Text style={[styles.mutationError, { color: colors.destructive }]}>
          Le statut n’a pas été modifié. Actualisez la commande puis réessayez.
        </Text>
      ) : null}
      {orders.isLoading ? (
        <LoadingState />
      ) : orders.isError ? (
        <LoadingState
          error={orders.error instanceof Error ? orders.error.message : undefined}
          onRetry={() => void orders.refetch()}
        />
      ) : (orders.data ?? []).length === 0 ? (
        <EmptyState
          title="Aucune commande"
          detail={search ? 'Essayez une autre recherche ou un autre filtre.' : 'Les nouvelles commandes apparaîtront ici.'}
          icon="package"
        />
      ) : (
        <View style={styles.orderList}>
          {(orders.data ?? []).map((order) => {
            const next = nextOrderStatus(order.status);
            return (
              <Card key={order.id} style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View style={styles.orderIdentity}>
                    <Text style={[styles.reference, { color: colors.foreground }]}>
                      #{order.reference || order.id}
                    </Text>
                    <Text style={[styles.orderTime, { color: colors.mutedForeground }]}>
                      {dateLabel(order.createdAt)}
                    </Text>
                  </View>
                  <StatusBadge status={order.status} />
                </View>
                <View style={[styles.orderDivider, { borderColor: colors.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Voir la commande ${order.reference || order.id}`}
                  testID={`row-order-${order.id}`}
                  onPress={() =>
                    router.push({
                      pathname: '/order/[id]',
                      params: { id: String(order.id) },
                    })
                  }
                  style={styles.orderSummary}
                >
                  <View style={styles.orderIcon}>
                    <Feather name="shopping-bag" size={17} color={colors.primary} />
                  </View>
                  <View style={styles.orderDetails}>
                    <Text style={[styles.customer, { color: colors.foreground }]} numberOfLines={1}>
                      {order.userName || 'Client'}
                    </Text>
                    <Text style={[styles.orderMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {order.items?.length ?? 0} article{order.items?.length === 1 ? '' : 's'}
                      {order.restaurantName ? ` · ${order.restaurantName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.orderAmount}>
                    <Text style={[styles.total, { color: colors.foreground }]}>
                      {money(order.total)}
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </View>
                </Pressable>
                {next ? (
                  <PrimaryButton
                    label={
                      updateStatus.isPending && updateStatus.variables?.id === order.id
                        ? 'Mise à jour…'
                        : next === 'accepted'
                          ? 'Accepter la commande'
                          : next === 'preparing'
                            ? 'Lancer la préparation'
                            : 'Marquer comme prête'
                    }
                    onPress={() => updateStatus.mutate({ id: order.id, status: next })}
                    busy={updateStatus.isPending && updateStatus.variables?.id === order.id}
                    disabled={updateStatus.isPending}
                    variant={next === 'accepted' ? 'primary' : 'soft'}
                    testID={`button-advance-order-${order.id}`}
                    icon={
                      updateStatus.isPending && updateStatus.variables?.id === order.id
                        ? undefined
                        : <Feather name="arrow-up-right" size={16} color={next === 'accepted' ? '#ffffff' : colors.secondaryForeground} />
                    }
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8, paddingVertical: 14 },
  filterPill: { minHeight: 38, borderWidth: 1, borderRadius: 100, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 11, fontWeight: '800' },
  mutationError: { fontSize: 12, lineHeight: 18 },
  orderList: { gap: 11 },
  orderCard: { padding: 14, gap: 12 },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderIdentity: { flex: 1 },
  reference: { fontSize: 16, fontWeight: '800' },
  orderTime: { marginTop: 3, fontSize: 11 },
  orderDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  orderSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#f7e6ed', alignItems: 'center', justifyContent: 'center' },
  orderDetails: { flex: 1, minWidth: 0 },
  customer: { fontSize: 13, fontWeight: '800' },
  orderMeta: { marginTop: 4, fontSize: 11 },
  orderAmount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  total: { fontSize: 14, fontWeight: '800' },
});