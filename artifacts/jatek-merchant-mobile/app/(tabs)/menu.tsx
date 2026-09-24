import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Card, EmptyState, Field, LoadingState, PrimaryButton, ScreenFrame } from '@/components/MerchantUI';
import { ImageField } from '@/components/ImageField';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/api';
import { mediaUri } from '@/lib/media';
import { merchantQueryKey } from '@/lib/query-client';
import type { BackendMe, MenuCategory, MenuProduct, MerchantShop, ProductPage } from '@/lib/types';
import { money } from '@/lib/types';

type ProductDraft = {
  name: string;
  price: string;
  category: string;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
};

const blankProduct = (category = ''): ProductDraft => ({
  name: '',
  price: '',
  category,
  description: '',
  imageUrl: '',
  isAvailable: true,
});

export default function MerchantMenuScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<MenuProduct | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftError, setDraftError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const shops = useQuery<MerchantShop[]>({ queryKey: merchantQueryKey('/api/backend/shops') });
  const me = useQuery<BackendMe>({ queryKey: merchantQueryKey('/api/backend/me') });
  const categories = useQuery<MenuCategory[]>({
    queryKey: merchantQueryKey('/api/backend/menu-categories'),
  });
  const params = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      search: search.trim() || undefined,
      category: category === 'all' ? undefined : category,
    }),
    [search, category],
  );
  const products = useQuery<ProductPage>({
    queryKey: merchantQueryKey('/api/backend/products/page', params),
  });
  const canEdit = Boolean(me.data && me.data.user.role !== 'employee');

  const invalidateProducts = () => {
    void client.invalidateQueries({ queryKey: ['/api/backend/products/page'] });
    void client.invalidateQueries({ queryKey: ['/api/backend/dashboard'] });
  };
  const createProduct = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/backend/products', { method: 'POST', json: payload }),
    onSuccess: () => {
      setDraft(null);
      setDraftError('');
      invalidateProducts();
    },
    onError: (error) => setDraftError(error instanceof Error ? error.message : 'Échec de l’ajout.'),
  });
  const updateProduct = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest(`/api/backend/products/${id}`, { method: 'PATCH', json: payload }),
    onSuccess: () => {
      setDraft(null);
      setSelected(null);
      setDraftError('');
      invalidateProducts();
    },
    onError: (error) => setDraftError(error instanceof Error ? error.message : 'Échec de la modification.'),
  });
  const deleteProduct = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/backend/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelected(null);
      invalidateProducts();
    },
  });
  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: number; isAvailable: boolean }) =>
      apiRequest(`/api/backend/products/${id}`, {
        method: 'PATCH',
        json: { isAvailable },
      }),
    onSuccess: invalidateProducts,
  });

  const openNewProduct = () => {
    if (!shops.data?.[0]?.id) {
      setDraftError('Aucune boutique n’est associée à votre compte.');
      return;
    }
    setIsUploading(false);
    setSelected(null);
    setDraft(blankProduct(categories.data?.[0]?.name ?? ''));
    setDraftError('');
  };
  const openEdit = (product: MenuProduct) => {
    setSelected(product);
    setDraft({
      name: product.name,
      price: String(product.price),
      category: product.category,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      isAvailable: product.isAvailable,
    });
    setIsUploading(false);
    setDraftError('');
  };
  const saveProduct = () => {
    if (!draft?.name.trim() || !draft.category.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) {
      setDraftError('Vérifiez le nom, le prix et la catégorie de l’article.');
      return;
    }
    const common = {
      name: draft.name.trim(),
      price: Number(draft.price),
      category: draft.category.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim() || null,
      isAvailable: draft.isAvailable,
    };
    if (selected) {
      updateProduct.mutate({ id: selected.id, payload: common });
      return;
    }
    const shopId = shops.data?.[0]?.id;
    if (!shopId) {
      setDraftError('Aucune boutique n’est associée à votre compte.');
      return;
    }
    createProduct.mutate({ ...common, restaurantId: shopId });
  };

  return (
    <ScreenFrame
      title="Menu"
      eyebrow="VOTRE OFFRE"
      subtitle={`${products.data?.total ?? 0} articles dans le catalogue.`}
      onRefresh={() => {
        void Promise.all([products.refetch(), categories.refetch(), shops.refetch()]);
      }}
      refreshing={products.isRefetching}
      rightAction={
        canEdit && shops.data?.[0] ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un article"
            testID="button-add-product"
            onPress={openNewProduct}
            style={({ pressed }) => [
              styles.headerAdd,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Feather name="plus" size={19} color="#ffffff" />
          </Pressable>
        ) : null
      }
    >
      <Field
        label="Rechercher dans le menu"
        value={search}
        onChangeText={setSearch}
        placeholder="Nom d’article ou catégorie"
        autoCorrect={false}
        testID="input-menu-search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryPill label="Tous les articles" selected={category === 'all'} onPress={() => setCategory('all')} testID="button-category-tous" />
        {(categories.data ?? []).map((item) => (
          <CategoryPill
            key={item.id}
            label={item.name}
            selected={category === item.name}
            onPress={() => setCategory(item.name)}
            testID={`button-category-${item.id}`}
          />
        ))}
      </ScrollView>

      {products.isLoading ? (
        <LoadingState />
      ) : products.isError ? (
        <LoadingState
          error={products.error instanceof Error ? products.error.message : undefined}
          onRetry={() => void products.refetch()}
        />
      ) : (products.data?.items ?? []).length === 0 ? (
        <EmptyState
          title="Votre menu est vide"
          detail={search ? 'Aucun article ne correspond à la recherche.' : 'Ajoutez un premier article pour commencer.'}
          icon="book-open"
        />
      ) : (
        <View style={styles.productList}>
          {(products.data?.items ?? []).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              canEdit={canEdit}
              onOpen={() => setSelected(product)}
              onEdit={() => openEdit(product)}
              onToggle={() => toggleAvailability.mutate({ id: product.id, isAvailable: !product.isAvailable })}
              onDelete={() =>
                Alert.alert(
                  'Supprimer cet article ?',
                  'Il ne pourra plus être commandé. Les articles déjà liés à des commandes ne peuvent pas être supprimés.',
                  [
                    { text: 'Garder', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: () => deleteProduct.mutate(product.id) },
                  ],
                )
              }
              busy={toggleAvailability.isPending || deleteProduct.isPending}
            />
          ))}
        </View>
      )}

      <ProductModal
        visible={Boolean(draft)}
        isEditing={Boolean(selected && draft)}
        draft={draft}
        categories={categories.data ?? []}
        error={draftError}
        busy={createProduct.isPending || updateProduct.isPending}
        uploading={isUploading}
        onUploading={setIsUploading}
        onChange={(key, value) => setDraft((current) => current ? { ...current, [key]: value } : current)}
        onClose={() => {
          if (createProduct.isPending || updateProduct.isPending || isUploading) return;
          setDraft(null);
          setDraftError('');
        }}
        onSave={saveProduct}
      />

      <ProductDetailsModal
        product={selected && !draft ? selected : null}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onEdit={() => selected && openEdit(selected)}
        onToggle={() =>
          selected && toggleAvailability.mutate({ id: selected.id, isAvailable: !selected.isAvailable })
        }
        onDelete={() => selected && deleteProduct.mutate(selected.id)}
        busy={toggleAvailability.isPending || deleteProduct.isPending}
      />
    </ScreenFrame>
  );
}

