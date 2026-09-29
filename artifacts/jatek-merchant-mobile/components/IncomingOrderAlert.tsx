import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { Button, font } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import type { Order } from '@/lib/api-core';
import { money, parseExtras } from '@/lib/format';
import { useOrderContext } from '@/lib/order-context';
import { useOrder, useOrders } from '@/lib/merchant-data';

const PREP_TIMES = [10, 15, 20, 30] as const;
const alertSound = require('@/assets/sounds/order-alert.wav');

export function IncomingOrderAlertHost() {
  const orderFeed = useOrders();
  const pendingOrders = useMemo(
    () => (orderFeed.data ?? [])
      .filter((order) => order.status === 'pending')
      .sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0)),
    [orderFeed.data],
  );

  return <IncomingOrderAlert pendingOrders={pendingOrders} loading={orderFeed.isPending} />;
}
export function IncomingOrderAlert({ pendingOrders, loading }: { pendingOrders: Order[]; loading: boolean }) {
  const c = useColors();
  const pathname = usePathname();
  const orderActions = useOrderContext();
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(15);
  const [refusalOpen, setRefusalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const activeOrder = pendingOrders[0] ?? null;
  const details = useOrder(activeOrder?.id ?? 0);
  const player = useAudioPlayer(alertSound);
  const busy = orderActions.isBusy;

  useEffect(() => {
    player.loop = true;
    player.volume = 0.8;
    if (activeOrder) {
      player.play();
    } else {
      player.pause();
      void player.seekTo(0);
    }
    return () => {
      player.pause();
    };
  }, [activeOrder?.id, player]);

  useEffect(() => {
    setPrepTimeMinutes(15);
    setRefusalOpen(false);
    setReason('');
    setActionError('');
  }, [activeOrder?.id]);

  const itemCount = useMemo(() => details.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [details.data?.items]);

  const accept = async () => {
    if (!activeOrder) return;
    setActionError('');
    try {
      const printError = await orderActions.acceptAndStart(activeOrder.id, prepTimeMinutes);
      if (printError) {
        if (Platform.OS === 'web') window.alert(`Commande acceptée. ${printError}`);
        else Alert.alert('Commande acceptée', `L’impression automatique a échoué : ${printError}`);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La commande n’a pas pu être acceptée.');
    }
  };

  const reject = async () => {
    if (!activeOrder) return;
    const normalized = reason.trim();
    if (normalized.length < 3) {
      setActionError('Indiquez un motif de refus (au moins 3 caractères).');
      setRefusalOpen(true);
      return;
    }
    setActionError('');
    try {
      await orderActions.reject(activeOrder.id, normalized);
      setRefusalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Le refus de la commande a échoué.');
    }
  };

  return (
    <Modal
      visible={!!activeOrder && !loading && !pathname.endsWith('/orders')}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => { /* A pending order must be accepted or refused. */ }}
    >
      <View style={[s.screen, { backgroundColor: c.ink }]}>
        <View style={s.topline}>
          <View style={s.liveDot} />
          <Text style={s.eyebrow}>NOUVELLE COMMANDE</Text>
          <Text style={s.count}>{pendingOrders.length > 1 ? `+${pendingOrders.length - 1}` : ''}</Text>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.title}>#{activeOrder?.reference || activeOrder?.id}</Text>
          <Text style={s.subtitle}>{activeOrder?.restaurantName || 'Boutique'} · {activeOrder?.userName || 'Client'}</Text>
          <Pressable
            testID="incoming-order-see-list"
            accessibilityRole="button"
            accessibilityLabel="Voir la liste des commandes"
            onPress={() => router.push('/(tabs)/orders')}
            style={({ pressed }) => [s.listButton, { borderColor: '#514d47', opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="list" size={15} color="#f2b63d" />
            <Text style={s.listButtonText}>Voir la liste des commandes</Text>
            <Feather name="arrow-up-right" size={14} color="#f2b63d" />
          </Pressable>
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>TOTAL À PRÉPARER</Text>
            <Text style={s.total}>{activeOrder ? money(activeOrder.total, activeOrder.currency) : '—'}</Text>
            <Text style={s.itemsCount}>{details.isPending ? 'Chargement des articles…' : `${itemCount} article${itemCount === 1 ? '' : 's'}`}</Text>
          </View>
          {details.data?.items.map((item) => {
            const extras = parseExtras(item.selectedExtras);
            return (
              <View key={item.id} style={s.item}>
                <Text style={s.qty}>{item.quantity}×</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.menuItemName}</Text>
                  {item.selectedSize ? <Text style={s.meta}>{item.selectedSize}</Text> : null}
                  {extras.length ? <Text style={s.meta}>{extras.join(', ')}</Text> : null}
                </View>
              </View>
            );
          })}
          {activeOrder?.notes ? <Text style={s.note}>Note : {activeOrder.notes}</Text> : null}
          {actionError ? <Text accessibilityRole="alert" style={s.error}>{actionError}</Text> : null}
          {refusalOpen ? (
            <View style={s.reasonBox}>
              <Text style={s.reasonLabel}>Motif du refus</Text>
              <TextInput
                testID="order-refusal-reason"
                accessibilityLabel="Motif du refus"
                value={reason}
                onChangeText={setReason}
                placeholder="Indisponibilité, fermeture exceptionnelle…"
                placeholderTextColor="#a7a29d"
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={s.reasonInput}
              />
              <Button testID="order-refusal-confirm" label="Confirmer le refus" icon="x-circle" variant="danger" loading={busy} onPress={() => void reject()} />
            </View>
          ) : (
            <View style={s.prepBox}>
              <Text style={s.prepLabel}>Temps de préparation</Text>
              <View style={s.prepOptions}>
                {PREP_TIMES.map((minutes) => {
                  const selected = prepTimeMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      testID={`incoming-prep-${minutes}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setPrepTimeMinutes(minutes)}
                      style={[s.prepOption, selected && s.prepOptionSelected]}
                    >
                      <Text style={[s.prepText, selected && s.prepTextSelected]}>{minutes} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
        <View style={s.actions}>
          {!refusalOpen ? (
            <>
              <Pressable
                testID="order-refuse-open"
                accessibilityRole="button"
                onPress={() => { setActionError(''); setRefusalOpen(true); }}
                style={({ pressed }) => [s.refuseButton, { opacity: pressed || busy ? 0.65 : 1 }]}
                disabled={busy}
              >
                <Feather name="x" size={18} color="#fff" />
                <Text style={s.refuseText}>Refuser</Text>
              </Pressable>
              <Pressable
                testID="order-accept"
                accessibilityRole="button"
                onPress={() => void accept()}
                style={({ pressed }) => [s.acceptButton, { opacity: pressed || busy ? 0.72 : 1 }]}
                disabled={busy}
              >
                <Feather name="check" size={18} color="#171717" />
                <Text style={s.acceptText}>{busy ? 'Traitement…' : 'Accepter et préparer'}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => { setRefusalOpen(false); setActionError(''); }}
              style={({ pressed }) => [s.backButton, { opacity: pressed ? 0.72 : 1 }]}
            >
              <Feather name="arrow-left" size={17} color="#f4f1ec" />
              <Text style={s.backText}>Retour à la commande</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 24, paddingHorizontal: 22, paddingBottom: 18 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#f2b63d' },
  eyebrow: { flex: 1, color: '#f2b63d', fontFamily: font.bold, fontSize: 11, letterSpacing: 1.5 },
  count: { color: '#b9b3aa', fontFamily: font.semibold, fontSize: 13 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 20 },
  title: { color: '#fff', fontFamily: font.display, fontSize: 36 },
  subtitle: { color: '#b9b3aa', fontFamily: font.regular, fontSize: 15, marginTop: 4, marginBottom: 18 },
  listButton: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, marginBottom: 14 },
  listButtonText: { color: '#f2b63d', fontFamily: font.semibold, fontSize: 13 },
  totalCard: { backgroundColor: '#272522', borderRadius: 18, padding: 18, marginBottom: 14 },
  totalLabel: { color: '#b9b3aa', fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2 },
  total: { color: '#fff', fontFamily: font.bold, fontSize: 30, marginTop: 6 },
  itemsCount: { color: '#b9b3aa', fontFamily: font.medium, fontSize: 13, marginTop: 3 },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#4b4740' },
  qty: { color: '#f2b63d', fontFamily: font.bold, fontSize: 17, minWidth: 34 },
  itemName: { color: '#fff', fontFamily: font.semibold, fontSize: 15 },
  meta: { color: '#b9b3aa', fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  note: { color: '#fff', fontFamily: font.semibold, fontSize: 14, backgroundColor: '#272522', borderRadius: 12, padding: 12, marginTop: 14 },
  error: { color: '#ffc1bd', fontFamily: font.medium, fontSize: 13, marginTop: 12 },
  reasonBox: { gap: 10, marginTop: 20 },
  reasonLabel: { color: '#fff', fontFamily: font.semibold, fontSize: 15 },
  reasonInput: { minHeight: 104, borderWidth: 1, borderColor: '#5f5950', borderRadius: 12, color: '#fff', padding: 12, fontFamily: font.regular, fontSize: 14 },
  prepBox: { marginTop: 20 },
  prepLabel: { color: '#b9b3aa', fontFamily: font.medium, fontSize: 13, marginBottom: 8 },
  prepOptions: { flexDirection: 'row', gap: 8 },
  prepOption: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#514d47', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prepOptionSelected: { borderColor: '#f2b63d', backgroundColor: '#f2b63d' },
  prepText: { color: '#fff', fontFamily: font.semibold, fontSize: 12 },
  prepTextSelected: { color: '#171717' },
  actions: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center', paddingTop: 12 },
  refuseButton: { flex: 1, minHeight: 56, borderRadius: 15, backgroundColor: '#5c2825', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  refuseText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },
  acceptButton: { flex: 1.4, minHeight: 56, borderRadius: 15, backgroundColor: '#f2b63d', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  acceptText: { color: '#171717', fontFamily: font.bold, fontSize: 14 },
  backButton: { minHeight: 56, borderRadius: 15, backgroundColor: '#393531', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1 },
  backText: { color: '#f4f1ec', fontFamily: font.semibold, fontSize: 14 },
});
