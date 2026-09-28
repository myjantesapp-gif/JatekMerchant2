import React from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { font } from '@/components/ui';

export function ScreenHeader({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={[s.wrap, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8 }]}>
      <View style={{ flex: 1 }}>
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
  kicker: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: font.bold, fontSize: 28, marginTop: 2 },
});
