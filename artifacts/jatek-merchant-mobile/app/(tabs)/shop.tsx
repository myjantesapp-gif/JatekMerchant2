import React, { useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, Field, LoadingState, PrimaryButton, ScreenFrame, SectionTitle } from '@/components/MerchantUI';
import { ImageField } from '@/components/ImageField';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { mediaUri } from '@/lib/media';
import { merchantQueryKey } from '@/lib/query-client';
import type { BackendMe, MerchantShop } from '@/lib/types';
import { money } from '@/lib/types';

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'grocery', label: 'Épicerie' },
  { value: 'pharmacy', label: 'Pharmacie' },
  { value: 'flower', label: 'Fleuriste' },
  { value: 'pet', label: 'Animalerie' },
];

type ShopDraft = {
  name: string;
  description: string;
  address: string;
  phone: string;
  category: string;
  businessType: string;
  deliveryTime: string;
  deliveryFee: string;
  minimumOrder: string;
  isOpen: boolean;
  imageUrl: string;
  coverImageUrl: string;
  logoUrl: string;
};

function shopDraft(shop: MerchantShop): ShopDraft {
  return {
    name: shop.name ?? '',
    description: shop.description ?? '',
    address: shop.address ?? '',
    phone: shop.phone ?? '',
    category: shop.category ?? '',
    businessType: shop.businessType ?? 'restaurant',
    deliveryTime: String(shop.deliveryTime ?? ''),
    deliveryFee: String(shop.deliveryFee ?? ''),
    minimumOrder: String(shop.minimumOrder ?? ''),
    isOpen: shop.isOpen,
    imageUrl: shop.imageUrl ?? '',
    coverImageUrl: shop.coverImageUrl ?? '',
    logoUrl: shop.logoUrl ?? '',
  };
}

