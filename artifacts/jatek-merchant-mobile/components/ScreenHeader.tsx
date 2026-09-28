import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { font } from '@/components/ui';

export function ScreenHeader({ kicker, title, right, onBack }: { kicker: string; title: string; right?: React.ReactNode; onBack?: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={[s.wrap, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8 }]}>
      {onBack ? (
        <Pressable
          testID="screen-back"
          accessibilityRole="button"
          accessibilityLabel="Revenir à l’écran précédent"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [s.back, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="arrow-left" size={19} color={c.foreground} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.kicker, { color: c.primary }]}>{kicker}</Text>
        <Text style={[s.title, { color: c.foreground, fontSize: width < 360 ? 26 : 28 }]} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function useBottomPad() {
  const insets = useSafeAreaInsets();
  return (Platform.OS === 'web' ? 84 : insets.bottom + 60) + 24;
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: font.display, fontSize: 28, marginTop: 2 },
});
