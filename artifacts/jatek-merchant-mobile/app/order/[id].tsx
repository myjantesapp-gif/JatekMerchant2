import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useOrder } from '@/lib/merchant-data';
import { dateTime, money, parseExtras } from '@/lib/format';
import { ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';

export default function OrderDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const q = useOrder(orderId);
  const o = q.data;

  if (!Number.isInteger(orderId) || orderId <= 0) return <StateView icon="alert-triangle" title="Commande invalide" />;

  return (
    <>
      <Stack.Screen options={{ title: o ? `#${o.reference || o.id}` : 'Commande' }} />
      {q.isPending ? <SkeletonCards count={3} /> : q.isError && !o ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : o ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 34 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
        >
          {q.isError ? (
            <View style={[s.stale, { backgroundColor: '#d8393514', borderRadius: c.radius }]} testID="detail-refresh-error">
              <Feather name="alert-circle" size={14} color={c.destructive} />
              <Text style={[s.meta, { color: c.destructive, flex: 1 }]}>Actualisation échouée, données affichées possiblement obsolètes : {q.error.message}</Text>
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
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.itemName, { color: c.foreground }]}>{it.menuItemName}</Text>
                    {it.selectedSize ? <Text style={[s.meta, { color: c.mutedForeground }]}>Taille : {it.selectedSize}</Text> : null}
                    {extras.length ? <Text style={[s.meta, { color: c.mutedForeground }]}>+ {extras.join(', ')}</Text> : null}
                  </View>
                  <Text style={[s.itemName, { color: c.foreground }]}>{money(it.totalPrice, o.currency)}</Text>
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
      ) : null}
    </>
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
  total: { fontFamily: font.bold, fontSize: 32, marginTop: 6 },
  heroMeta: { fontFamily: font.regular, fontSize: 13 },
  code: { borderWidth: 1, borderRadius: 10, padding: 10, alignSelf: 'flex-start', marginTop: 8 },
  codeLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2 },
  codeVal: { fontFamily: font.bold, fontSize: 22, letterSpacing: 4 },
  section: { fontFamily: font.bold, fontSize: 17, marginTop: 4 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  qty: { fontFamily: font.bold, fontSize: 15, minWidth: 28 },
  itemName: { fontFamily: font.semibold, fontSize: 15 },
  meta: { fontFamily: font.regular, fontSize: 13 },
});