export default function MerchantShopScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShopDraft | null>(null);
  const [error, setError] = useState('');
  const [activeUploads, setActiveUploads] = useState(0);
  const shops = useQuery<MerchantShop[]>({
    queryKey: merchantQueryKey('/api/backend/shops'),
  });
  const me = useQuery<BackendMe>({
    queryKey: merchantQueryKey('/api/backend/me'),
  });
  const shop = shops.data?.[0];
  const canEdit = Boolean(me.data && me.data.user.role !== 'employee');

  const saveShop = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest(`/api/backend/shops/${id}`, { method: 'PATCH', json: payload }),
    onSuccess: () => {
      setEditing(false);
      setDraft(null);
      setError('');
      void client.invalidateQueries({ queryKey: ['/api/backend/shops'] });
      void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Échec de la mise à jour.'),
  });

  const toggleOpen = useMutation({
    mutationFn: ({ id, isOpen }: { id: number; isOpen: boolean }) =>
      apiRequest(`/api/backend/shops/${id}`, { method: 'PATCH', json: { isOpen } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['/api/backend/shops'] });
      void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
    },
  });

  const beginEdit = () => {
    if (!shop) return;
    setActiveUploads(0);
    setDraft(shopDraft(shop));
    setError('');
    setEditing(true);
  };
  const closeEdit = () => {
    if (saveShop.isPending || activeUploads > 0) return;
    setEditing(false);
    setDraft(null);
    setError('');
  };
  const submit = () => {
    if (!shop || !draft) return;
    if (!draft.name.trim() || !draft.address.trim()) {
      setError('Le nom et l’adresse de la boutique sont obligatoires.');
      return;
    }
    const numeric = (value: string, label: string): number | undefined => {
      if (!value.trim()) return undefined;
      const parsed = Number(value.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Vérifiez le champ « ${label} ».`);
      return parsed;
    };
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        address: draft.address.trim(),
        phone: draft.phone.trim(),
        category: draft.category.trim(),
        businessType: draft.businessType,
        deliveryTime: numeric(draft.deliveryTime, 'délai de livraison'),
        deliveryFee: numeric(draft.deliveryFee, 'frais de livraison'),
        minimumOrder: numeric(draft.minimumOrder, 'commande minimum'),
        isOpen: draft.isOpen,
        imageUrl: draft.imageUrl || null,
        coverImageUrl: draft.coverImageUrl || null,
        logoUrl: draft.logoUrl || null,
      };
      saveShop.mutate({ id: shop.id, payload });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vérifiez les informations saisies.');
    }
  };

  return (
    <ScreenFrame
      title="Boutique"
      eyebrow="VOTRE PROFIL MARCHAND"
      subtitle="Informations visibles par vos clients."
      onRefresh={() => void shops.refetch()}
      refreshing={shops.isRefetching}
      rightAction={
        canEdit && shop ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier le profil de la boutique"
            testID="button-edit-shop"
            onPress={beginEdit}
            style={({ pressed }) => [styles.editShop, { backgroundColor: colors.secondary, opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="edit-3" size={17} color={colors.secondaryForeground} />
            <Text style={[styles.editShopText, { color: colors.secondaryForeground }]}>Modifier</Text>
          </Pressable>
        ) : null
      }
    >
      {shops.isLoading ? (
        <LoadingState />
      ) : shops.isError ? (
        <LoadingState
          error={shops.error instanceof Error ? shops.error.message : undefined}
          onRetry={() => void shops.refetch()}
        />
      ) : !shop ? (
        <EmptyState
          title="Aucune boutique associée"
          detail="Votre compte marchand n’est pas encore rattaché à une boutique."
          icon="shopping-bag"
        />
      ) : (
        <>
          <View style={styles.hero}>
            <ImageBackground
              source={shop.coverImageUrl ? { uri: mediaUri(shop.coverImageUrl) } : undefined}
              style={[styles.cover, { backgroundColor: colors.sidebar }]}
              imageStyle={styles.coverImage}
            >
              {!shop.coverImageUrl ? (
                <View style={styles.coverFallback}>
                  <Feather name="shopping-bag" size={38} color="rgba(255,255,255,0.32)" />
                </View>
              ) : null}
              <View style={styles.logoWrap}>
                {shop.logoUrl || shop.imageUrl ? (
                  <Image
                    source={{ uri: mediaUri(shop.logoUrl || shop.imageUrl) }}
                    style={styles.logoImage}
                  />
                ) : (
                  <View style={[styles.logoFallback, { backgroundColor: colors.accent }]}>
                    <Feather name="shopping-bag" size={25} color={colors.accentForeground} />
                  </View>
                )}
              </View>
            </ImageBackground>
          </View>
          <Card style={styles.identityCard}>
            <View style={styles.nameLine}>
              <View style={styles.nameCopy}>
                <Text style={[styles.shopName, { color: colors.foreground }]}>{shop.name}</Text>
                <Text style={[styles.category, { color: colors.mutedForeground }]}>
                  {shop.category || BUSINESS_TYPES.find((item) => item.value === shop.businessType)?.label || 'Boutique'}
                </Text>
              </View>
              <View style={[styles.rating, { backgroundColor: colors.accent }]}>
                <Feather name="star" size={13} color={colors.accentForeground} />
                <Text style={[styles.ratingValue, { color: colors.accentForeground }]}>
                  {shop.rating ? Number(shop.rating).toFixed(1) : '—'}
                </Text>
              </View>
            </View>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {shop.description || 'Ajoutez une description pour présenter votre boutique aux clients.'}
            </Text>
            <View style={styles.openRow}>
              <View style={styles.openCopy}>
                <View style={styles.openTitleLine}>
                  <View style={[styles.openDot, { backgroundColor: shop.isOpen ? '#3c9c6c' : colors.mutedForeground }]} />
                  <Text style={[styles.openTitle, { color: colors.foreground }]}>
                    {shop.isOpen ? 'Boutique ouverte' : 'Boutique fermée'}
                  </Text>
                </View>
                <Text style={[styles.openHint, { color: colors.mutedForeground }]}>
                  {shop.isOpen ? 'Les clients peuvent passer commande.' : 'Les nouvelles commandes sont désactivées.'}
                </Text>
              </View>
              <Switch
                value={shop.isOpen}
                disabled={!canEdit || toggleOpen.isPending}
                onValueChange={(isOpen) => toggleOpen.mutate({ id: shop.id, isOpen })}
                trackColor={{ false: colors.border, true: colors.secondaryForeground }}
                thumbColor="#ffffff"
                accessibilityLabel="Ouvrir ou fermer la boutique"
                testID="switch-shop-open"
              />
            </View>
            {toggleOpen.isError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                Le statut de la boutique n’a pas été modifié.
              </Text>
            ) : null}
          </Card>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Feather name="star" size={17} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {shop.rating ? Number(shop.rating).toFixed(1) : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Note moyenne</Text>
            </Card>
            <Card style={styles.statCard}>
              <Feather name="message-circle" size={17} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{shop.reviewCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Avis clients</Text>
            </Card>
            <Card style={styles.statCard}>
              <Feather name="clock" size={17} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {shop.deliveryTime ? `${shop.deliveryTime} min` : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Livraison</Text>
            </Card>
          </View>

          <Card>
            <SectionTitle title="Coordonnées et service" />
            <DetailRow icon="map-pin" label="Adresse" value={shop.address || 'Non renseignée'} />
            <DetailRow icon="phone" label="Téléphone" value={shop.phone || 'Non renseigné'} />
            <DetailRow icon="truck" label="Frais de livraison" value={money(shop.deliveryFee)} />
            <DetailRow icon="shopping-cart" label="Commande minimum" value={money(shop.minimumOrder)} />
            <DetailRow icon="tag" label="Type d’activité" value={BUSINESS_TYPES.find((item) => item.value === shop.businessType)?.label ?? shop.businessType ?? '—'} />
          </Card>
        </>
      )}

      <ShopEditModal
        visible={editing}
        draft={draft}
        error={error}
        busy={saveShop.isPending}
        uploading={activeUploads > 0}
        onUploading={(uploading) =>
          setActiveUploads((count) => Math.max(0, count + (uploading ? 1 : -1)))
        }
        onChange={(key, value) =>
          setDraft((current) => current ? { ...current, [key]: value } : current)
        }
        onClose={closeEdit}
        onSave={submit}
      />
    </ScreenFrame>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.detailRow, { borderColor: colors.border }]}>
      <View style={[styles.detailIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function ShopEditModal({
  visible,
  draft,
  error,
  busy,
  uploading,
  onUploading,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: ShopDraft | null;
  error: string;
  busy: boolean;
  uploading: boolean;
  onUploading: (uploading: boolean) => void;
  onChange: (key: keyof ShopDraft, value: string | boolean) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={[styles.modalRoot, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalHeader, { borderColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} disabled={busy || uploading} style={styles.closeButton}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Modifier la boutique</Text>
          <View style={styles.closeButton} />
        </View>
        {draft ? (
          <KeyboardAwareScrollViewCompat
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            <ImageField label="Logo de la boutique" value={draft.logoUrl} kind="shop_logo" onUploading={onUploading} onChange={(url) => onChange('logoUrl', url)} />
            <ImageField label="Image de couverture" value={draft.coverImageUrl} kind="shop_cover" onUploading={onUploading} onChange={(url) => onChange('coverImageUrl', url)} />
            <ImageField label="Image secondaire" value={draft.imageUrl} kind="shop_cover" onUploading={onUploading} onChange={(url) => onChange('imageUrl', url)} />
            <Field label="Nom de la boutique" value={draft.name} onChangeText={(value) => onChange('name', value)} placeholder="Nom affiché aux clients" />
            <Field label="Description" value={draft.description} onChangeText={(value) => onChange('description', value)} placeholder="Présentez votre boutique" multiline numberOfLines={4} style={styles.multiline} />
            <Field label="Adresse" value={draft.address} onChangeText={(value) => onChange('address', value)} placeholder="Adresse de la boutique" />
            <Field label="Téléphone" value={draft.phone} onChangeText={(value) => onChange('phone', value)} placeholder="+33…" keyboardType="phone-pad" />
            <Field label="Catégorie visible" value={draft.category} onChangeText={(value) => onChange('category', value)} placeholder="Ex. Cuisine française" />
            <View style={styles.businessPicker}>
              <Text style={[styles.fieldTitle, { color: colors.foreground }]}>Type d’activité</Text>
              <View style={styles.businessChips}>
                {BUSINESS_TYPES.map((item) => {
                  const selected = draft.businessType === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      testID={`button-business-${item.value}`}
                      onPress={() => onChange('businessType', item.value)}
                      style={[styles.businessChip, { backgroundColor: selected ? colors.sidebar : colors.muted }]}
                    >
                      <Text style={[styles.businessText, { color: selected ? '#ffffff' : colors.mutedForeground }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Field label="Temps moyen de livraison (minutes)" value={draft.deliveryTime} onChangeText={(value) => onChange('deliveryTime', value)} placeholder="Ex. 35" keyboardType="number-pad" />
            <Field label="Frais de livraison (€)" value={draft.deliveryFee} onChangeText={(value) => onChange('deliveryFee', value.replace(',', '.'))} placeholder="0,00" keyboardType="decimal-pad" />
            <Field label="Commande minimum (€)" value={draft.minimumOrder} onChangeText={(value) => onChange('minimumOrder', value.replace(',', '.'))} placeholder="0,00" keyboardType="decimal-pad" />
            <View style={[styles.switchRow, { borderColor: colors.border }]}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>Boutique ouverte aux commandes</Text>
              <Switch
                value={draft.isOpen}
                onValueChange={(value) => onChange('isOpen', value)}
                trackColor={{ false: colors.border, true: colors.secondaryForeground }}
                thumbColor="#ffffff"
              />
            </View>
            {error ? <Text accessibilityRole="alert" style={[styles.formError, { color: colors.destructive }]}>{error}</Text> : null}
            <PrimaryButton label="Enregistrer les changements" onPress={onSave} busy={busy} disabled={uploading} testID="button-save-shop" />
          </KeyboardAwareScrollViewCompat>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  editShop: { minHeight: 38, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13 },
  editShopText: { fontSize: 10, fontWeight: '800' },
  hero: { marginBottom: -2 },
  cover: { height: 168, borderRadius: 20, overflow: 'visible', position: 'relative' },
  coverImage: { borderRadius: 20, opacity: 0.9 },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { position: 'absolute', left: 15, bottom: -24, borderWidth: 4, borderColor: '#ffffff', borderRadius: 21, backgroundColor: '#ffffff' },
  logoImage: { width: 63, height: 63, borderRadius: 17 },
  logoFallback: { width: 63, height: 63, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  identityCard: { paddingTop: 34, gap: 11 },
  nameLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  nameCopy: { flex: 1 },
  shopName: { fontSize: 20, fontWeight: '800' },
  category: { marginTop: 4, fontSize: 11 },
  rating: { minHeight: 28, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  ratingValue: { fontSize: 11, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 18 },
  openRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2ddd7', paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  openCopy: { flex: 1 },
  openTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openDot: { width: 8, height: 8, borderRadius: 8 },
  openTitle: { fontSize: 12, fontWeight: '800' },
  openHint: { marginTop: 4, fontSize: 10 },
  errorText: { fontSize: 11, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  statValue: { marginTop: 7, fontSize: 16, fontWeight: '800' },
  statLabel: { marginTop: 3, fontSize: 9, textAlign: 'center' },
  detailRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1 },
  detailLabel: { fontSize: 10 },
  detailValue: { marginTop: 3, fontSize: 12, fontWeight: '700' },
  modalRoot: { flex: 1 },
  modalHeader: { minHeight: 58, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 17, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 40 },
  fieldTitle: { fontSize: 12, fontWeight: '700' },
  businessPicker: { gap: 8 },
  businessChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  businessChip: { minHeight: 35, borderRadius: 10, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  businessText: { fontSize: 10, fontWeight: '800' },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  switchRow: { minHeight: 60, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 9 },
  switchTitle: { flex: 1, fontSize: 12, fontWeight: '700' },
  formError: { fontSize: 12, lineHeight: 18 },
});