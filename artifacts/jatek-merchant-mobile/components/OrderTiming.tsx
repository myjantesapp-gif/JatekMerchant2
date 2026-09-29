import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { font } from '@/components/ui';

export type OrderTimingData = {
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  acceptedAt?: string | null;
  readyAt?: string | null;
  handedOverAt?: string | null;
  prepTimeMinutes?: number | null;
};

export function elapsedSeconds(start?: string | null, endMs = Date.now()): number | null {
  if (!start) return null;
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function activeOrderClock(order: OrderTimingData): { label: string; since: string; tone: 'pending' | 'preparing' | 'ready' } | null {
  if (order.status === 'pending') {
    return order.createdAt ? { label: 'En attente', since: order.createdAt, tone: 'pending' } : null;
  }
  if (['accepted', 'confirmed', 'preparing'].includes(order.status)) {
    const since = order.acceptedAt || order.updatedAt || order.createdAt;
    return since ? { label: 'Cuisine', since, tone: 'preparing' } : null;
  }
  if (['ready', 'driver_at_restaurant'].includes(order.status)) {
    const since = order.readyAt || order.updatedAt || order.createdAt;
    return since ? { label: 'Collecte', since, tone: 'ready' } : null;
  }
  return null;
}

export function OrderTimerBadge({ order, nowMs }: { order: OrderTimingData; nowMs: number }) {
  const c = useColors();
  const clock = activeOrderClock(order);
  if (!clock) return null;
  const seconds = elapsedSeconds(clock.since, nowMs) ?? 0;
  const prepLimitSeconds = Math.max(1, order.prepTimeMinutes || 20) * 60;
  const overdue = clock.tone === 'preparing' && seconds > prepLimitSeconds;
  const nearLimit = clock.tone === 'preparing' && seconds >= prepLimitSeconds * 0.75;
  const background = clock.tone === 'pending' || overdue
    ? c.destructive
    : nearLimit
      ? c.accent
      : clock.tone === 'ready'
        ? c.secondary
        : c.secondary;
  const foreground = clock.tone === 'pending' || overdue
    ? c.destructiveForeground
    : nearLimit
      ? c.accentForeground
      : c.secondaryForeground;
  return (
    <View
      accessibilityLabel={`${clock.label}, ${formatDuration(seconds)}`}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: background, paddingHorizontal: 8, paddingVertical: 5 }}
    >
      <Feather name="clock" size={12} color={foreground} />
      <Text style={{ color: foreground, fontFamily: font.bold, fontSize: 11, fontVariant: ['tabular-nums'] }}>
        {clock.label} {formatDuration(seconds)}
      </Text>
    </View>
  );
}

export function OrderTimestampSummary({ order }: { order: OrderTimingData }) {
  const c = useColors();
  const stages = [
    { label: 'Acceptation', start: order.createdAt, end: order.acceptedAt },
    { label: 'Cuisine', start: order.acceptedAt, end: order.readyAt },
    { label: 'Remise', start: order.readyAt, end: order.handedOverAt },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10 }}>
      {stages.map((stage) => (
        <View key={stage.label} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ color: c.mutedForeground, fontFamily: font.medium, fontSize: 9, textTransform: 'uppercase' }}>
            {stage.label}
          </Text>
          <Text style={{ color: c.foreground, fontFamily: font.bold, fontSize: 12, fontVariant: ['tabular-nums'], marginTop: 3 }}>
            {stage.end ? formatDuration(elapsedSeconds(stage.start, Date.parse(stage.end))) : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}