import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { money } from '@/lib/format';
import {
  useCreateMerchantTodo,
  useDeleteMerchantTodo,
  useMerchantDashboard,
  useMerchantShops,
  useMerchantTodos,
  useToggleMerchantTodo,
} from '@/lib/merchant-parity-data';
import { Button, ErrorState, Skeleton, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const c = useColors();
  return <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }, style]}>{children}</View>;
}

function SectionTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: keyof typeof Feather.glyphMap }) {
  const c = useColors();
  return (
    <View style={s.sectionTitle}>
      <View style={{ flex: 1 }}>
        <Text style={[s.eyebrow, { color: c.mutedForeground }]}>{eyebrow}</Text>
        <Text style={[s.sectionHeading, { color: c.foreground }]}>{title}</Text>
      </View>
      <Feather name={icon} size={19} color={c.primary} />
    </View>
  );
}

function Stat({ label, value, detail, icon, tone }: {
  label: string; value: string; detail: string; icon: keyof typeof Feather.glyphMap; tone: 'primary' | 'secondary' | 'accent' | 'ink';
}) {
  const c = useColors();
  const palette = {
    primary: [c.primary, c.primaryForeground],
    secondary: [c.secondary, c.secondaryForeground],
    accent: [c.accent, c.accentForeground],
    ink: [c.ink, c.inkForeground],
  } as const;
  const [bg, fg] = palette[tone];
  return (
    <Card style={s.stat}>
      <View style={s.statTop}>
        <Text style={[s.eyebrow, { color: c.mutedForeground }]}>{label}</Text>
        <View style={[s.statIcon, { backgroundColor: bg }]}><Feather name={icon} size={16} color={fg} /></View>
      </View>
      <Text style={[s.statValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[s.detail, { color: c.mutedForeground }]}>{detail}</Text>
    </Card>
  );
}

function RefreshButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Actualiser le tableau de bord"
      accessibilityState={{ busy: !!loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [s.refresh, { backgroundColor: c.secondary, opacity: loading ? 0.6 : pressed ? 0.75 : 1 }]}
    >
      <Feather name="refresh-cw" size={16} color={c.secondaryForeground} />
    </Pressable>
  );
}