function CategoryPill({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.categoryPill,
        { backgroundColor: selected ? colors.sidebar : colors.muted },
      ]}
    >
      <Text style={[styles.categoryText, { color: selected ? '#ffffff' : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProductCard({
  product,
  canEdit,
  onOpen,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  product: MenuProduct;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const colors = useColors();
  return (
    <Card style={styles.productCard}>
      <Pressable
        accessibilityRole="button"
        testID={`card-product-${product.id}`}
        onPress={onOpen}
        style={styles.productMain}
      >
        {product.imageUrl ? (
          <Image
            source={{ uri: mediaUri(product.imageUrl) }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.productImage, styles.imageFallback, { backgroundColor: colors.muted }]}>
            <Feather name="coffee" size={24} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.productCopy}>
          <View style={styles.productTitleRow}>
            <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={[styles.productPrice, { color: colors.foreground }]}>
              {money(product.price)}
            </Text>
          </View>
          <Text style={[styles.productCategory, { color: colors.primary }]} numberOfLines={1}>
            {product.category}
          </Text>
          <Text style={[styles.productDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
            {product.description || 'Aucune description'}
          </Text>
          <View style={styles.availabilityLine}>
            <View style={[styles.availabilityDot, { backgroundColor: product.isAvailable ? '#3c9c6c' : colors.mutedForeground }]} />
            <Text style={[styles.availability, { color: product.isAvailable ? colors.secondaryForeground : colors.mutedForeground }]}>
              {product.isAvailable ? 'Disponible' : 'En pause'}
            </Text>
          </View>
        </View>
      </Pressable>
      {canEdit ? (
        <View style={[styles.productActions, { borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${product.name}`}
            testID={`button-edit-product-${product.id}`}
            onPress={onEdit}
            style={styles.smallAction}
          >
            <Feather name="edit-3" size={16} color={colors.foreground} />
            <Text style={[styles.smallActionText, { color: colors.foreground }]}>Modifier</Text>
          </Pressable>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={product.isAvailable ? 'Mettre en pause' : 'Rendre disponible'}
            testID={`button-toggle-product-${product.id}`}
            onPress={onToggle}
            disabled={busy}
            style={styles.smallAction}
          >
            {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={product.isAvailable ? 'pause-circle' : 'play-circle'} size={16} color={colors.primary} />}
            <Text style={[styles.smallActionText, { color: colors.primary }]}>
              {product.isAvailable ? 'Mettre en pause' : 'Rendre disponible'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${product.name}`}
            testID={`button-delete-product-${product.id}`}
            onPress={onDelete}
            style={styles.deleteAction}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function ProductModal({
  visible,
  isEditing,
  draft,
  categories,
  error,
  busy,
  uploading,
  onUploading,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  isEditing: boolean;
  draft: ProductDraft | null;
  categories: MenuCategory[];
  error: string;
  busy: boolean;
  uploading: boolean;
  onUploading: (uploading: boolean) => void;
  onChange: (key: keyof ProductDraft, value: string | boolean) => void;
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
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {isEditing ? 'Modifier l’article' : 'Nouvel article'}
          </Text>
          <View style={styles.closeButton} />
        </View>
        {draft ? (
          <KeyboardAwareScrollViewCompat
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            <ImageField
              label="Photo de l’article"
              value={draft.imageUrl}
              kind="product_image"
              onUploading={onUploading}
              onChange={(url) => onChange('imageUrl', url)}
            />
            <Field label="Nom de l’article" value={draft.name} onChangeText={(value) => onChange('name', value)} placeholder="Ex. Bol méditerranéen" />
            <Field label="Prix (MAD)" value={draft.price} onChangeText={(value) => onChange('price', value.replace(',', '.'))} placeholder="0,00" keyboardType="decimal-pad" />
            <View style={styles.categorySelect}>
              <Text style={[styles.fieldTitle, { color: colors.foreground }]}>Catégorie</Text>
              <View style={styles.categoryChips}>
                {categories.map((item) => (
                  <CategoryPill
                    key={item.id}
                    label={item.name}
                    selected={draft.category === item.name}
                    onPress={() => onChange('category', item.name)}
                    testID={`select-product-category-${item.id}`}
                  />
                ))}
              </View>
              {categories.length === 0 ? (
                <Text style={[styles.formError, { color: colors.mutedForeground }]}>
                  Aucune catégorie n’est disponible. Vous ne pouvez pas enregistrer l’article sans catégorie.
                </Text>
              ) : null}
            </View>
            <Field label="Description" value={draft.description} onChangeText={(value) => onChange('description', value)} placeholder="Décrivez l’article" multiline numberOfLines={4} style={styles.multiline} />
            <View style={[styles.switchRow, { borderColor: colors.border }]}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: colors.foreground }]}>Disponible à la commande</Text>
                <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>Vous pouvez la modifier à tout moment.</Text>
              </View>
              <Switch
                value={draft.isAvailable}
                onValueChange={(value) => onChange('isAvailable', value)}
                trackColor={{ false: colors.border, true: colors.secondaryForeground }}
                thumbColor="#ffffff"
                testID="switch-product-availability"
              />
            </View>
            {error ? <Text accessibilityRole="alert" style={[styles.formError, { color: colors.destructive }]}>{error}</Text> : null}
            <PrimaryButton
              label={isEditing ? 'Enregistrer les changements' : 'Ajouter au menu'}
              onPress={onSave}
              busy={busy}
              disabled={uploading}
              testID="button-save-product"
            />
          </KeyboardAwareScrollViewCompat>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProductDetailsModal({
  product,
  canEdit,
  onClose,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  product: MenuProduct | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={Boolean(product)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.detailOverlay}>
        <View style={[styles.detailSheet, { backgroundColor: colors.card }]}>
          {product ? (
            <>
              <View style={styles.detailHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Détail de l’article</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={21} color={colors.foreground} />
                </Pressable>
              </View>
              {product.imageUrl ? (
                <Image source={{ uri: mediaUri(product.imageUrl) }} style={styles.detailImage} resizeMode="cover" />
              ) : null}
              <Text style={[styles.detailName, { color: colors.foreground }]}>{product.name}</Text>
              <Text style={[styles.detailPrice, { color: colors.primary }]}>{money(product.price)}</Text>
              <Text style={[styles.detailCategory, { color: colors.mutedForeground }]}>{product.category}</Text>
              <Text style={[styles.detailDescription, { color: colors.foreground }]}>{product.description || 'Aucune description.'}</Text>
              <View style={styles.detailActions}>
                {canEdit ? (
                  <>
                    <PrimaryButton label="Modifier" onPress={onEdit} variant="soft" icon={<Feather name="edit-3" size={15} color={colors.secondaryForeground} />} />
                    <PrimaryButton label={product.isAvailable ? 'Mettre en pause' : 'Rendre disponible'} onPress={onToggle} busy={busy} variant="outline" />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer l’article"
                      onPress={() =>
                        Alert.alert('Supprimer cet article ?', 'Cette action ne peut pas être annulée.', [
                          { text: 'Garder', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: onDelete },
                        ])
                      }
                      style={styles.deleteDetail}
                    >
                      <Feather name="trash-2" size={18} color={colors.destructive} />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerAdd: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 14 },
  categoryPill: { minHeight: 36, borderRadius: 100, paddingHorizontal: 12, justifyContent: 'center' },
  categoryText: { fontSize: 11, fontWeight: '800' },
  productList: { gap: 11 },
  productCard: { padding: 12, gap: 12 },
  productMain: { flexDirection: 'row', gap: 12 },
  productImage: { width: 86, height: 94, borderRadius: 13 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  productTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7 },
  productName: { flex: 1, fontSize: 13, fontWeight: '800' },
  productPrice: { fontSize: 12, fontWeight: '800' },
  productCategory: { marginTop: 3, fontSize: 10, fontWeight: '700' },
  productDescription: { marginTop: 5, fontSize: 10, lineHeight: 14 },
  availabilityLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  availabilityDot: { width: 6, height: 6, borderRadius: 6 },
  availability: { fontSize: 10, fontWeight: '700' },
  productActions: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  smallActionText: { fontSize: 10, fontWeight: '700' },
  actionDivider: { width: 1, height: 22 },
  deleteAction: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  modalRoot: { flex: 1 },
  modalHeader: { minHeight: 58, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 17, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 40 },
  categorySelect: { gap: 8 },
  fieldTitle: { fontSize: 12, fontWeight: '700' },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  switchRow: { minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9 },
  switchCopy: { flex: 1, paddingRight: 8 },
  switchTitle: { fontSize: 12, fontWeight: '700' },
  switchHint: { marginTop: 4, fontSize: 10, lineHeight: 15 },
  formError: { fontSize: 12, lineHeight: 18 },
  detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 24, 39, 0.45)' },
  detailSheet: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 20, paddingBottom: 35, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  detailImage: { width: '100%', height: 200, borderRadius: 17, marginBottom: 15 },
  detailName: { fontSize: 21, fontWeight: '800' },
  detailPrice: { marginTop: 4, fontSize: 17, fontWeight: '800' },
  detailCategory: { marginTop: 4, fontSize: 12 },
  detailDescription: { marginTop: 13, fontSize: 13, lineHeight: 19 },
  detailActions: { gap: 9, marginTop: 20 },
  deleteDetail: { minHeight: 45, alignItems: 'center', justifyContent: 'center' },
});