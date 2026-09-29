import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { font } from '@/components/ui';
import { useShopContext } from '@/lib/shop-context';

export function MerchantShopHeader() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { shops, selectedShop, selectedShopId, selectShop, canTogglePause, isToggling, togglePause } = useShopContext();
  const [chooserOpen, setChooserOpen] = useState(false);
  const compact = width < 390;
  const shopName = selectedShop?.name ?? 'Toutes';

  return (
    <>
      <View style={s.wrap}>
        <Pressable
          testID="shop-selector"
          accessibilityRole="button"
          accessibilityLabel={`Boutique sélectionnée : ${selectedShop?.name ?? 'toutes les boutiques'}. Choisir une boutique`}
          onPress={() => setChooserOpen(true)}
          style={({ pressed }) => [s.selector, { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.78 : 1, maxWidth: compact ? 116 : 164 }]}
        >
          <Feather name="home" size={14} color={c.primary} />
          <View style={s.copy}>
            <Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{shopName}</Text>
            {selectedShop ? (
              <View style={s.status}>
                <View style={[s.dot, { backgroundColor: selectedShop.isOpen ? c.secondaryForeground : c.destructive }]} />
                <Text numberOfLines={1} style={[s.statusText, { color: c.mutedForeground }]}>{selectedShop.isOpen ? 'Ouverte' : 'En pause'}</Text>
              </View>
            ) : null}
          </View>
          <Feather name="chevron-down" size={14} color={c.mutedForeground} />
        </Pressable>
        {selectedShop && canTogglePause ? (
          <Pressable
            testID="shop-pause-toggle"
            accessibilityRole="button"
            accessibilityLabel={selectedShop.isOpen ? 'Mettre la boutique en pause' : 'Reprendre les commandes'}
            disabled={isToggling}
            onPress={() => void togglePause()}
            style={({ pressed }) => [s.toggle, { borderColor: c.border, backgroundColor: c.card, opacity: pressed || isToggling ? 0.65 : 1 }]}
          >
            <Feather name={selectedShop.isOpen ? 'pause' : 'play'} size={17} color={selectedShop.isOpen ? c.destructive : c.secondaryForeground} />
          </Pressable>
        ) : null}
      </View>

      <Modal transparent visible={chooserOpen} animationType="fade" onRequestClose={() => setChooserOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setChooserOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]} onPress={(event) => event.stopPropagation()}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={[s.sheetEyebrow, { color: c.primary }]}>ESPACE MARCHAND</Text>
                <Text style={[s.sheetTitle, { color: c.foreground }]}>Choisir une boutique</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setChooserOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={c.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
              <ShopOption label="Toutes les boutiques" selected={selectedShopId === null} onPress={() => { selectShop(null); setChooserOpen(false); }} />
              {shops.map((shop) => (
                <ShopOption key={shop.id} label={shop.name} detail={shop.isOpen ? 'Ouverte aux commandes' : 'En pause'} selected={selectedShopId === shop.id} onPress={() => { selectShop(shop.id); setChooserOpen(false); }} />
              ))}
              {shops.length === 0 ? <Text style={[s.empty, { color: c.mutedForeground }]}>Aucune boutique disponible.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ShopOption({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [s.option, { backgroundColor: selected ? c.secondary : c.background, borderColor: selected ? c.primary : c.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={s.copy}>
        <Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{label}</Text>
        {detail ? <Text style={[s.statusText, { color: c.mutedForeground }]}>{detail}</Text> : null}
      </View>
      {selected ? <Feather name="check-circle" size={18} color={c.primary} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selector: { minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.semibold, fontSize: 11 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: font.regular, fontSize: 10 },
  toggle: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  scrim: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end', padding: 14 },
  sheet: { borderWidth: 1, padding: 18, maxHeight: '78%', width: '100%', alignSelf: 'center', maxWidth: 520 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetEyebrow: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2 },
  sheetTitle: { fontFamily: font.display, fontSize: 20, marginTop: 3 },
  option: { minHeight: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  empty: { fontFamily: font.regular, paddingVertical: 12 },
});