export default function OverviewScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const bottom = useBottomPad();
  const dashboard = useMerchantDashboard();
  const todos = useMerchantTodos();
  const shops = useMerchantShops();
  const createTodo = useCreateMerchantTodo();
  const toggleTodo = useToggleMerchantTodo();
  const deleteTodo = useDeleteMerchantTodo();
  const [todoText, setTodoText] = useState('');
  const data = dashboard.data;
  const shop = shops.data?.[0];
  const chartMax = Math.max(...(data?.ordersChart.map((entry) => entry.value) ?? [1]), 1);
  const columns = width >= 600 ? 4 : 2;
  const moneyValue = (value?: number | null) => money(value ?? 0);
  const submitTodo = () => {
    const text = todoText.trim();
    if (!text || createTodo.isPending) return;
    createTodo.mutate({ text }, { onSuccess: () => setTodoText('') });
  };
  const refresh = () => {
    void dashboard.refetch();
    void todos.refetch();
    void shops.refetch();
  };
  const todosError = todos.isError && !todos.data;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        kicker="Aujourd'hui dans votre boutique"
        title="Passez un bon service."
        right={<RefreshButton onPress={refresh} loading={dashboard.isRefetching || todos.isRefetching} />}
      />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottom }]}
        refreshControl={<RefreshControl refreshing={dashboard.isRefetching && !dashboard.isPending} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        {dashboard.isPending ? (
          <View style={s.stack}><Skeleton height={92} /><Skeleton height={240} /><Skeleton height={220} /></View>
        ) : dashboard.isError && !data ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        ) : data ? (
          <>
            <View style={s.statsGrid}>
              <Stat label="En cours" value={String(data.inProgressOrders)} detail="Commandes à traiter" icon="clock" tone="primary" />
              <Stat label="Livrées" value={String(data.deliveredOrders)} detail="Sur les 7 derniers jours" icon="check" tone="secondary" />
              <Stat label="Gains boutique" value={moneyValue(data.merchantEarning)} detail={`${moneyValue(data.totalEarned)} valeur brute`} icon="trending-up" tone="accent" />
              <Stat label="Ruptures" value={String(data.outOfStockProducts)} detail={`Sur ${data.totalProducts} articles`} icon="tag" tone="ink" />
            </View>

            <Card>
              <SectionTitle eyebrow="Rythme des commandes" title="Cette semaine" icon="bar-chart-2" />
              <View style={s.chart}>
                {data.ordersChart.length ? data.ordersChart.map((entry) => (
                  <View key={entry.label} style={s.barColumn} accessible accessibilityLabel={`${entry.label}, ${entry.value} commandes`}>
                    <Text style={[s.barValue, { color: c.mutedForeground }]}>{entry.value}</Text>
                    <View style={[s.barTrack, { backgroundColor: c.muted }]}>
                      <View style={[s.bar, { backgroundColor: c.primary, height: `${Math.max((entry.value / chartMax) * 100, 5)}%` }]} />
                    </View>
                    <Text style={[s.barLabel, { color: c.mutedForeground }]} numberOfLines={1}>{entry.label}</Text>
                  </View>
                )) : <Text style={[s.emptyText, { color: c.mutedForeground }]}>Aucune commande sur cette période.</Text>}
              </View>
            </Card>

            <View style={s.twoColumns}>
              <Card style={s.flexCard}>
                <SectionTitle eyebrow="Répartition financière" title="Valeur des commandes" icon="activity" />
                <View style={s.moneyGrid}>
                  {[
                    ['Gain commerçant', data.merchantEarning],
                    ['Gain livreur', data.deliveryEarning],
                    ['Taxes', data.totalOrderTax],
                    ['Commission Jatek', data.totalCommission],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={[s.moneyCell, { backgroundColor: c.muted }]}>
                      <Text style={[s.detail, { color: c.mutedForeground }]}>{label}</Text>
                      <Text style={[s.money, { color: c.foreground }]}>{moneyValue(value as number)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
              <Card style={[s.flexCard, { backgroundColor: c.ink, borderColor: c.ink }]}>
                <Text style={[s.eyebrow, { color: c.inkForeground, opacity: 0.6 }]}>Activité boutique</Text>
                <Text style={[s.shopName, { color: c.inkForeground }]} numberOfLines={2}>{shop?.name || 'Votre boutique'}</Text>
                <View style={s.shopStatus}>
                  <View style={[s.dot, { backgroundColor: shop?.isOpen ? c.secondary : c.mutedForeground }]} />
                  <Text style={[s.shopStatusText, { color: c.inkForeground }]}>{shop?.isOpen ? 'Ouvert aux commandes' : 'Actuellement fermé'}</Text>
                </View>
                <Text style={[s.shopAddress, { color: c.inkForeground }]} numberOfLines={2}>{shop?.address || 'Détails en cours de chargement'}</Text>
                <Button label="Voir la boutique" icon="external-link" variant="outline" onPress={() => router.push('/shop-profile' as never)} accessibilityHint="Ouvrir le profil de la boutique" />
              </Card>
            </View>

            <Card>
              <SectionTitle eyebrow="Votre liste" title="Notes de cuisine" icon="book-open" />
              <View style={s.todoForm}>
                <TextInput
                  accessibilityLabel="Ajouter un rappel de cuisine"
                  placeholder="Ajouter un rappel"
                  placeholderTextColor={c.mutedForeground}
                  value={todoText}
                  onChangeText={setTodoText}
                  onSubmitEditing={submitTodo}
                  returnKeyType="done"
                  style={[s.todoInput, { color: c.foreground, borderColor: c.input, backgroundColor: c.background }]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="Ajouter le rappel" disabled={!todoText.trim() || createTodo.isPending} onPress={submitTodo} style={[s.addButton, { backgroundColor: c.primary, opacity: !todoText.trim() || createTodo.isPending ? 0.5 : 1 }]}>
                  <Feather name="plus" size={18} color={c.primaryForeground} />
                </Pressable>
              </View>
              {todos.isPending ? <View style={s.todoLoading}><Skeleton height={38} /><Skeleton height={38} /></View> :
                todosError ? <View style={s.inlineError}><Text style={[s.detail, { color: c.destructive }]}>Les rappels n'ont pas pu être chargés.</Text><Button label="Réessayer" icon="refresh-cw" variant="outline" onPress={() => void todos.refetch()} /></View> :
                !todos.data?.length ? <Text style={[s.emptyText, { color: c.mutedForeground }]}>Votre liste est vide.</Text> :
                todos.data.slice(0, 5).map((todo) => (
                  <View key={todo.id} style={s.todoRow}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: todo.done }} accessibilityLabel={`Marquer ${todo.text} comme ${todo.done ? 'non terminé' : 'terminé'}`} onPress={() => toggleTodo.mutate({ id: todo.id, done: !todo.done })} style={[s.checkbox, { borderColor: todo.done ? c.secondaryForeground : c.border, backgroundColor: todo.done ? c.secondary : 'transparent' }]}>
                      {todo.done ? <Feather name="check" size={13} color={c.secondaryForeground} /> : null}
                    </Pressable>
                    <Text style={[s.todoText, { color: todo.done ? c.mutedForeground : c.foreground, textDecorationLine: todo.done ? 'line-through' : 'none' }]} numberOfLines={2}>{todo.text}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer ${todo.text}`} hitSlop={8} onPress={() => deleteTodo.mutate({ id: todo.id })} style={s.deleteButton}>
                      <Feather name="trash-2" size={16} color={c.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  stack: { gap: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '46%', flexGrow: 1, minWidth: 140, padding: 14, gap: 5 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 5 },
  statIcon: { width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontFamily: font.displayStrong, fontSize: 23, marginTop: 7 },
  detail: { fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  sectionTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  sectionHeading: { fontFamily: font.display, fontSize: 18, marginTop: 3 },
  chart: { height: 205, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  barColumn: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  barValue: { fontFamily: font.bold, fontSize: 10 },
  barTrack: { width: '100%', maxWidth: 40, height: 145, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontFamily: font.medium, fontSize: 10, maxWidth: 48 },
  twoColumns: { gap: 14 },
  flexCard: { flex: 1 },
  moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moneyCell: { flexBasis: '47%', flexGrow: 1, minHeight: 67, borderRadius: 9, padding: 10, gap: 3 },
  money: { fontFamily: font.bold, fontSize: 15 },
  shopName: { fontFamily: font.display, fontSize: 21, marginTop: 5, marginBottom: 16 },
  shopStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  shopStatusText: { fontFamily: font.semibold, fontSize: 13 },
  shopAddress: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, opacity: 0.65, marginTop: 7, marginBottom: 17 },
  todoForm: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  todoInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontFamily: font.regular, fontSize: 14 },
  addButton: { width: 48, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  todoLoading: { gap: 8, paddingVertical: 8 },
  inlineError: { alignItems: 'flex-start', gap: 8, paddingVertical: 10 },
  emptyText: { textAlign: 'center', fontFamily: font.regular, fontSize: 13, paddingVertical: 22 },
  todoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd4c8', paddingVertical: 7 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  todoText: { flex: 1, fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  deleteButton: { minWidth: 34, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  refresh: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});