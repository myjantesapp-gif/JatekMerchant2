import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { statusLabel } from '@/lib/types';

type ScreenFrameProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  showSettings?: boolean;
  back?: () => void;
  rightAction?: ReactNode;
};

export function ScreenFrame({
  title,
  eyebrow = 'JATEK MARCHAND',
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  showSettings = true,
  back,
  rightAction,
}: ScreenFrameProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topSpace = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.webFrame}>
        <View style={[styles.header, { paddingTop: topSpace + 8 }]}>
          <View style={styles.headingCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            {back ? (
              <IconAction
                label="Retour"
                name="arrow-left"
                onPress={back}
              />
            ) : null}
            {onRefresh ? (
              <IconAction
                label="Actualiser"
                name="refresh-cw"
                onPress={onRefresh}
                busy={refreshing}
              />
            ) : null}
            {rightAction}
            {showSettings ? (
              <IconAction
                label="Paramètres"
                name="settings"
                onPress={() => router.push('/settings')}
              />
            ) : null}
          </View>
        </View>
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function IconAction({
  label,
  name,
  onPress,
  busy = false,
}: {
  label: string;
  name: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  busy?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`action-${label.toLowerCase().replaceAll(' ', '-')}`}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.iconAction,
        { opacity: pressed || busy ? 0.55 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Feather name={name} size={19} color={colors.foreground} />
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'soft' | 'danger' | 'outline';
  icon?: ReactNode;
  testID?: string;
}) {
  const colors = useColors();
  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.destructive
        : variant === 'soft'
          ? colors.secondary
          : 'transparent';
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? '#ffffff'
      : variant === 'soft'
        ? colors.secondaryForeground
        : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'outline' ? colors.border : backgroundColor,
          opacity: disabled || busy ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={textColor} /> : icon}
      <Text style={[styles.buttonLabel, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: object }) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.input,
            borderRadius: colors.radius,
          },
          style,
        ]}
      />
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const isDone = ['delivered', 'ready'].includes(status);
  const isAlert = ['cancelled'].includes(status);
  const isProgress = ['accepted', 'confirmed', 'preparing'].includes(status);
  const backgroundColor = isAlert
    ? '#fbe3e1'
    : isDone
      ? colors.secondary
      : isProgress
        ? '#fff0c2'
        : colors.muted;
  const foregroundColor = isAlert
    ? colors.destructive
    : isDone
      ? colors.secondaryForeground
      : isProgress
        ? '#765713'
        : colors.mutedForeground;
  return (
    <View style={[styles.statusBadge, { backgroundColor }]}>
      <Text style={[styles.statusText, { color: foregroundColor }]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

export function LoadingState({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.stateCard}>
      {error ? (
        <>
          <Feather name="wifi-off" size={25} color={colors.destructive} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            Impossible de charger ces données
          </Text>
          <Text style={[styles.stateCopy, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          {onRetry ? (
            <PrimaryButton
              label="Réessayer"
              onPress={onRetry}
              variant="soft"
              testID="button-retry"
            />
          ) : null}
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  detail,
  icon = 'inbox',
}: {
  title: string;
  detail: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  return (
    <Card style={styles.emptyState}>
      <Feather name={icon} size={25} color={colors.mutedForeground} />
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.stateCopy, { color: colors.mutedForeground }]}>
        {detail}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  webFrame: { flex: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { marginTop: 5, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 12 },
  iconAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroller: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 124, gap: 15 },
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: '#20263b',
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLabel: { fontWeight: '800', fontSize: 14 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  stateCard: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  stateTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  stateCopy: { maxWidth: 300, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyState: { alignItems: 'center', gap: 9, paddingVertical: 30 },
});