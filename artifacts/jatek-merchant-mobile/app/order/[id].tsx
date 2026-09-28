import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { nextMerchantOrderStatus, useOrder, useUpdateOrderStatus } from '@/lib/merchant-data';
import { dateTime, money, parseExtras } from '@/lib/format';
import { Button, ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';

export default function OrderDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const q = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const o = q.data;
  const nextStatus = o ? nextMerchantOrderStatus(o.status) : null;
  const action = nextStatus === 'accepted'
    ? { label: 'Accepter la commande', icon: 'check-circle' as const }
    : nextStatus === 'preparing'
      ? { label: 'Lancer la préparation', icon: 'play-circle' as const }
      : nextStatus === 'ready'
        ? { label: 'Marquer prête', icon: 'check' as const }
        : null;
  const horizontalPadding = width < 360 ? 14 : 16;

  if (!Number.isInteger(orderId) || orderId <= 0) return <StateView icon="alert-triangle" title="Commande invalide" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: o ? `#${o.reference || o.id}` : 'Commande' }} />
      {q.isPending ? <SkeletonCards count={3} /> : q.isError && !o ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : o ? (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: horizontalPadding,
              paddingTop: 16,
              paddingBottom: action ? 24 : insets.bottom + 34,
              gap: 14,
              width: '100%',
              maxWidth: 840,
              alignSelf: 'center',
            }}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          >
            {q.isError ? (
              <View accessibilityRole="alert" style={[s.stale, { backgroundColor: '#d8393514', borderRadius: c.radius }]} testID="detail-refresh-error">
                <Feather name="alert-circle" size={14} color={c.destructive} />
                <Text style={[s.meta, { color: c.destructive, flex: 1 }]}>Actualisation échouée. Faites glisser vers le bas pour réessayer.</Text>
              </View>
            ) : null}
            <View style={[s.hero, { backgroundColor: c.ink, borderRadius: c.radius + 4 }]}>
              <StatusPill status={o.status} />
              <Text style={[s.total, { color: c.inkForeground }]}>{money(o.total, o.currency)}</Text>
              <Text style={[s.heroMeta, { color: '#b9b3aa' }]}>{dateTime(o.createdAt)} · {o.deliveryType === 'scheduled' ? 'Programmée' : 'Dès que possible'}</Text>
              {o.kitchenCode ? (
                <View style={[s.code, { borderColor: c.accent }]}>
                  <Text style={[s.codeLabel, { color: c.accent }]}>CODE CUISINE</Text>
                  <Text style={[s.codeVal, { color: c.inkForeground }]}>{o.kitchenCode}</Text>
                </View>
              ) : null}
            </View>

            <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 12 }]}>
              <Info icon="user" label="Client" value={o.userName || '—'} />
              <Info icon="home" label="Boutique" value={o.restaurantName || '—'} />
              <Info icon="map-pin" label="Adresse" value={o.deliveryAddress || '—'} />
              {o.notes ? <Info icon="message-square" label="Note" value={o.notes} /> : null}
            </View>

            <Text style={[s.section, { color: c.foreground }]}>Articles ({o.items.length})</Text>
            <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, paddingVertical: 4 }]}>
              {o.items.length === 0 ? <Text style={[s.meta, { color: c.mutedForeground, paddingVertical: 12 }]}>Aucun article renvoyé pour cette commande.</Text> : null}
              {o.items.map((it, i) => {
                const extras = parseExtras(it.selectedExtras);
                return (
                  <View key={it.id} style={[s.item, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}>
                    <Text style={[s.qty, { color: c.primary }]}>{it.quantity}×</Text>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[s.itemName, { color: c.foreground }]}>{it.menuItemName}</Text>
                      {it.selectedSize ? <Text style={[s.meta, { color: c.mutedForeground }]}>Taille : {it.selectedSize}</Text> : null}
                      {extras.length ? <Text style={[s.meta, { color: c.mutedForeground }]}>+ {extras.join(', ')}</Text> : null}
                    </View>
                    <Text style={[s.itemName, s.itemPrice, { color: c.foreground }]}>{money(it.totalPrice, o.currency)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 8 }]}>
              <Line label="Sous-total" value={money(o.subtotal, o.currency)} />
              <Line label="Livraison" value={money(o.deliveryFee, o.currency)} />
              {o.serviceFee ? <Line label="Frais de service" value={money(o.serviceFee, o.currency)} /> : null}
              {o.discountAmount ? <Line label="Remise" value={`- ${money(o.discountAmount, o.currency)}`} /> : null}
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
              <Line label="Total" value={money(o.total, o.currency)} strong />
            </View>
          </ScrollView>
          {action && nextStatus ? (
            <View style={[s.actionFooter, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.card, borderTopColor: c.border }]} testID="order-action-footer">
              {updateStatus.isError ? (
                <View accessibilityRole="alert" style={[s.actionError, { backgroundColor: '#d8393514', borderRadius: c.radius }]}>
                  <Feather name="alert-circle" size={16} color={c.destructive} />
                  <Text style={[s.meta, { color: c.destructive, flex: 1 }]}>
                    {updateStatus.error instanceof Error ? updateStatus.error.message : 'Mise à jour impossible. Réessayez.'}
                  </Text>
                </View>
              ) : null}
              <Button
                testID="order-status-action"
                label={action.label}
                icon={action.icon}
                loading={updateStatus.isPending}
                onPress={() => updateStatus.mutate({ id: orderId, status: nextStatus })}
                accessibilityHint="Mettre à jour le statut et prévenir le client"
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Info({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Feather name={icon} size={16} color={c.mutedForeground} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.meta, { color: c.mutedForeground }]}>{label}</Text>
        <Text style={[s.itemName, { color: c.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[strong ? s.itemName : s.meta, { color: strong ? c.foreground : c.mutedForeground }]}>{label}</Text>
      <Text style={[s.itemName, { color: c.foreground }, strong && { fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { padding: 20, gap: 8 },
  stale: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' },
  actionFooter: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actionError: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-start' },
  total: { fontFamily: font.bold, fontSize: 32, marginTop: 6 },
  heroMeta: { fontFamily: font.regular, fontSize: 13 },
  code: { borderWidth: 1, borderRadius: 10, padding: 10, alignSelf: 'flex-start', marginTop: 8 },
  codeLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2 },
  codeVal: { fontFamily: font.bold, fontSize: 22, letterSpacing: 4 },
  section: { fontFamily: font.bold, fontSize: 17, marginTop: 4 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  itemPrice: { flexShrink: 0, textAlign: 'right' },
  qty: { fontFamily: font.bold, fontSize: 15, minWidth: 28 },
  itemName: { fontFamily: font.semibold, fontSize: 15 },
  meta: { fontFamily: font.regular, fontSize: 13 },
});
