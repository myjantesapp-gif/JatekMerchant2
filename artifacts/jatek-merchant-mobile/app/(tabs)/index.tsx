import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, LoadingState, PrimaryButton, ScreenFrame, SectionTitle } from '@/components/MerchantUI';
import { Field } from '@/components/MerchantUI';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { merchantQueryKey } from '@/lib/query-client';
import type { DashboardData, DashboardTodo, MerchantShop } from '@/lib/types';
import { money } from '@/lib/types';

export default function MerchantDashboardScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const [todoText, setTodoText] = useState('');
  const dashboard = useQuery<DashboardData>({
    queryKey: merchantQueryKey('/api/backend/dashboard', { range: 'week' }),
  });
  const todos = useQuery<DashboardTodo[]>({
    queryKey: merchantQueryKey('/api/backend/todos'),
  });
  const shops = useQuery<MerchantShop[]>({
    queryKey: merchantQueryKey('/api/backend/shops'),
  });

  const refresh = () => {
    void Promise.all([dashboard.refetch(), todos.refetch(), shops.refetch()]);
  };
  const invalidateDashboard = () => {
    void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
    void client.invalidateQueries({ queryKey: ['/api/backend/todos'] });
  };

  const createTodo = useMutation({
    mutationFn: (text: string) =>
      apiRequest('/api/backend/todos', { method: 'POST', json: { text } }),
    onSuccess: () => {
      setTodoText('');
      invalidateDashboard();
    },
  });
  const toggleTodo = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      apiRequest(`/api/backend/todos/${id}`, { method: 'PATCH', json: { done } }),
    onSuccess: invalidateDashboard,
  });
  const deleteTodo = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/backend/todos/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateDashboard,
  });

  const data = dashboard.data;
  const shop = shops.data?.[0];
  const chartMax = Math.max(1, ...(data?.ordersChart ?? []).map((item) => item.value));

  return (
    <ScreenFrame
      title="Votre service"
      eyebrow="APERÇU DE LA SEMAINE"
      subtitle="Les points clés de votre boutique, en un coup d’œil."
      onRefresh={refresh}
      refreshing={dashboard.isRefetching || todos.isRefetching}
    >
      {dashboard.isLoading ? (
        <LoadingState />
      ) : dashboard.isError ? (
        <LoadingState
          error={dashboard.error instanceof Error ? dashboard.error.message : undefined}
          onRetry={refresh}
        />
      ) : (
        <>
          <View style={styles.metrics}>
            <MetricCard
              label="En cours"
              value={String(data?.inProgressOrders ?? 0)}
              detail="commandes à traiter"
              icon="clock"
              color={colors.primary}
            />
            <MetricCard
              label="Livrées"
              value={String(data?.deliveredOrders ?? 0)}
              detail="cette semaine"
              icon="check-circle"
              color={colors.secondaryForeground}
            />
            <MetricCard
              label="Revenus"
              value={money(data?.merchantEarning ?? 0)}
              detail="part boutique"
              icon="trending-up"
              color={colors.foreground}
            />
            <MetricCard
              label="Indisponibles"
              value={`${data?.outOfStockProducts ?? 0}/${data?.totalProducts ?? 0}`}
              detail="articles du menu"
              icon="slash"
              color={colors.mutedForeground}
            />
          </View>

          <Card>
            <SectionTitle title="Commandes de la semaine" />
            <View style={styles.chart}>
              {(data?.ordersChart ?? []).map((item, index) => {
                const height = Math.max(5, (item.value / chartMax) * 110);
                return (
                  <View key={`${item.label}-${index}`} style={styles.chartColumn}>
                    <Text style={[styles.chartValue, { color: colors.mutedForeground }]}>
                      {item.value}
                    </Text>
                    <View style={[styles.chartTrack, { backgroundColor: colors.muted }]}>
                      <View
                        style={[
                          styles.chartBar,
                          { height, backgroundColor: index === (data?.ordersChart.length ?? 0) - 1 ? colors.primary : colors.sidebar },
                        ]}
                      />
                    </View>
                    <Text numberOfLines={1} style={[styles.chartLabel, { color: colors.mutedForeground }]}>
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card style={[styles.shopCard, { backgroundColor: colors.sidebar }]}>
            <View style={styles.shopTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardKicker, { color: '#c6c9d4' }]}>VOTRE BOUTIQUE</Text>
                <Text style={[styles.shopName, { color: '#ffffff' }]} numberOfLines={1}>
                  {shop?.name ?? 'Ma boutique'}
                </Text>
              </View>
              <Feather name="shopping-bag" size={22} color={colors.accent} />
            </View>
            <View style={styles.shopBottom}>
              <View style={styles.openState}>
                <View
                  style={[
                    styles.openDot,
                    { backgroundColor: shop?.isOpen ? '#74d4a4' : '#f3bd5a' },
                  ]}
                />
                <Text style={[styles.openText, { color: '#ffffff' }]}>
                  {shop?.isOpen ? 'Ouverte aux commandes' : 'Fermée'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                testID="link-shop-profile"
                onPress={() => router.push('/(tabs)/shop')}
                style={styles.shopLink}
              >
                <Text style={[styles.shopLinkText, { color: '#ffffff' }]}>Voir le profil</Text>
                <Feather name="arrow-up-right" size={15} color="#ffffff" />
              </Pressable>
            </View>
            <Text style={[styles.address, { color: '#c6c9d4' }]} numberOfLines={2}>
              {shop?.address || 'Adresse non renseignée'}
            </Text>
          </Card>

          <Card>
            <SectionTitle title="Répartition financière" />
            <FinanceRow label="Votre revenu" value={money(data?.merchantEarning)} strong />
            <FinanceRow label="Livraison" value={money(data?.deliveryEarning)} />
            <FinanceRow label="Taxes" value={money(data?.totalOrderTax)} />
            <FinanceRow label="Commission Jatek" value={money(data?.totalCommission)} />
          </Card>

          <View style={styles.sectionSpacing}>
            <SectionTitle title="Notes de cuisine" />
            <Card>
              <View style={styles.todoComposer}>
                <View style={styles.todoField}>
                  <Field
                    label="Ajouter un rappel"
                    value={todoText}
                    onChangeText={setTodoText}
                    placeholder="Ex. Préparer les sacs de livraison"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (todoText.trim()) createTodo.mutate(todoText.trim());
                    }}
                    testID="input-todo"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter le rappel"
                  testID="button-add-todo"
                  disabled={!todoText.trim() || createTodo.isPending}
                  onPress={() => createTodo.mutate(todoText.trim())}
                  style={({ pressed }) => [
                    styles.addTodo,
                    {
                      backgroundColor: colors.primary,
                      opacity: !todoText.trim() || createTodo.isPending || pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  {createTodo.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather name="plus" size={20} color="#ffffff" />
                  )}
                </Pressable>
              </View>
              {createTodo.isError ? (
                <Text style={[styles.inlineError, { color: colors.destructive }]}>
                  Le rappel n’a pas pu être ajouté.
                </Text>
              ) : null}
              {todos.isLoading ? (
                <ActivityIndicator color={colors.primary} style={styles.todoLoading} />
              ) : todos.isError ? (
                <Pressable onPress={() => void todos.refetch()}>
                  <Text style={[styles.todoHint, { color: colors.destructive }]}>
                    Liste inaccessible. Touchez pour réessayer.
                  </Text>
                </Pressable>
              ) : (todos.data ?? []).length === 0 ? (
                <Text style={[styles.todoHint, { color: colors.mutedForeground }]}>
                  Aucun rappel pour le moment.
                </Text>
              ) : (
                <View style={styles.todoList}>
                  {(todos.data ?? []).slice(0, 8).map((todo) => (
                    <View key={todo.id} style={styles.todoRow}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: todo.done }}
                        accessibilityLabel={`Marquer ${todo.text} comme ${todo.done ? 'à faire' : 'terminé'}`}
                        testID={`button-toggle-todo-${todo.id}`}
                        onPress={() => toggleTodo.mutate({ id: todo.id, done: !todo.done })}
                        style={[
                          styles.todoCheck,
                          {
                            backgroundColor: todo.done ? colors.secondary : 'transparent',
                            borderColor: todo.done ? colors.secondaryForeground : colors.border,
                          },
                        ]}
                      >
                        {todo.done ? (
                          <Feather name="check" size={14} color={colors.secondaryForeground} />
                        ) : null}
                      </Pressable>
                      <Text
                        testID={`text-todo-${todo.id}`}
                        style={[
                          styles.todoText,
                          {
                            color: todo.done ? colors.mutedForeground : colors.foreground,
                            textDecorationLine: todo.done ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {todo.text}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Supprimer ${todo.text}`}
                        testID={`button-delete-todo-${todo.id}`}
                        onPress={() => deleteTodo.mutate(todo.id)}
                        hitSlop={8}
                        style={styles.deleteTodo}
                      >
                        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        </>
      )}
    </ScreenFrame>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
}) {
  const colors = useColors();
  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Feather name={icon} size={16} color={color} />
        <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.metricDetail, { color: colors.mutedForeground }]}>{detail}</Text>
    </Card>
  );
}

function FinanceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.financeRow, { borderColor: colors.border }]}>
      <Text
        style={[
          styles.financeLabel,
          { color: strong ? colors.foreground : colors.mutedForeground, fontWeight: strong ? '800' : '500' },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.financeValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 124, padding: 13 },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metricLabel: { fontSize: 11, fontWeight: '700' },
  metricValue: { marginTop: 12, fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  metricDetail: { marginTop: 3, fontSize: 10 },
  chart: {
    height: 164,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 20,
  },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  chartValue: { fontSize: 10, fontWeight: '700' },
  chartTrack: { width: '70%', height: 112, justifyContent: 'flex-end', borderRadius: 8, overflow: 'hidden' },
  chartBar: { width: '100%', minHeight: 5, borderRadius: 8 },
  chartLabel: { maxWidth: '100%', fontSize: 9, textAlign: 'center' },
  shopCard: { padding: 18, borderColor: 'transparent' },
  shopTop: { flexDirection: 'row', alignItems: 'center' },
  cardKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  shopName: { marginTop: 5, fontSize: 20, fontWeight: '800' },
  shopBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 8 },
  openState: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  openDot: { width: 9, height: 9, borderRadius: 10 },
  openText: { fontSize: 12, fontWeight: '700' },
  shopLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopLinkText: { fontSize: 12, fontWeight: '700' },
  address: { marginTop: 8, fontSize: 11, lineHeight: 16 },
  financeRow: { minHeight: 43, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  financeLabel: { fontSize: 13 },
  financeValue: { fontSize: 13, fontWeight: '800' },
  sectionSpacing: { gap: 4 },
  todoComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  todoField: { flex: 1 },
  addTodo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  inlineError: { marginTop: 8, fontSize: 12 },
  todoHint: { paddingVertical: 20, fontSize: 13, textAlign: 'center' },
  todoLoading: { marginVertical: 20 },
  todoList: { marginTop: 8 },
  todoRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e1dcd4' },
  todoCheck: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  todoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  deleteTodo: { padding: 5 },
});