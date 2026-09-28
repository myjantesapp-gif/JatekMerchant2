import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { buildApiUrl } from '@/lib/api-core';
import {
  type MerchantShop, useMerchantShops, useUpdateMerchantShop,
} from '@/lib/merchant-parity-data';
import { uploadMerchantImage } from '@/lib/merchant-upload';
import { Button, ErrorState, Skeleton, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';

const BUSINESS_TYPES = [
  ['restaurant', 'Restaurant'],
  ['grocery', 'Épicerie / Supermarché'],
  ['pharmacy', 'Pharmacie'],
  ['flower', 'Fleuriste'],
  ['pet', 'Animalerie'],
] as const;

type FormState = {
  name: string; description: string; address: string; phone: string; category: string;
  businessType: string; deliveryTime: string; deliveryFee: string; minimumOrder: string;
  isOpen: boolean; imageUrl: string; coverImageUrl: string; logoUrl: string;
};

const money = (value?: number | null) => `${(value ?? 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const imageUri = (url?: string | null) => {
  if (!url) return null;
  try { return url.startsWith('/api/') ? buildApiUrl(url) : url; } catch { return null; }
};

function formFromShop(shop: MerchantShop): FormState {
  return {
    name: shop.name ?? '',
    description: shop.description ?? '',
    address: shop.address ?? '',
    phone: shop.phone ?? '',
    category: shop.category ?? '',
    businessType: shop.businessType ?? 'restaurant',
    deliveryTime: String(shop.deliveryTime ?? 30),
    deliveryFee: String(shop.deliveryFee ?? 0),
    minimumOrder: String(shop.minimumOrder ?? 0),
    isOpen: shop.isOpen ?? true,
    imageUrl: shop.imageUrl ?? '',
    coverImageUrl: shop.coverImageUrl ?? '',
    logoUrl: shop.logoUrl ?? '',
  };
}

function Field({ label, value, onChangeText, multiline, keyboardType = 'default', required = false }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'decimal-pad'; required?: boolean;
}) {
  const c = useColors();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.foreground }]}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={c.mutedForeground}
        style={[s.input, multiline && s.textarea, { color: c.foreground, borderColor: c.input, backgroundColor: c.background }]}
      />
    </View>
  );
}

function MediaField({ label, value, kind, onChange, onError }: {
  label: string; value: string; kind: 'logo' | 'banner' | 'image';
  onChange: (value: string) => void; onError: (message: string) => void;
}) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { onError('Autorisez la caméra dans les réglages pour prendre une photo.'); return; }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { onError('Autorisez l’accès aux photos dans les réglages pour choisir une image.'); return; }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setBusy(true);
      onChange(await uploadMerchantImage(asset.uri, asset.mimeType ?? 'image/jpeg', kind));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Téléversement impossible.');
    } finally { setBusy(false); }
  };
  const uri = imageUri(value);
  return (
    <View style={s.media}>
      <Text style={[s.label, { color: c.foreground }]}>{label}</Text>
      <View style={[s.mediaPreview, { backgroundColor: c.muted, borderColor: c.border }]}>
        {uri ? <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} /> :
          <Feather name="image" size={24} color={c.mutedForeground} />}
        {busy ? <View style={s.mediaBusy}><Text style={s.busyText}>Téléversement…</Text></View> : null}
      </View>
      <View style={s.mediaActions}>
        <Pressable disabled={busy} onPress={() => void pick(false)} style={[s.mediaButton, { backgroundColor: c.secondary, opacity: busy ? .5 : 1 }]}>
          <Feather name="upload" size={15} color={c.secondaryForeground} /><Text style={[s.mediaButtonText, { color: c.secondaryForeground }]}>Galerie</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void pick(true)} style={[s.mediaButton, { backgroundColor: c.primary, opacity: busy ? .5 : 1 }]}>
          <Feather name="camera" size={15} color={c.primaryForeground} /><Text style={[s.mediaButtonText, { color: c.primaryForeground }]}>Appareil photo</Text>
        </Pressable>
        {value ? <Pressable onPress={() => onChange('')} accessibilityLabel={`Supprimer ${label}`} style={[s.remove, { borderColor: c.border }]}><Feather name="x" size={16} color={c.destructive} /></Pressable> : null}
      </View>
    </View>
  );
}

export default function ShopProfileScreen() {
  const c = useColors();
  const q = useMerchantShops();
  const update = useUpdateMerchantShop();
  const bottom = useBottomPad();
  const { width } = useWindowDimensions();
  const shops = q.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState('');
  const [mediaError, setMediaError] = useState('');
  const shop = useMemo(() => shops.find((item) => item.id === selectedId) ?? shops[0], [shops, selectedId]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  const beginEdit = () => { if (shop) { setForm(formFromShop(shop)); setFormError(''); setMediaError(''); setEditing(true); } };
  const submit = () => {
    if (!shop || !form) return;
    const deliveryFee = Number(form.deliveryFee);
    const minimumOrder = Number(form.minimumOrder);
    const deliveryTime = Number(form.deliveryTime);
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim() || !form.category.trim()) { setFormError('Nom, téléphone, catégorie et adresse sont requis.'); return; }
    if (![deliveryFee, minimumOrder, deliveryTime].every((value) => Number.isFinite(value) && value >= 0)) { setFormError('Les montants et le délai doivent être des nombres positifs.'); return; }
    setFormError('');
    update.mutate({
      id: shop.id,
      data: {
        name: form.name.trim(), description: form.description.trim(), address: form.address.trim(), phone: form.phone.trim(),
        category: form.category.trim(), businessType: form.businessType, deliveryTime, deliveryFee, minimumOrder,
        isOpen: form.isOpen, imageUrl: form.imageUrl || null, coverImageUrl: form.coverImageUrl || null, logoUrl: form.logoUrl || null,
      },
    }, { onSuccess: () => { setEditing(false); setForm(null); }, onError: (error) => setFormError(error instanceof Error ? error.message : 'Enregistrement impossible.') });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker="Présence client" title="Profil boutique" onBack={() => router.back()} />
      {q.isPending ? <View style={s.loading}><Skeleton height={180} /><Skeleton height={24} width="65%" /><Skeleton height={16} width="90%" /></View> :
        q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !shop ? <View style={s.loading}><Text style={[s.empty, { color: c.mutedForeground }]}>Aucune boutique rattachée à votre compte.</Text></View> :
            <ScrollView
              contentContainerStyle={[s.content, { paddingBottom: bottom, paddingHorizontal: Math.min(24, Math.max(16, width * .05)) }]}
              refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} colors={[c.primary]} />}
              keyboardShouldPersistTaps="handled"
            >
              {shops.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shopPicker}>
                {shops.map((item) => <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setEditing(false); }} style={[s.shopChip, { backgroundColor: item.id === shop.id ? c.ink : c.card, borderColor: item.id === shop.id ? c.ink : c.border }]}><Text style={{ color: item.id === shop.id ? c.inkForeground : c.foreground, fontFamily: font.semibold }}>{item.name}</Text></Pressable>)}
              </ScrollView> : null}
              {!editing ? <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, padding: 0, overflow: 'hidden' }]}>
                <View style={[s.cover, { backgroundColor: c.ink }]}>
                  {imageUri(shop.coverImageUrl) ? <Image source={{ uri: imageUri(shop.coverImageUrl)! }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
                  <View style={s.coverShade} />
                  <View style={s.identity}>
                    <View style={[s.logo, { backgroundColor: c.card, borderColor: c.card }]}>
                      {imageUri(shop.logoUrl) ? <Image source={{ uri: imageUri(shop.logoUrl)! }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={[s.logoText, { color: c.primary }]}>{shop.name.slice(0, 1).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}><Text style={s.coverName}>{shop.name}</Text><Text style={s.coverMeta}>{shop.category || 'Boutique'} · {shop.businessType || 'restaurant'}</Text></View>
                  </View>
                </View>
                <View style={s.cardBody}>
                  <Button label="Modifier le profil" icon="edit-2" variant="outline" onPress={beginEdit} />
                  <Text style={[s.section, { color: c.mutedForeground }]}>À PROPOS</Text>
                  <Text style={[s.description, { color: c.foreground }]}>{shop.description || 'Aucune description ajoutée pour le moment.'}</Text>
                  <View style={s.infoGrid}>
                    <Info label="Adresse" value={shop.address || 'Non renseignée'} />
                    <Info label="Téléphone" value={shop.phone || 'Non renseigné'} />
                    <Info label="Statut" value={shop.isOpen ? 'Ouverte' : 'Fermée'} tone={shop.isOpen ? c.primary : c.mutedForeground} />
                    <Info label="Note" value={shop.rating ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount ?? 0})` : 'Non notée'} />
                    <Info label="Livraison" value={money(shop.deliveryFee)} />
                    <Info label="Minimum" value={money(shop.minimumOrder)} />
                    <Info label="Délai estimé" value={`${shop.deliveryTime ?? 30} min`} />
                  </View>
                  {imageUri(shop.imageUrl) ? <View style={s.secondary}><Text style={[s.section, { color: c.mutedForeground }]}>IMAGE SECONDAIRE</Text><Image source={{ uri: imageUri(shop.imageUrl)! }} contentFit="cover" style={s.secondaryImage} /></View> : null}
                </View>
              </View> : <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={[ui.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius }]}>
                  <View style={s.editHeader}><Text style={[s.editTitle, { color: c.foreground }]}>Modifier le profil</Text><Pressable onPress={() => { setEditing(false); setForm(null); }} accessibilityLabel="Annuler"><Feather name="x" size={20} color={c.mutedForeground} /></Pressable></View>
                  {formError || mediaError ? <Text style={[s.error, { color: c.destructive }]}>{formError || mediaError}</Text> : null}
                  {form ? <><MediaField label="Logo de la boutique" value={form.logoUrl} kind="logo" onChange={(value) => set('logoUrl', value)} onError={setMediaError} /><MediaField label="Image principale (couverture)" value={form.coverImageUrl} kind="banner" onChange={(value) => set('coverImageUrl', value)} onError={setMediaError} /><MediaField label="Image secondaire" value={form.imageUrl} kind="image" onChange={(value) => set('imageUrl', value)} onError={setMediaError} />
                    <Field label="Nom de la boutique" value={form.name} onChangeText={(value) => set('name', value)} required />
                    <Text style={[s.label, { color: c.foreground }]}>Type de commerce *</Text>
                    <View style={s.typeGrid}>{BUSINESS_TYPES.map(([value, label]) => <Pressable key={value} onPress={() => set('businessType', value)} style={[s.typeOption, { backgroundColor: form.businessType === value ? c.secondary : c.background, borderColor: form.businessType === value ? c.primary : c.border }]}><Text style={{ color: c.foreground, fontFamily: font.medium }}>{label}</Text></Pressable>)}</View>
                    <Field label="Téléphone" value={form.phone} onChangeText={(value) => set('phone', value)} keyboardType="phone-pad" required />
                    <Field label="Catégorie principale" value={form.category} onChangeText={(value) => set('category', value)} required />
                    <Field label="Adresse" value={form.address} onChangeText={(value) => set('address', value)} required />
                    <Field label="Description" value={form.description} onChangeText={(value) => set('description', value)} multiline />
                    <Text style={[s.section, { color: c.mutedForeground }]}>PARAMÈTRES DE SERVICE</Text>
                    <Field label="Frais de livraison (MAD)" value={form.deliveryFee} onChangeText={(value) => set('deliveryFee', value)} keyboardType="decimal-pad" required />
                    <Field label="Commande minimum (MAD)" value={form.minimumOrder} onChangeText={(value) => set('minimumOrder', value)} keyboardType="decimal-pad" required />
                    <Field label="Temps de livraison (minutes)" value={form.deliveryTime} onChangeText={(value) => set('deliveryTime', value)} keyboardType="numeric" required />
                    <View style={[s.switchRow, { borderColor: c.border }]}><View style={{ flex: 1 }}><Text style={[s.label, { color: c.foreground }]}>Boutique ouverte</Text><Text style={[s.hint, { color: c.mutedForeground }]}>Les clients peuvent découvrir et commander.</Text></View><Switch value={form.isOpen} onValueChange={(value) => set('isOpen', value)} trackColor={{ false: c.muted, true: c.secondary }} thumbColor={form.isOpen ? c.primary : c.mutedForeground} /></View>
                    <View style={s.formActions}><Button label="Annuler" variant="outline" onPress={() => { setEditing(false); setForm(null); }} /><Button label={update.isPending ? 'Enregistrement…' : 'Enregistrer'} icon="check" onPress={submit} loading={update.isPending} disabled={update.isPending} /></View>
                  </> : null}
                </View>
              </KeyboardAvoidingView>}
            </ScrollView>}
    </View>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = useColors();
  return <View style={s.info}><Text style={[s.infoLabel, { color: c.mutedForeground }]}>{label}</Text><Text style={[s.infoValue, { color: tone ?? c.foreground }]}>{value}</Text></View>;
}

