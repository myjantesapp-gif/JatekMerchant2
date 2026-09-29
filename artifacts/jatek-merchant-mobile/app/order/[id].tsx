import React from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { nextMerchantOrderStatus, useOrder, useUpdateOrderStatus } from '@/lib/merchant-data';
import { dateTime, money, parseExtras } from '@/lib/format';
import { Button, ErrorState, SkeletonCards, StateView, StatusPill, font, styles as ui } from '@/components/ui';
import { API_BASE_URL, ApiError, buildApiUrl, frenchMessage } from '@/lib/api-core';
import { getSessionToken, notifyUnauthorized } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';
import { useOrderContext } from '@/lib/order-context';
import { OrderTimerBadge, OrderTimestampSummary } from '@/components/OrderTiming';
import { statusInfo } from '@/lib/format';

const cancellableStatuses = new Set(['pending', 'accepted', 'confirmed', 'preparing']);
const PREP_TIMES = [15, 20, 30, 45] as const;

function receiptUrl(id: number, token: string) {
  return `${API_BASE_URL}/api/orders/${id}/receipt?token=${encodeURIComponent(token)}`;
}

export default function OrderDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const q = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const orderActions = useOrderContext();
  const { token } = useAuth();
  const [documentError, setDocumentError] = React.useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState(20);
  const [workflowError, setWorkflowError] = React.useState('');
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const cancelOrder = useMutation({
    mutationFn: async () => {
      const capturedToken = token || getSessionToken();
      if (!capturedToken) throw new ApiError(401, 'Session absente.');
      const response = await fetch(buildApiUrl(`/api/orders/${orderId}/status`), {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${capturedToken}` },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!response.ok) {
        if (response.status === 401) notifyUnauthorized(capturedToken);
        throw new ApiError(response.status, frenchMessage(response.status));
      }
      return response;
    },
    onSuccess: () => void q.refetch(),
  });
  const o = q.data;
  const nextStatus = o ? nextMerchantOrderStatus(o.status) : null;
  const action = nextStatus === 'accepted'
    ? { label: 'Accepter la commande', icon: 'check-circle' as const }
    : nextStatus === 'preparing'
      ? { label: 'Lancer la préparation', icon: 'play-circle' as const }
      : nextStatus === 'ready'
        ? { label: 'Marquer prête', icon: 'check' as const }
        : null;
  const canPrintOrderDocument = !!o && ['accepted', 'confirmed', 'preparing', 'ready'].includes(o.status);
  const printButtonLabel = o?.status === 'ready' ? 'Imprimer le reçu' : 'Imprimer le ticket';
  const horizontalPadding = width < 360 ? 14 : 16;
  const busy = updateStatus.isPending || cancelOrder.isPending || orderActions.isBusy;

  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (o) setPrepTimeMinutes(o.prepTimeMinutes || 20);
  }, [o?.id]);

  const advanceOrder = async () => {
    if (!o || !nextStatus) return;
    setWorkflowError('');
    try {
      if (Platform.OS === 'android') {
        if (o.status === 'pending') {
          const printError = await orderActions.acceptAndStart(orderId, prepTimeMinutes);
          if (printError) setDocumentError(printError);
        } else if (nextStatus === 'ready') {
          const printError = await orderActions.markReady(orderId);
          if (printError) setDocumentError(printError);
        } else {
          await updateStatus.mutateAsync({ id: orderId, status: nextStatus });
        }
        await q.refetch();
        return;
      }
      if (o.status === 'pending') {
        await updateStatus.mutateAsync({ id: orderId, status: 'accepted', prepTimeMinutes });
        void printOrderDocument();
        await updateStatus.mutateAsync({ id: orderId, status: 'preparing' });
        await q.refetch();
        return;
      }
      await updateStatus.mutateAsync({ id: orderId, status: nextStatus });
      await q.refetch();
      if (nextStatus === 'ready') void printOrderDocument();
    } catch {
      setWorkflowError('L’acceptation ou le changement de statut a échoué. Actualisez la commande avant de réessayer.');
      void q.refetch();
    }
  };

  const confirmCancel = () => {
    const run = () => cancelOrder.mutate();
    if (Platform.OS === 'web') {
      if (window.confirm('Voulez-vous vraiment annuler cette commande ?')) run();
    } else {
      Alert.alert('Annuler la commande ?', 'Cette action ne peut pas être annulée.', [
        { text: 'Garder la commande', style: 'cancel' },
        { text: 'Annuler', style: 'destructive', onPress: run },
      ]);
    }
  };

  const printOrderDocument = async () => {
    if (Platform.OS === 'android') {
      if (!o) return;
      setDocumentError('');
      try {
        if (o.status === 'ready') await orderActions.printOrderReceipt(o);
        else await orderActions.printKitchenTicket(o);
      } catch (error) {
        setDocumentError(error instanceof Error ? error.message : 'Impossible d’imprimer la commande.');
      }
      return;
    }
    const capturedToken = token || getSessionToken();
    if (!capturedToken) {
      setDocumentError('Session absente. Reconnectez-vous puis réessayez.');
      return;
    }
    setDocumentError('');
    try {
      const opened = await Linking.openURL(receiptUrl(orderId, capturedToken));
      void opened;
    } catch {
      setDocumentError('Impossible d’ouvrir le document à imprimer. Vérifiez votre connexion puis réessayez.');
    }
  };

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
              <OrderTimerBadge order={o} nowMs={nowMs} />
              {o.status === 'preparing' ? <Text style={[s.heroMeta, { color: '#b9b3aa' }]}>Délai annoncé : {o.prepTimeMinutes || 20} min</Text> : null}
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
            <Text style={[s.section, { color: c.foreground }]}>Temps de traitement</Text>
            <OrderTimestampSummary order={o} />

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
          {o && (action || cancellableStatuses.has(o.status) || canPrintOrderDocument || documentError || workflowError) ? (
            <View style={[s.actionFooter, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.card, borderTopColor: c.border }]} testID="order-action-footer">
              {(updateStatus.isError || cancelOrder.isError || documentError || workflowError) ? (
                <View accessibilityRole="alert" style={[s.actionError, { backgroundColor: '#d8393514', borderRadius: c.radius }]}>
                  <Feather name="alert-circle" size={16} color={c.destructive} />
                  <Text style={[s.meta, { color: c.destructive, flex: 1 }]}>
                    {documentError || workflowError || (cancelOrder.error instanceof Error ? cancelOrder.error.message : updateStatus.error instanceof Error ? updateStatus.error.message : 'Mise à jour impossible. Réessayez.')}
                  </Text>
                </View>
              ) : null}
              {o.status === 'pending' ? (
                <View style={[s.prepPicker, { borderColor: c.border, borderRadius: c.radius, backgroundColor: c.background }]} testID="prep-time-picker">
                  <Text style={[s.itemName, { color: c.foreground }]}>Temps de préparation estimé</Text>
                  <View style={s.prepOptions}>
                    {PREP_TIMES.map((minutes) => {
                      const selected = prepTimeMinutes === minutes;
                      return (
                        <Pressable
                          key={minutes}
                          testID={`prep-time-${minutes}`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${minutes} minutes`}
                          onPress={() => setPrepTimeMinutes(minutes)}
                          style={[s.prepOption, { backgroundColor: selected ? c.primary : c.card, borderColor: selected ? c.primary : c.border }]}
                        >
                          <Text style={[s.prepOptionText, { color: selected ? c.primaryForeground : c.foreground }]}>{minutes} min</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View style={s.actionRow}>
                {action && nextStatus ? <Button testID="order-status-action" label={o.status === 'pending' ? 'Accepter et lancer la préparation' : action.label} icon={action.icon} loading={busy} onPress={() => void advanceOrder()} accessibilityHint="Mettre à jour le statut et prévenir le client" /> : null}
                {cancellableStatuses.has(o.status) ? <Button testID="order-cancel-action" label="Annuler" icon="x-circle" variant="danger" loading={busy} onPress={confirmCancel} /> : null}
              </View>
              <View style={s.actionRow}>
                {canPrintOrderDocument ? (
                  <Button
                    testID={o.status === 'ready' ? 'order-print-receipt' : 'order-print-ticket'}
                    label={printButtonLabel}
                    icon="printer"
                    variant="outline"
                    disabled={busy}
                    onPress={() => void printOrderDocument()}
                    accessibilityHint={o.status === 'ready' ? 'Ouvrir le reçu de commande pour impression' : 'Ouvrir le ticket de cuisine pour impression'}
                  />
                ) : null}
              </View>
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
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionError: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-start' },
  prepPicker: { gap: 10, borderWidth: 1, padding: 12 },
  prepOptions: { flexDirection: 'row', gap: 8 },
  prepOption: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 4 },
  prepOptionText: { fontFamily: font.bold, fontSize: 13 },
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
