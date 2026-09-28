import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMerchantCategories, useMerchantProducts, useMerchantShops, useCreateMerchantProduct, useUpdateMerchantProduct, useDeleteMerchantProduct, type MerchantProduct, type MenuCategory } from '@/lib/merchant-parity-data';
import { uploadMerchantImage } from '@/lib/merchant-upload';
import { Button, ErrorState, SkeletonCards, StateView, font, styles as ui } from '@/components/ui';
import { ScreenHeader, useBottomPad } from '@/components/ScreenHeader';

type Draft = { name: string; price: string; category: string; categoryId?: number; description: string; isAvailable: boolean; imageUrl: string };

const blankDraft = (category?: MenuCategory): Draft => ({
  name: '', price: '', category: category?.name ?? '', categoryId: category?.id, description: '', isAvailable: true, imageUrl: '',
});

function euro(value: number) {
  return `${value.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

export default function MenuScreen() {
  const c = useColors();
  const bottom = useBottomPad();
  const shops = useMerchantShops();
  const shopId = shops.data?.[0]?.id;
  const categories = useMerchantCategories(shopId);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const products = useMerchantProducts({ search: search.trim() || undefined, category: category || undefined });
  const update = useUpdateMerchantProduct();
  const remove = useDeleteMerchantProduct();
  const create = useCreateMerchantProduct();
  const [modal, setModal] = useState<'form' | 'detail' | null>(null);
  const [selected, setSelected] = useState<MerchantProduct | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [uploading, setUploading] = useState(false);

  const items = products.data?.items ?? [];
  const availableCategories = useMemo(() => (categories.data ?? []).filter((x) => x.isActive !== false), [categories.data]);

  const openCreate = () => {
    setSelected(null);
    setDraft(blankDraft(availableCategories[0]));
    setModal('form');
  };
  const openEdit = (item: MerchantProduct) => {
    setSelected(item);
    setDraft({
      name: item.name, price: String(item.price), category: item.category ?? '',
      categoryId: item.menuItemCategoryId ?? undefined, description: item.description ?? '',
      isAvailable: item.isAvailable, imageUrl: item.imageUrl ?? '',
    });
    setModal('form');
  };
  const chooseCategory = (item: MenuCategory) => setDraft((x) => ({ ...x, category: item.name, categoryId: item.id }));

  const pickImage = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission nécessaire', camera ? 'Autorisez la caméra pour photographier cet article.' : 'Autorisez l’accès aux photos pour choisir une image.');
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadMerchantImage(asset.uri, asset.mimeType ?? 'image/jpeg', 'image');
      setDraft((x) => ({ ...x, imageUrl: url }));
    } catch (error) {
      Alert.alert('Téléversement impossible', error instanceof Error ? error.message : 'Réessayez.');
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!shopId || !draft.name.trim() || !draft.category.trim()) return;
    const price = Number(draft.price.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Prix invalide', 'Saisissez un prix en MAD supérieur ou égal à zéro.');
      return;
    }
    const body = {
      name: draft.name.trim(), price, category: draft.category.trim(),
      menuItemCategoryId: draft.categoryId, description: draft.description.trim(),
      isAvailable: draft.isAvailable, imageUrl: draft.imageUrl || undefined,
    };
    if (selected) {
      update.mutate({ id: selected.id, data: body }, { onSuccess: () => setModal(null) });
    } else {
      create.mutate({ restaurantId: shopId, ...body }, { onSuccess: () => setModal(null) });
    }
  };

  const toggle = (item: MerchantProduct) => update.mutate({ id: item.id, data: { isAvailable: !item.isAvailable } });
  const deleteItem = (item: MerchantProduct) => Alert.alert('Supprimer cet article ?', 'Cette action ne peut pas être annulée.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate({ id: item.id }, { onSuccess: () => setModal(null) }) },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader kicker={products.data ? `${products.data.total} articles` : 'Votre offre'} title="Menu"
        right={<Pressable accessibilityRole="button" accessibilityLabel="Ajouter un article" onPress={openCreate} style={[s.add, { backgroundColor: c.primary }]}><Feather name="plus" size={19} color={c.primaryForeground} /></Pressable>} />
      {products.isPending ? <SkeletonCards count={4} /> : products.isError && !products.data ? <ErrorState error={products.error} onRetry={() => products.refetch()} /> : (
        <>
          <View style={[s.search, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
            <Feather name="search" size={17} color={c.mutedForeground} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Chercher dans le menu" placeholderTextColor={c.mutedForeground} style={[s.searchInput, { color: c.foreground }]} />
            {search ? <Pressable onPress={() => setSearch('')} accessibilityLabel="Effacer la recherche"><Feather name="x-circle" size={18} color={c.mutedForeground} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            <Pressable onPress={() => setCategory('')} style={[s.filter, { backgroundColor: !category ? c.ink : c.muted }]}><Text style={[s.filterText, { color: !category ? c.inkForeground : c.mutedForeground }]}>Tous</Text></Pressable>
            {availableCategories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item.name)} style={[s.filter, { backgroundColor: category === item.name ? c.ink : c.muted }]}><Text style={[s.filterText, { color: category === item.name ? c.inkForeground : c.mutedForeground }]}>{item.name}</Text></Pressable>)}
          </ScrollView>
          {products.isError ? <Text style={[s.stale, { color: c.destructive }]}>Actualisation échouée. Tirez pour réessayer.</Text> : null}
          <FlatList
            data={items}
            keyExtractor={(x) => String(x.id)}
            contentContainerStyle={[s.list, { paddingBottom: bottom }]}
            refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => products.refetch()} tintColor={c.primary} colors={[c.primary]} />}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setSelected(item); setModal('detail'); }} style={({ pressed }) => [ui.card, s.card, { backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: c.radius, opacity: pressed ? 0.86 : 1 }]}>
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} contentFit="cover" style={s.image} /> : <View style={[s.image, { backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' }]}><Feather name="coffee" size={28} color={c.mutedForeground} /></View>}
                <View style={s.cardBody}>
                  <View style={s.between}><Text style={[s.name, { color: c.foreground }]} numberOfLines={1}>{item.name}</Text><Text style={[s.price, { color: c.foreground }]}>{euro(item.price)}</Text></View>
                  <Text style={[s.category, { color: c.primary }]}>{item.category || 'Sans catégorie'}</Text>
                  <Text style={[s.description, { color: c.mutedForeground }]} numberOfLines={2}>{item.description || 'Aucune description ajoutée pour le moment.'}</Text>
                  <View style={s.actions}><View style={[s.status, { backgroundColor: item.isAvailable ? c.secondary : c.muted }]}><View style={[s.dot, { backgroundColor: item.isAvailable ? c.secondaryForeground : c.mutedForeground }]} /><Text style={[s.statusText, { color: item.isAvailable ? c.secondaryForeground : c.mutedForeground }]}>{item.isAvailable ? 'Disponible' : 'En pause'}</Text></View><Pressable onPress={() => toggle(item)} accessibilityLabel={item.isAvailable ? `Mettre ${item.name} en pause` : `Rendre ${item.name} disponible`} style={[s.toggle, { borderColor: c.border }]}><Feather name={item.isAvailable ? 'pause' : 'play'} size={14} color={c.primary} /><Text style={[s.toggleText, { color: c.primary }]}>{item.isAvailable ? 'Pause' : 'Activer'}</Text></Pressable></View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<StateView icon="coffee" title="Aucun article" message={search || category ? 'Essayez une autre recherche ou catégorie.' : 'Ajoutez votre premier article au menu.'} actionLabel={search || category ? 'Actualiser' : 'Ajouter un article'} onAction={search || category ? () => products.refetch() : openCreate} />}
          />
        </>
      )}
      <Modal visible={modal !== null} animationType="slide" onRequestClose={() => setModal(null)} transparent>
        <View style={[s.modalBackdrop, { backgroundColor: `${c.ink}99` }]}>
          <View style={[s.sheet, { backgroundColor: c.background }]}>
            <View style={s.sheetHeader}><Text style={[s.sheetTitle, { color: c.foreground }]}>{modal === 'form' ? (selected ? 'Modifier l’article' : 'Ajouter un article') : selected?.name}</Text><Pressable onPress={() => setModal(null)} accessibilityLabel="Fermer"><Feather name="x" size={22} color={c.mutedForeground} /></Pressable></View>
            {modal === 'detail' && selected ? <ScrollView contentContainerStyle={s.form}>
              {selected.imageUrl ? <Image source={{ uri: selected.imageUrl }} contentFit="cover" style={s.detailImage} /> : null}
              <Text style={[s.category, { color: c.primary }]}>{selected.category || 'Sans catégorie'}</Text><Text style={[s.detailName, { color: c.foreground }]}>{selected.name}</Text><Text style={[s.description, { color: c.mutedForeground }]}>{selected.description || 'Aucune description ajoutée pour le moment.'}</Text>
              <Text style={[s.detailPrice, { color: c.foreground }]}>{euro(selected.price)}</Text>
              <Button label={selected.isAvailable ? 'Mettre en pause' : 'Rendre disponible'} icon={selected.isAvailable ? 'pause' : 'play'} onPress={() => { toggle(selected); setModal(null); }} loading={update.isPending} />
              <Button label="Modifier les détails" icon="edit-2" variant="outline" onPress={() => openEdit(selected)} />
              <Button label="Supprimer l’article" icon="trash-2" variant="danger" onPress={() => deleteItem(selected)} loading={remove.isPending} />
            </ScrollView> : <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
              <Field label="Nom" value={draft.name} onChangeText={(v) => setDraft((x) => ({ ...x, name: v }))} placeholder="Ex. Tajine poulet" />
              <Field label="Prix (MAD)" value={draft.price} onChangeText={(v) => setDraft((x) => ({ ...x, price: v }))} placeholder="0,00" keyboardType="decimal-pad" />
              <Text style={[s.label, { color: c.foreground }]}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryList}>{availableCategories.map((item) => <Pressable key={item.id} onPress={() => chooseCategory(item)} style={[s.categoryChip, { backgroundColor: draft.categoryId === item.id ? c.primary : c.muted }]}><Text style={{ color: draft.categoryId === item.id ? c.primaryForeground : c.mutedForeground, fontFamily: font.semibold }}>{item.name}</Text></Pressable>)}</ScrollView>
              <Field label="Description" value={draft.description} onChangeText={(v) => setDraft((x) => ({ ...x, description: v }))} placeholder="Décrivez cet article" multiline />
              <Text style={[s.label, { color: c.foreground }]}>Image du produit</Text>
              {draft.imageUrl ? <View><Image source={{ uri: draft.imageUrl }} contentFit="cover" style={s.preview} /><Pressable onPress={() => setDraft((x) => ({ ...x, imageUrl: '' }))} style={s.removeImage}><Feather name="x" size={16} color="#fff" /></Pressable></View> : null}
              <View style={s.imageButtons}><Button label="Galerie" icon="image" variant="outline" onPress={() => pickImage(false)} loading={uploading} /><Button label="Caméra" icon="camera" onPress={() => pickImage(true)} loading={uploading} /></View>
              <Pressable onPress={() => setDraft((x) => ({ ...x, isAvailable: !x.isAvailable }))} style={[s.checkbox, { borderColor: c.border }]}><View style={[s.check, { backgroundColor: draft.isAvailable ? c.primary : 'transparent', borderColor: draft.isAvailable ? c.primary : c.border }]}>{draft.isAvailable ? <Feather name="check" size={13} color={c.primaryForeground} /> : null}</View><View><Text style={[s.label, { color: c.foreground, marginBottom: 2 }]}>Disponible à la commande</Text><Text style={[s.help, { color: c.mutedForeground }]}>Les clients peuvent commander cet article.</Text></View></Pressable>
              {(create.isError || update.isError) ? <Text style={[s.error, { color: c.destructive }]}>Enregistrement impossible. Vérifiez les champs et réessayez.</Text> : null}
              <Button label={selected ? 'Enregistrer' : 'Ajouter l’article'} icon="check" onPress={save} loading={create.isPending || update.isPending || uploading} disabled={!draft.name.trim() || !draft.category.trim()} />
            </ScrollView>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: 'default' | 'decimal-pad' }) {
  const c = useColors();
  return <View style={{ gap: 7 }}><Text style={[s.label, { color: c.foreground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.mutedForeground} multiline={multiline} keyboardType={keyboardType} style={[s.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.card, minHeight: multiline ? 94 : 50, textAlignVertical: multiline ? 'top' : 'center' }]} /></View>;
}

const s = StyleSheet.create({
  add: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 48, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minHeight: 46, fontFamily: font.regular, fontSize: 14 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filter: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' },
  filterText: { fontFamily: font.semibold, fontSize: 13 },
  stale: { marginHorizontal: 16, marginBottom: 8, fontFamily: font.medium, fontSize: 12 },
  list: { gap: 10, paddingHorizontal: 16, paddingTop: 2 },
  card: { padding: 0, overflow: 'hidden' },
  image: { width: '100%', height: 142 },
  cardBody: { padding: 14, gap: 7 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: font.bold, fontSize: 17 },
  price: { fontFamily: font.bold, fontSize: 15 },
  category: { fontFamily: font.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },
  description: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: font.semibold, fontSize: 12 },
  toggle: { minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontFamily: font.semibold, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '94%', minHeight: '54%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18 },
  sheetHeader: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: font.display, fontSize: 22, flex: 1 },
  form: { padding: 20, gap: 15, paddingBottom: 36 },
  label: { fontFamily: font.semibold, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontFamily: font.regular, fontSize: 15 },
  categoryList: { gap: 8 },
  categoryChip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  help: { fontFamily: font.regular, fontSize: 12 },
  checkbox: { minHeight: 62, borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  imageButtons: { flexDirection: 'row', gap: 8 },
  preview: { height: 170, width: '100%', borderRadius: 13 },
  removeImage: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0008' },
  error: { fontFamily: font.medium, fontSize: 13 },
  detailImage: { height: 190, width: '100%', borderRadius: 14 },
  detailName: { fontFamily: font.display, fontSize: 28 },
  detailPrice: { fontFamily: font.bold, fontSize: 20 },
});