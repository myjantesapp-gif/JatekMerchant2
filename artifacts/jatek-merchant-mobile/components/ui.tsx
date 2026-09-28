import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { statusInfo } from '@/lib/format';

export const font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  display: 'Syne_700Bold',
  displayStrong: 'Syne_800ExtraBold',
} as const;

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const c = useColors();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={[{ height, width, borderRadius: 8, backgroundColor: c.muted, opacity: o }, style]} />;
}

export function SkeletonCards({ count = 5 }: { count?: number }) {
  const c = useColors();
  return (
    <View style={{ gap: 12, padding: 16 }} testID="skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, gap: 10 }]}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="75%" height={12} />
          <Skeleton width="30%" height={18} />
        </View>
      ))}
    </View>
  );
}

export function StateView({ icon, title, message, actionLabel, onAction, tone = 'muted' }: {
  icon: keyof typeof Feather.glyphMap; title: string; message?: string; actionLabel?: string; onAction?: () => void; tone?: 'muted' | 'destructive';
}) {
  const c = useColors();
  const tint = tone === 'destructive' ? c.destructive : c.primary;
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: tone === 'destructive' ? '#d839351a' : c.secondary }]}>
        <Feather name={icon} size={24} color={tint} />
      </View>
      <Text style={[styles.stateTitle, { color: c.foreground }]}>{title}</Text>
      {message ? <Text style={[styles.stateMsg, { color: c.mutedForeground }]}>{message}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} icon="refresh-cw" onPress={onAction} variant="outline" testID="retry" /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const msg = error instanceof Error ? error.message : 'Erreur inconnue.';
  return <StateView icon="wifi-off" tone="destructive" title="Chargement impossible" message={msg} actionLabel="Réessayer" onAction={onRetry} />;
}

export function Button({ label, onPress, icon, variant = 'primary', loading, disabled, testID, accessibilityLabel, accessibilityHint }: {
  label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; variant?: 'primary' | 'outline' | 'danger'; loading?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string; accessibilityHint?: string;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : 'transparent';
  const fg = variant === 'primary' ? c.primaryForeground : variant === 'danger' ? c.destructive : c.foreground;
  const border = variant === 'primary' ? c.primary : variant === 'danger' ? c.destructive : c.border;
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      hitSlop={3}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, borderColor: border, borderRadius: c.radius, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Feather name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = useColors();
  const s = statusInfo(status);
  const map = {
    accent: [c.accent, c.accentForeground],
    primary: ['#d42a781f', c.primary],
    secondary: [c.secondary, c.secondaryForeground],
    muted: [c.muted, c.mutedForeground],
    destructive: ['#d839351f', c.destructive],
  } as const;
  const [bg, fg] = map[s.tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{s.label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16 },
  state: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, flexGrow: 1, minHeight: 320 },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle: { fontFamily: font.display, fontSize: 18, textAlign: 'center' },
  stateMsg: { fontFamily: font.regular, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300, marginBottom: 8 },
  btn: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5 },
  btnText: { fontFamily: font.semibold, fontSize: 15 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontFamily: font.semibold, fontSize: 12 },
});
