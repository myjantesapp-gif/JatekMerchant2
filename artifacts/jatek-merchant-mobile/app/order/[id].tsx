import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, LoadingState, PrimaryButton, ScreenFrame, SectionTitle, StatusBadge } from '@/components/MerchantUI';
import { useColors } from '@/hooks/useColors';
import { apiRequest, getApiUrl, getStoredToken } from '@/lib/api';
import { merchantQueryKey } from '@/lib/query-client';
import type { MerchantOrder } from '@/lib/types';
import { dateLabel, money, nextOrderStatus } from '@/lib/types';

export default function MerchantOrderDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const colors = useColors();
  const client = useQueryClient();
  const orders = useQuery<MerchantOrder[]>({
    queryKey: merchantQueryKey('/api/backend/orders', { limit: 100 }),
    enabled: Number.isInteger(id) && id > 0,
  });
  const current = orders.data?.find((item) => item.id === id);
  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/api/orders/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['/api/backend/orders'] });
      void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
      void orders.refetch();
    },
  });

  const cancelOrder = () => {
    Alert.alert(
      'Annuler cette commande ?',
      'Cette action sera transmise au système de commandes.',
      [
        { text: 'Garder la commande', style: 'cancel' },
        {
          text: 'Annuler la commande',
          style: 'destructive',
          onPress: () => changeStatus.mutate('cancelled'),
        },
      ],
    );
  };

  const openDocument = async (kind: 'receipt' | 'receiptPdf' | 'invoice') => {
    const token = await getStoredToken();
    if (!token) {
      Alert.alert('Session expirée', 'Reconnectez-vous pour consulter ce document.');
      return;
    }
    const path =
      kind === 'receipt'
        ? `/api/orders/${id}/receipt?token=${encodeURIComponent(token)}`
        : kind === 'receiptPdf'
          ? `/api/orders/${id}/receipt.pdf?token=${encodeURIComponent(token)}`
          : `/api/orders/${id}/invoice.pdf?token=${encodeURIComponent(token)}`;
    const url = new URL(path, `${getApiUrl()}/`).toString();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Document indisponible', 'Le document ne peut pas être ouvert pour le moment.');
    }
  };

  const next = current ? nextOrderStatus(current.status) : null;
  const canCancel = current
    ? ['pending', 'accepted', 'confirmed', 'preparing'].includes(current.status)
    : false;

  return (
    <ScreenFrame
      title={current ? `Commande #${current.reference || current.id}` : 'Détail commande'}
      eyebrow="COMMANDE"
      subtitle={current ? dateLabel(current.createdAt) : undefined}
      showSettings={false}
      back={() => router.back()}
      onRefresh={() => void orders.refetch()}
      refreshing={orders.isRefetching}
    >
      {orders.isLoading ? (
        <LoadingState />
      ) : orders.isError || !current ? (
        <LoadingState
          error={orders.error instanceof Error ? orders.error.message : 'Commande introuvable.'}
          onRetry={() => void orders.refetch()}
        />
      ) : (
        <>
          <Card style={styles.statusCard}>
            <View style={styles.statusLine}>
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  STATUT ACTUEL
                </Text>
                <View style={styles.statusSpace}>
                  <StatusBadge status={current.status} />
                </View>
              </View>
              <Feather name="clipboard" size={23} color={colors.primary} />
            </View>
          </Card>

          <Card>
            <SectionTitle title="Client et livraison" />
            <InfoRow label="Client" value={current.userName || 'Client'} />
            <InfoRow label="Adresse" value={current.deliveryAddress || 'Non renseignée'} />
            <InfoRow
              label="Paiement"
              value={
                current.paymentMethod === 'cash'
                  ? 'Espèces'
                  : current.paymentMethod === 'card'
                    ? 'Carte bancaire'
                    : 'En ligne'
              }
            />
            {current.notes ? (
              <View style={[styles.note, { backgroundColor: '#fff4cc' }]}>
                <Feather name="message-square" size={15} color="#725818" />
                <Text style={[styles.noteText, { color: '#55430f' }]}>{current.notes}</Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <SectionTitle title={`Articles · ${current.items?.length ?? 0}`} />
            {(current.items ?? []).length === 0 ? (
              <EmptyState title="Aucun détail disponible" detail="Les lignes d’articles ne sont pas associées à cette commande." />
            ) : (
              <View style={styles.itemsList}>
                {(current.items ?? []).map((item) => (
                  <View key={item.id} style={[styles.itemRow, { borderColor: colors.border }]}>
                    <View style={styles.quantity}>
                      <Text style={[styles.quantityText, { color: colors.primary }]}>
                        {item.quantity}×
                      </Text>
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemName, { color: colors.foreground }]}>
                        {item.menuItemName || 'Article'}
                      </Text>
                      <Text style={[styles.itemUnit, { color: colors.mutedForeground }]}>
                        {money(item.unitPrice)} l’unité
                      </Text>
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.foreground }]}>
                      {money(item.totalPrice)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.totals, { borderColor: colors.border }]}>
              <InfoRow label="Sous-total" value={money(current.subtotal)} />
              {Number(current.discountAmount) > 0 ? (
                <InfoRow label="Remise" value={`−${money(current.discountAmount)}`} />
              ) : null}
              <InfoRow label="Livraison" value={money(current.deliveryFee)} />
              {Number(current.vatAmount) > 0 ? (
                <InfoRow label={`TVA (${current.vatRate ?? 0} %)`} value={money(current.vatAmount)} />
              ) : null}
              {Number(current.serviceFee) > 0 ? (
                <InfoRow label="Frais de service" value={money(current.serviceFee)} />
              ) : null}
              <InfoRow label="Total" value={money(current.total)} strong />
            </View>
          </Card>

          {changeStatus.isError ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Le changement a été refusé. Actualisez la commande et réessayez.
            </Text>
          ) : null}

          {next ? (
            <PrimaryButton
              label={
                next === 'accepted'
                  ? 'Accepter la commande'
                  : next === 'preparing'
                    ? 'Lancer la préparation'
                    : 'Marquer comme prête'
              }
              onPress={() => changeStatus.mutate(next)}
              busy={changeStatus.isPending}
              testID="button-advance-order"
            />
          ) : null}
          {canCancel ? (
            <PrimaryButton
              label="Annuler la commande"
              onPress={cancelOrder}
              disabled={changeStatus.isPending}
              variant="outline"
              testID="button-cancel-order"
            />
          ) : null}

          <Card>
            <SectionTitle title="Documents" />
            <View style={styles.documentActions}>
              <DocumentButton
                icon="printer"
                label="Imprimer le ticket"
                onPress={() => void openDocument('receipt')}
              />
              <DocumentButton
                icon="download"
                label="Ouvrir le ticket PDF"
                onPress={() => void openDocument('receiptPdf')}
              />
              <DocumentButton
                icon="file-text"
                label="Ouvrir la facture PDF"
                onPress={() => void openDocument('invoice')}
              />
            </View>
          </Card>
        </>
      )}
    </ScreenFrame>
  );
}

function InfoRow({
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
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: strong ? colors.foreground : colors.mutedForeground, fontWeight: strong ? '800' : '500' }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: colors.foreground, fontWeight: strong ? '800' : '600' }]}>
        {value}
      </Text>
    </View>
  );
}

function DocumentButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.documentButton,
        { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Feather name={icon} size={17} color={colors.primary} />
      <Text style={[styles.documentLabel, { color: colors.foreground }]}>{label}</Text>
      <Feather name="external-link" size={13} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusCard: { paddingVertical: 13 },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  statusSpace: { marginTop: 8 },
  infoRow: { minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  infoLabel: { flex: 1, fontSize: 12 },
  infoValue: { maxWidth: '62%', fontSize: 12, textAlign: 'right' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, marginTop: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  itemsList: { marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  quantity: { minWidth: 33 },
  quantityText: { fontSize: 13, fontWeight: '800' },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemUnit: { marginTop: 3, fontSize: 10 },
  itemTotal: { fontSize: 12, fontWeight: '800' },
  totals: { marginTop: 12, borderTopWidth: 1, paddingTop: 6 },
  errorText: { fontSize: 12, lineHeight: 18 },
  documentActions: { gap: 8, marginTop: 12 },
  documentButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 13 },
  documentLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
});