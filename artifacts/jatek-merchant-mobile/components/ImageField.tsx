import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { mediaUri } from '@/lib/media';

type UploadKind = 'product_image' | 'shop_logo' | 'shop_cover';

export function ImageField({
  label,
  value,
  kind,
  onChange,
  onUploading,
}: {
  label: string;
  value: string;
  kind: UploadKind;
  onChange: (url: string) => void;
  onUploading?: (uploading: boolean) => void;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chooseImage = async (source: 'library' | 'camera') => {
    setError('');
    setBusy(true);
    onUploading?.(true);
    let startedBusy = true;
    try {
      if (source === 'library') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        const permission = current.granted
          ? current
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain && Platform.OS !== 'web') {
            Alert.alert(
              'Accès aux photos désactivé',
              'Autorisez l’accès aux photos dans les réglages de votre appareil.',
              [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
              ],
            );
          } else {
            Alert.alert('Accès requis', 'Autorisez l’accès aux photos pour choisir une image.');
          }
          return;
        }
      } else {
        const current = await ImagePicker.getCameraPermissionsAsync();
        const permission = current.granted
          ? current
          : await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain && Platform.OS !== 'web') {
            Alert.alert(
              'Accès à la caméra désactivé',
              'Autorisez l’accès à la caméra dans les réglages de votre appareil.',
              [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
              ],
            );
          } else {
            Alert.alert('Accès requis', 'Autorisez la caméra pour prendre une photo.');
          }
          return;
        }
      }

      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.82,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.82,
            });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Impossible de lire cette image.');

      const contentType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) {
        throw new Error('Format non pris en charge. Choisissez un JPEG, PNG, WebP ou GIF.');
      }
      const binary = globalThis.atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      if (bytes.byteLength > 5 * 1024 * 1024) {
        throw new Error('L’image dépasse la limite de 5 Mo.');
      }
      const body = new Blob([bytes], { type: contentType });
      const uploaded = await apiRequest<{ url: string }>('/api/storage/uploads/image', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': contentType,
          'X-Jatek-Media-Kind': kind,
        },
      });
      onChange(uploaded.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'L’image n’a pas pu être envoyée. Réessayez.',
      );
    } finally {
      setBusy(false);
      if (startedBusy) onUploading?.(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      {value ? (
        <Image
          source={{ uri: mediaUri(value) }}
          style={[styles.preview, { borderColor: colors.border }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.emptyImage, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="image" size={23} color={colors.mutedForeground} />
          <Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>Aucune image</Text>
        </View>
      )}
      <View style={styles.actions}>
        <ImageAction label="Galerie" icon="image" onPress={() => void chooseImage('library')} busy={busy} />
        {Platform.OS !== 'web' ? (
          <ImageAction label="Caméra" icon="camera" onPress={() => void chooseImage('camera')} busy={busy} />
        ) : null}
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer l’image"
            onPress={() => onChange('')}
            disabled={busy}
            style={styles.clearAction}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {busy ? (
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Envoi de l’image…</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ImageAction({
  label,
  icon,
  onPress,
  busy,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  busy: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.secondary, opacity: busy || pressed ? 0.55 : 1 },
      ]}
    >
      <Feather name={icon} size={15} color={colors.secondaryForeground} />
      <Text style={[styles.actionText, { color: colors.secondaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700' },
  preview: { width: '100%', height: 148, borderWidth: 1, borderRadius: 14 },
  emptyImage: {
    width: '100%',
    height: 98,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  emptyLabel: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { minHeight: 38, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 11, fontWeight: '800' },
  clearAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 11 },
  error: { fontSize: 11, lineHeight: 16 },
});