const s = StyleSheet.create({
  content: { paddingTop: 4, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  loading: { padding: 20, gap: 14 }, empty: { textAlign: 'center', marginTop: 50, fontFamily: font.regular },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, shopPicker: { gap: 8, paddingBottom: 2 },
  shopChip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cover: { height: 190, position: 'relative' }, coverShade: { ...StyleSheet.absoluteFill, backgroundColor: '#00000066' },
  identity: { position: 'absolute', bottom: 18, left: 18, right: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  logo: { width: 66, height: 66, borderRadius: 14, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: font.displayStrong, fontSize: 28 }, coverName: { color: '#fff', fontFamily: font.display, fontSize: 23 }, coverMeta: { color: '#ffffffcc', fontFamily: font.regular, fontSize: 13, marginTop: 3 },
  cardBody: { padding: 18, gap: 14 }, section: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.4, marginTop: 6 }, description: { fontFamily: font.regular, lineHeight: 21, fontSize: 14 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, info: { width: '46%', minWidth: 130, gap: 4 }, infoLabel: { fontFamily: font.regular, fontSize: 12 }, infoValue: { fontFamily: font.semibold, fontSize: 14 },
  secondary: { gap: 8 }, secondaryImage: { width: '100%', aspectRatio: 1.8, borderRadius: 12 }, editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, editTitle: { fontFamily: font.display, fontSize: 20 },
  field: { gap: 7 }, label: { fontFamily: font.semibold, fontSize: 14 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, fontFamily: font.regular, fontSize: 15 }, textarea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  media: { gap: 8 }, mediaPreview: { height: 150, borderRadius: 12, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, mediaBusy: { ...StyleSheet.absoluteFill, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center' }, busyText: { color: '#fff', fontFamily: font.semibold }, mediaActions: { flexDirection: 'row', gap: 8, alignItems: 'center' }, mediaButton: { minHeight: 44, paddingHorizontal: 11, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, mediaButtonText: { fontFamily: font.semibold, fontSize: 12 }, remove: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, typeOption: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderRadius: 10, justifyContent: 'center' }, switchRow: { borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, hint: { fontFamily: font.regular, fontSize: 12, marginTop: 3 }, error: { fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
});