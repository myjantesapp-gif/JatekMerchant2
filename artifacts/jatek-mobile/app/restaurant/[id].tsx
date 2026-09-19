import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity,
  Image, ActivityIndicator, Platform, ScrollView, Animated, Pressable, Modal, Linking,
  Share, TextInput,
  RefreshControl,
  SectionList,
  NativeScrollEvent, NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGetRestaurant, useGetRestaurantHeader, useListMenuItems } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { MenuItemGridCard } from "@/components/MenuItemGridCard";
import { MenuItemDetailModal } from "@/components/MenuItemDetailModal";
import type { MenuItemSize, MenuItemExtra } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listFavorites, addFavorite, removeFavorite, geocodeAddress } from "@/lib/api";
import { useT } from "@/contexts/LanguageContext";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { refreshAll } from "@/lib/mobileRefresh";
import {
  chunkMenuItems,
  filterAndSortMenuItems,
  groupMenuSections,
  normalizeMenuGridRow,
} from "@/lib/catalogUtils";

const SIDE = 16;
const MENU_GRID_GAP = 12;
const HERO_H = 240;
const CATEGORY_STICKY_HEIGHT = 54;
const CATEGORY_OVERLAY_TOP_GAP = 8;
const COMPACT_HEADER_HEIGHT = 56;
const GOOGLE_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "").trim();

function buildRestaurantMapHtml(lat: number, lng: number, name: string, logoUri: string): string {
  const safeName = name.replace(/'/g, "\\'");
  const safeLogoUri = logoUri.replace(/'/g, "\\'");
  if (GOOGLE_KEY) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body,html,#map{width:100%;height:100%}</style></head><body><div id="map"></div><script>
function init(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${lat},lng:${lng}},zoom:16,disableDefaultUI:true});
  new google.maps.Marker({position:{lat:${lat},lng:${lng}},map:map,title:'${safeName}',icon:{url:'${safeLogoUri}',scaledSize:new google.maps.Size(40,40),anchor:new google.maps.Point(20,20)}});
}
</script><script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&callback=init" async defer></script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>*{margin:0;padding:0}body,html,#map{width:100%;height:100%}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var icon=L.divIcon({html:'<img src="${safeLogoUri}" alt="Jatek" style="width:40px;height:40px;border-radius:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);object-fit:cover"/>',iconSize:[40,40],iconAnchor:[20,20],className:''});
L.marker([${lat},${lng}],{icon:icon}).addTo(map).bindPopup('${safeName}');
</script></body></html>`;
}

export default function RestaurantScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const t = useT();
  const { id, productId } = useLocalSearchParams<{ id: string; productId?: string }>();
  const restaurantId = parseInt(id, 10);
  const menuCardWidth = (viewportWidth - SIDE * 2 - MENU_GRID_GAP) / 2;
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { items: cartItems, addItem, addItemWithQty, updateQuantity, restaurantId: cartRestaurantId, itemCount } = useCart();
  const { token } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [categoryPinned, setCategoryPinned] = useState(false);
  const [headerPinned, setHeaderPinned] = useState(false);
  const menuScrollRef = useRef<SectionList<any>>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const floatingCategoryScrollRef = useRef<ScrollView>(null);
  const categoryBarOffsetRef = useRef<number | null>(null);
  const categoryOffsetsRef = useRef<Record<string, number>>({});
  const isProgrammaticScroll = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSectionIndexRef = useRef<number | null>(null);
  const scrollRetryCountRef = useRef(0);

  useEffect(() => {
    if (!token || !restaurantId) return;
    listFavorites().then((rows) => setIsFav(rows.some((r) => r.restaurantId === restaurantId))).catch(() => {});
  }, [token, restaurantId]);

  const toggleFav = async () => {
    if (!token) { router.push("/(auth)/login" as any); return; }
    const next = !isFav;
    setIsFav(next);
    try {
      if (next) await addFavorite(restaurantId);
      else await removeFavorite(restaurantId);
    } catch { setIsFav(!next); }
  };

  const {
    data: restaurant,
    isLoading: rLoading,
    isError: restaurantError,
    refetch: refetchRestaurant,
  } = useGetRestaurant(restaurantId);
  const { data: restaurantHeader, refetch: refetchRestaurantHeader } = useGetRestaurantHeader(restaurantId);
  const {
    data: menuItems,
    isLoading: mLoading,
    isError: menuError,
    refetch: refetchMenu,
  } = useListMenuItems(restaurantId);
  const safeMenuItems = useMemo(
    () => (Array.isArray(menuItems) ? menuItems : []),
    [menuItems],
  );
  const { data: productCategories, refetch: refetchProductCategories } = useQuery<Array<{ id: number; name: string; sortOrder: number }>>({
    queryKey: ["/api/menu-categories", restaurantId],
    queryFn: () => apiFetch(`/api/menu-categories?restaurantId=${restaurantId}`),
    enabled: Number.isInteger(restaurantId) && restaurantId > 0,
  });

  useEffect(() => {
    if (!infoModalOpen || restaurantCoords || !restaurant) return;
    geocodeAddress(restaurant.address).then((pos) => { if (pos) setRestaurantCoords(pos); }).catch(() => {});
  }, [infoModalOpen, restaurant, restaurantCoords]);

  // Home recommendation cards can deep-link to a product while preserving the
  // normal merchant menu screen and its existing detail modal/cart flow.
  useEffect(() => {
    const requestedProductId = Number(productId);
    if (!Number.isInteger(requestedProductId) || requestedProductId <= 0) return;
    const requestedProduct = safeMenuItems.find((item) => item.id === requestedProductId);
    // Recommendation links can outlive an availability change. Keep the
    // merchant page usable, but never open a stale/unavailable item through
    // the deep-link path.
    if (requestedProduct?.isAvailable === true) setSelectedItem(requestedProduct);
  }, [productId, safeMenuItems]);

  const categories = useMemo(() => {
    const fromApi = [...(productCategories ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((category) => ({
        id: String(category.id),
        name: category.name.trim(),
      }));
    const knownNames = new Set(fromApi.map((category) => category.name.trim().toLocaleLowerCase()));
    const legacyCategories = Array.from(
      new Map(
        safeMenuItems
          .map((item: any) => (typeof item.category === "string" ? item.category.trim() : ""))
          .filter((name) => name.length > 0 && !knownNames.has(name.toLocaleLowerCase()))
          .map((name) => [name.toLocaleLowerCase(), name] as const),
      ).values(),
    ).map((name) => ({ id: `legacy:${name}`, name }));

    return [{ id: "Tous", name: "Tous" }, ...fromApi, ...legacyCategories];
  }, [productCategories, safeMenuItems]);
  const filtered = useMemo(() => {
    return filterAndSortMenuItems(safeMenuItems, {
      categories,
      activeCategory: "Tous",
      searchQuery,
      sortMode: "recommended",
    });
  }, [safeMenuItems, searchQuery, categories]);

  const sections = useMemo(() => {
    return groupMenuSections(categories, filtered, "Tous");
  }, [categories, filtered]);
  const virtualSections = useMemo(
    () => sections.map((section) => ({
      ...section,
       data: chunkMenuItems(section.items),
    })),
    [sections],
  );

  useEffect(() => {
    const x = categoryOffsetsRef.current[activeCategory];
    if (x != null) {
      categoryScrollRef.current?.scrollTo({ x: Math.max(0, x - SIDE), animated: true });
      floatingCategoryScrollRef.current?.scrollTo({ x: Math.max(0, x - SIDE), animated: true });
    }
  }, [activeCategory]);

  const handleMenuScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const categoryBarY = categoryBarOffsetRef.current;
    const pinThreshold = Math.max(
      0,
      (categoryBarY ?? HERO_H) - insets.top - CATEGORY_OVERLAY_TOP_GAP,
    );
    const nextHeaderPinned = scrollY >= pinThreshold;
    setHeaderPinned((current) => (current === nextHeaderPinned ? current : nextHeaderPinned));

    if (categories.length > 1 && categoryBarY != null) {
      const nextPinned = scrollY >= pinThreshold;
      setCategoryPinned((current) => (current === nextPinned ? current : nextPinned));
    } else {
      setCategoryPinned(false);
    }

    if (!isProgrammaticScroll.current && scrollY <= pinThreshold + 4) {
      setActiveCategory((current) => current === "Tous" ? current : "Tous");
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ section?: { id?: string } }> }) => {
    if (isProgrammaticScroll.current) return;
    const visibleSectionId = viewableItems.find((token) => token.section?.id)?.section?.id;
    if (visibleSectionId) {
      setActiveCategory((current) => current === visibleSectionId ? current : visibleSectionId);
    }
  }).current;

  const finishProgrammaticScroll = () => {
    if (!isProgrammaticScroll.current) return;
    isProgrammaticScroll.current = false;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = null;
    }
    pendingSectionIndexRef.current = null;
    scrollRetryCountRef.current = 0;
  };

  const scrollToMenuSection = (sectionIndex: number) => {
    menuScrollRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
      viewOffset: insets.top + COMPACT_HEADER_HEIGHT + CATEGORY_STICKY_HEIGHT + CATEGORY_OVERLAY_TOP_GAP,
    });
  };

  const jumpToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    isProgrammaticScroll.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);

    const sectionIndex = categoryId === "Tous"
      ? 0
      : virtualSections.findIndex((section) => section.id === categoryId);
    if (sectionIndex < 0) {
      finishProgrammaticScroll();
      return;
    }
    pendingSectionIndexRef.current = sectionIndex;
    scrollRetryCountRef.current = 0;

    requestAnimationFrame(() => {
      scrollToMenuSection(sectionIndex);
    });

    // Native platforms normally emit momentum end after an animated jump.
    // Keep a fallback so interrupted animations can never leave tracking locked.
    programmaticScrollTimerRef.current = setTimeout(finishProgrammaticScroll, 900);
  };

  const renderCategoryBar = (floating = false) => (
    <View
      onLayout={!floating ? (event) => {
        categoryBarOffsetRef.current = event.nativeEvent.layout.y;
      } : undefined}
      style={categories.length > 1
        ? [
          styles.stickyCategoryBar,
          !floating && styles.categoryBarInFlow,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]
        : styles.emptyCategoryBar}
    >
      {categories.length > 1 ? (
        <ScrollView
          ref={floating ? floatingCategoryScrollRef : categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onLayout={(event) => {
                  categoryOffsetsRef.current[cat.id] = event.nativeEvent.layout.x;
                }}
                onPress={() => {
                  jumpToCategory(cat.id);
                }}
                testID={`restaurant-category-${cat.id}`}
                style={({ pressed }) => [
                  styles.catChip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? `${colors.primary}14` : "transparent",
                  },
                  pressed && styles.catChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Aller à la catégorie ${cat.name}`}
              >
                <Text style={[
                  styles.catText,
                  { color: active ? colors.foreground : colors.mutedForeground },
                  active && { fontFamily: "Inter_700Bold" },
                ]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderPinnedHeader = () => (
    <View
      style={[
        styles.pinnedHeader,
        {
          top: insets.top,
          height: COMPACT_HEADER_HEIGHT,
          backgroundColor: "#FFFFFF",
          borderBottomColor: "#E5E7EB",
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.pinnedIconButton}
        hitSlop={8}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="arrow-back" size={21} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.pinnedHeaderTitle, { color: colors.foreground }]} numberOfLines={1}>
        {restaurant?.name}
      </Text>
      <View style={styles.pinnedHeaderActions}>
        <TouchableOpacity
          onPress={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setSearchQuery("");
          }}
          style={styles.pinnedIconButton}
          hitSlop={8}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Rechercher dans le menu"
        >
          <Ionicons name="search-outline" size={21} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const url = `https://ma.jatek.app/restaurant/${restaurantId}`;
            Share.share({ title: restaurant?.name, message: `${restaurant?.name} — ${url}`, url }).catch(() => {});
          }}
          style={styles.pinnedIconButton}
          hitSlop={8}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Partager le restaurant"
        >
          <Ionicons name="share-outline" size={21} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll([
        refetchRestaurant,
        refetchRestaurantHeader,
        refetchMenu,
        refetchProductCategories,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // The grid line has no size/extra selection. Do not sum variant lines here:
  // that makes a card appear to represent a different quantity than the
  // actual cart lines.
  const getQty = (itemId: number) =>
    cartItems.find((i) => i.cartLineId === String(itemId))?.quantity ?? 0;
  const businessType = restaurant?.businessType ?? "restaurant";
  const isServices = businessType === "services";
  const businessLabel = isServices ? "Marchand" : "Restaurant";

  if (rLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={styles.center} color={colors.primary} size="large" />
      </View>
    );
  }
  if (!restaurant) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name={restaurantError ? "cloud-offline-outline" : "search-outline"} size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          {restaurantError ? "Impossible de charger ce restaurant" : "Restaurant introuvable"}
        </Text>
        {restaurantError && (
          <>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
              Vérifiez votre connexion et réessayez.
            </Text>
            <TouchableOpacity onPress={() => refetchRestaurant()} style={[styles.retryBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // The dashboard's "Image bannière" field is imageUrl. Keep coverImageUrl
  // only as a legacy fallback so cards and detail always show the same banner.
  const heroUri = restaurantHeader?.headerUrl || restaurant.imageUrl || restaurant.coverImageUrl;
  const isOpen = restaurant.isOpen !== false;

  const Header = (
    <View>
      {/* ─── Hero image ─── */}
      <View style={styles.heroWrap}>
        {heroUri ? (
          <Image source={{ uri: resolveMediaUrl(heroUri) }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name={isServices ? "briefcase-outline" : "restaurant"} size={48} color={colors.mutedForeground} />
          </View>
        )}

        {/* Floating round controls */}
        <View style={[styles.heroTop, { top: 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.roundBtn} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.heroTopRight}>
            <TouchableOpacity onPress={toggleFav} style={styles.roundBtn} activeOpacity={0.85}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? colors.primary : colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.roundBtn}
              activeOpacity={0.85}
              onPress={() => {
                const url = `https://ma.jatek.app/restaurant/${restaurantId}`;
                Share.share({ title: restaurant.name, message: `${restaurant.name} — ${url}`, url }).catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityLabel="Partager le restaurant"
            >
              <Ionicons name="share-outline" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.roundBtn}
              activeOpacity={0.85}
              onPress={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setSearchQuery("");
              }}
              accessibilityRole="button"
              accessibilityLabel="Rechercher dans le menu"
            >
              <Ionicons name="search" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── Overlapping info card ─── */}
      <View style={styles.cardOuter}>
        <View style={[styles.infoCard, { backgroundColor: "#fff" }]}>
          <View style={styles.infoTopRow}>
            <View style={[styles.logoBox, { backgroundColor: "#fff" }]}>
              {restaurant.logoUrl ? (
                <Image source={{ uri: resolveMediaUrl(restaurant.logoUrl) }} style={styles.logoImg} resizeMode="contain" />
              ) : (
                <Text style={[styles.logoLetter, { color: colors.primary }]}>
                  {restaurant.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={[styles.rName, { color: colors.foreground }]} numberOfLines={1}>{restaurant.name}</Text>
              {restaurant.category ? (
                <Text style={[styles.rTags, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {restaurant.category}
                </Text>
              ) : null}
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={colors.yellow} />
                <Text style={[styles.ratingTxt, { color: colors.foreground }]}>
                  {restaurant.rating != null ? restaurant.rating.toFixed(1) : "—"}
                </Text>
                {restaurant.reviewCount != null && (
                  <Text style={[styles.ratingCount, { color: colors.mutedForeground }]}>
                    ({restaurant.reviewCount}+)
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => setInfoModalOpen(true)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {restaurant.deliveryTime != null ? `${restaurant.deliveryTime}-${restaurant.deliveryTime + 10} min` : "— min"}
              </Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={15} color={restaurant.deliveryFee === 0 ? colors.turquoise : colors.mutedForeground} />
              <Text style={[styles.metaText, {
                color: restaurant.deliveryFee === 0 ? colors.turquoise : colors.foreground,
                fontFamily: restaurant.deliveryFee === 0 ? "Inter_700Bold" : "Inter_600SemiBold",
              }]}>
                {restaurant.deliveryFee != null
                  ? (restaurant.deliveryFee === 0 ? "Gratuit" : `${restaurant.deliveryFee} MAD`)
                  : "—"}
              </Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <View style={[styles.openDot, { backgroundColor: isOpen ? colors.turquoise : "#9CA3AF" }]} />
              <Text style={[styles.metaText, {
                color: isOpen ? colors.turquoise : colors.mutedForeground,
                fontFamily: "Inter_700Bold",
              }]}>
                {isOpen ? "Ouvert" : "Fermé"}
              </Text>
            </View>
          </View>

        </View>
      </View>

      {/* Closed banner */}
      {!isOpen && (
        <View style={[styles.closedBanner]}>
          <View style={styles.closedBannerInner}>
            <Ionicons name="moon-outline" size={20} color="#fff" />
            <View style={styles.closedBannerText}>
              <Text style={styles.closedBannerTitle}>{businessLabel} fermé</Text>
              <Text style={styles.closedBannerSub}>
                Les commandes ne sont pas disponibles pour le moment. Revenez plus tard !
              </Text>
            </View>
          </View>
        </View>
      )}

      {searchOpen && (
        <View style={[styles.menuSearchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un plat…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.menuSearchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cart-conflict warning */}
      {cartRestaurantId && cartRestaurantId !== restaurantId && (
        <View style={[styles.warningBanner, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={[styles.warningText, { color: "#B45309" }]}>
            Ajouter des produits videra votre panier actuel
          </Text>
        </View>
      )}

      {mLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}
      {menuError && (
        <View style={styles.menuError}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Impossible de charger le menu.</Text>
          <TouchableOpacity onPress={() => refetchMenu()} style={[styles.retryBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SectionList
        ref={menuScrollRef}
        sections={virtualSections}
        keyExtractor={(row, index) => {
          const rowItems = normalizeMenuGridRow(row);
          return rowItems.length > 0
            ? rowItems.map((item) => item.id).join("-")
            : `menu-row-${index}`;
        }}
        ListHeaderComponent={(
          <>
            {Header}
            {renderCategoryBar()}
          </>
        )}
        ListEmptyComponent={filtered.length === 0 && !mLoading && !menuError ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="basket-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>Aucun produit pour le moment</Text>
          </View>
        ) : null}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionTitleWrap}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.name}</Text>
          </View>
        )}
        renderItem={({ item: row }) => {
          const rowItems = normalizeMenuGridRow(row);
          if (rowItems.length === 0) return null;
          return (
            <View style={styles.menuList}>
            {rowItems.map((item: any) => (
              <MenuItemGridCard
                key={item.id}
                item={item}
                width={menuCardWidth}
                quantity={getQty(item.id)}
                restaurantOpen={isOpen}
                onPressCard={() => setSelectedItem(item)}
                onAdd={() => {
                  if (!isOpen) return;
                  const pricing = restaurant as { deliveryFee?: number | null; freeDeliveryThreshold?: number | null; commissionRate?: number | null };
                  addItem(restaurantId, restaurant.name, { cartLineId: String(item.id), menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl }, { deliveryFee: pricing.deliveryFee, freeDeliveryThreshold: pricing.freeDeliveryThreshold, commissionRate: pricing.commissionRate });
                }}
              />
            ))}
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        onScroll={handleMenuScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={finishProgrammaticScroll}
        onScrollToIndexFailed={({ averageItemLength, index }) => {
          const sectionIndex = pendingSectionIndexRef.current;
          if (sectionIndex == null || scrollRetryCountRef.current >= 2) {
            finishProgrammaticScroll();
            return;
          }

          scrollRetryCountRef.current += 1;
          menuScrollRef.current?.getScrollResponder()?.scrollTo({
            y: Math.max(0, averageItemLength * index),
            animated: false,
          });
          setTimeout(() => scrollToMenuSection(sectionIndex), 80);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 15, minimumViewTime: 80 }}
        stickySectionHeadersEnabled={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + (itemCount > 0 || isServices ? 110 : 24) + (Platform.OS === "web" ? 34 : 0),
        }}
      />

      {categoryPinned && categories.length > 1 && (
        <View
          style={[
            styles.categoryOverlay,
            {
              top: insets.top + (headerPinned ? COMPACT_HEADER_HEIGHT : CATEGORY_OVERLAY_TOP_GAP),
            },
            { pointerEvents: "box-none" },
          ]}
        >
          {renderCategoryBar(true)}
        </View>
      )}

      {headerPinned && renderPinnedHeader()}

      {/* Quote CTA — service merchants */}
      {isServices && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 10) }]}>
          <TouchableOpacity
            style={[styles.cartBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/quote/new", params: { restaurantId: String(restaurantId), restaurantName: restaurant.name } })}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.cartBtnText} numberOfLines={1}>{t("quote_request")}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Cart pill */}
      {!isServices && itemCount > 0 && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 10) }]}>
          <CartPillButton
            count={itemCount}
            label={t("view_cart")}
            onPress={() => router.push("/cart")}
            color={colors.primary}
          />
        </View>
      )}

      {/* ─── Info modal : description, adresse, horaires ─── */}
      <Modal
        visible={infoModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setInfoModalOpen(false)}
      >
        <Pressable style={styles.infoModalBackdrop} onPress={() => setInfoModalOpen(false)}>
          <Pressable
            style={[styles.infoModalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.background }]}
            onPress={(event) => event.stopPropagation?.()}
          >
            {/* Handle bar */}
            <View style={[styles.infoModalHandle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.infoModalHeader}>
              <View style={[styles.infoModalLogoBox, { backgroundColor: colors.muted }]}>
                {restaurant.logoUrl ? (
                  <Image source={{ uri: resolveMediaUrl(restaurant.logoUrl) }} style={styles.infoModalLogoImg} resizeMode="contain" />
                ) : (
                  <Text style={[styles.infoModalLogoLetter, { color: colors.primary }]}>
                    {restaurant.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoModalName, { color: colors.foreground }]}>{restaurant.name}</Text>
                {restaurant.category ? (
                  <Text style={[styles.infoModalCategory, { color: colors.mutedForeground }]}>{restaurant.category}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setInfoModalOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoModalDivider, { backgroundColor: colors.border }]} />

            {/* Status row */}
            <View style={styles.infoModalRow}>
              <View style={[styles.infoModalIconWrap, { backgroundColor: (isOpen ? "#D1FAE5" : "#F3F4F6") }]}>
                <View style={[styles.openDot, { backgroundColor: isOpen ? colors.turquoise : "#9CA3AF" }]} />
              </View>
              <View style={{ flex: 1 }}>
                  <Text style={[styles.infoModalRowLabel, { color: colors.mutedForeground }]}>Statut du {businessLabel.toLowerCase()}</Text>
                <Text style={[styles.infoModalRowValue, { color: isOpen ? colors.turquoise : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {isOpen ? "Ouvert maintenant" : "Fermé pour le moment"}
                </Text>
              </View>
            </View>

            {/* Description */}
            {restaurant.description ? (
              <View style={styles.infoModalRow}>
                <View style={[styles.infoModalIconWrap, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="document-text-outline" size={16} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoModalRowLabel, { color: colors.mutedForeground }]}>Description</Text>
                  <Text style={[styles.infoModalRowValue, { color: colors.foreground }]}>{restaurant.description}</Text>
                </View>
              </View>
            ) : null}

            {/* Address + mini-map */}
            {restaurant.address ? (
              <>
                <View style={styles.infoModalRow}>
                  <View style={[styles.infoModalIconWrap, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="location-outline" size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoModalRowLabel, { color: colors.mutedForeground }]}>Adresse</Text>
                    <Text style={[styles.infoModalRowValue, { color: colors.foreground }]}>{restaurant.address}</Text>
                  </View>
                </View>
                {restaurantCoords ? (
                  <View style={styles.miniMapWrap}>
                    <WebView
                      style={[styles.miniMapWebView, { pointerEvents: "none" }]}
                      scrollEnabled={false}
                      source={{
                        html: buildRestaurantMapHtml(
                          restaurantCoords.lat,
                          restaurantCoords.lng,
                          restaurant.name ?? "",
                          Image.resolveAssetSource(require("../../assets/images/jatek-app-icon.png")).uri,
                        ),
                      }}
                      originWhitelist={["*"]}
                    />
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        const url = Platform.OS === "ios"
                          ? `maps://?ll=${restaurantCoords.lat},${restaurantCoords.lng}&q=${encodeURIComponent(restaurant.name ?? "")}`
                          : `geo:${restaurantCoords.lat},${restaurantCoords.lng}?q=${encodeURIComponent(restaurant.address)}`;
                        Linking.openURL(url).catch(() =>
                          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`),
                        );
                      }}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#fff" />
                      <Text style={styles.directionsBtnText}>Itinéraire</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Phone */}
            {restaurant.phone ? (
              <View style={styles.infoModalRow}>
                <View style={[styles.infoModalIconWrap, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="call-outline" size={16} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoModalRowLabel, { color: colors.mutedForeground }]}>Téléphone</Text>
                  <Text style={[styles.infoModalRowValue, { color: colors.foreground }]}>{restaurant.phone}</Text>
                </View>
              </View>
            ) : null}

            {/* Delivery info */}
            <View style={styles.infoModalRow}>
              <View style={[styles.infoModalIconWrap, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="bicycle-outline" size={16} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoModalRowLabel, { color: colors.mutedForeground }]}>Livraison</Text>
                <Text style={[styles.infoModalRowValue, { color: colors.foreground }]}>
                  {restaurant.deliveryFee === 0
                    ? "Gratuite"
                    : restaurant.deliveryFee != null
                    ? `${restaurant.deliveryFee} MAD`
                    : "—"
                  }
                  {restaurant.deliveryTime != null ? `  ·  ${restaurant.deliveryTime}–${restaurant.deliveryTime + 10} min` : ""}
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail modal — keeps existing UX */}
      <MenuItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        initialQty={selectedItem ? getQty(selectedItem.id) : 0}
        restaurantOpen={isOpen}
        onClose={() => setSelectedItem(null)}
        onAdd={({ qty, selectedSize, selectedSizeId, selectedExtras, selectedExtraIds, unitPrice, displayName, cartLineId }) => {
          if (!selectedItem || !isOpen || selectedItem.isAvailable === false) return;
          const pricing = restaurant as { deliveryFee?: number | null; freeDeliveryThreshold?: number | null; commissionRate?: number | null };
          // Use addItemWithQty so the cart directly reflects the qty chosen in
          // the modal rather than calling addItem N times (which mishandles
          // items already in the cart and fires N redundant state updates).
          addItemWithQty(restaurantId, restaurant.name, {
            cartLineId,
            menuItemId: selectedItem.id,
            name: displayName,
            price: unitPrice,
            imageUrl: selectedItem.imageUrl,
            selectedSize: selectedSize?.name,
            selectedSizeId: selectedSizeId ?? undefined,
            selectedSizePriceAdjustment: selectedSize?.priceAdjustment,
            selectedExtras: selectedExtras.map((e) => e.name),
            selectedExtraIds: selectedExtraIds.length ? selectedExtraIds : undefined,
          }, qty, { deliveryFee: pricing.deliveryFee, freeDeliveryThreshold: pricing.freeDeliveryThreshold, commissionRate: pricing.commissionRate });
        }}
      />
    </View>
  );
}

function CartPillButton({ count, label, onPress, color }: { count: number; label: string; onPress: () => void; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.spring(bounce, { toValue: 1, useNativeDriver: true, friction: 4, tension: 220 }),
        Animated.spring(bounce, { toValue: 0, useNativeDriver: true, friction: 5, tension: 180 }),
      ]).start();
    }
    prevCount.current = count;
  }, [count, bounce]);

  const onIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  const bumpScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={{ transform: [{ scale }, { scale: bumpScale }] }}>
        <View style={[styles.pillCartBtn, { backgroundColor: color }]}>
          <View style={styles.pillCartQty}>
            <Text style={[styles.pillCartQtyText, { color }]}>{count}</Text>
          </View>
          <Text style={styles.pillCartLabel} numberOfLines={1}>{label}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center", marginTop: 12, paddingHorizontal: 24 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", marginTop: 6, paddingHorizontal: 24 },
  retryBtn: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  retryBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  menuError: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 4 },

  // Hero
  heroWrap: { position: "relative" },
  hero: { width: "100%", height: HERO_H },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroTop: {
    position: "absolute", left: SIDE, right: SIDE,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  heroTopRight: { flexDirection: "row", gap: 10 },
  pinnedHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIDE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
    elevation: 30,
  },
  pinnedIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedHeaderTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  pinnedHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  roundBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  menuSearchWrap: {
    marginHorizontal: SIDE,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuSearchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  // Overlapping info card
  cardOuter: { paddingHorizontal: SIDE, marginTop: -44 },
  infoCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  infoTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBox: {
    width: 48, height: 48, borderRadius: 10,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  logoImg: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 19, fontFamily: "Inter_700Bold" },
  infoTextWrap: { flex: 1, gap: 1 },
  rName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  rTags: { fontSize: 11, fontFamily: "Inter_400Regular" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  ratingTxt: { fontSize: 12, fontFamily: "Inter_700Bold" },
  ratingCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#D1D5DB" },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  closedBanner: {
    marginHorizontal: SIDE, marginTop: 14, borderRadius: 14, overflow: "hidden",
    backgroundColor: "#1F2937",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  closedBannerInner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  closedBannerText: { flex: 1 },
  closedBannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  closedBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#D1D5DB", marginTop: 2 },

  warningBanner: {
    marginHorizontal: SIDE, marginTop: 14, padding: 10, borderRadius: 10, borderWidth: 1,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  warningText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  // Category tabs (underline)
  stickyCategoryBar: {
    height: CATEGORY_STICKY_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 2,
  },
  categoryBarInFlow: { marginTop: 10 },
  emptyCategoryBar: { height: 0 },
  categoryOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  catRow: { paddingHorizontal: SIDE, paddingTop: 10, gap: 10, alignItems: "center" },
  catChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 17,
    justifyContent: "center",
  },
  catChipPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  catText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  sectionTitleWrap: { paddingHorizontal: SIDE, paddingTop: 16, paddingBottom: 6 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },

  // Menu list
  menuSection: { marginTop: 2 },
  menuList: {
    paddingHorizontal: SIDE,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: MENU_GRID_GAP,
    rowGap: 2,
    alignItems: "flex-start",
  },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // Cart bar
  cartBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 6, alignItems: "center",
  },
  cartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 44, borderRadius: 22,
    paddingHorizontal: 18, minWidth: 200, maxWidth: 360, alignSelf: "center",
    shadowColor: "#E2006A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 8,
  },
  cartBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },

  pillCartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    height: 46, borderRadius: 23,
    paddingLeft: 8, paddingRight: 18,
    minWidth: 220, maxWidth: 360, alignSelf: "center",
  },
  pillCartQty: {
    minWidth: 30, height: 30, paddingHorizontal: 9, borderRadius: 15,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  pillCartQtyText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  pillCartLabel: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: 0.2 },

  // ─── Info modal ──────────────────────────────────────────────────────────
  infoModalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  infoModalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, gap: 0,
  },
  infoModalHandle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  infoModalHeader: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14,
  },
  infoModalLogoBox: {
    width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  infoModalLogoImg: { width: 52, height: 52 },
  infoModalLogoLetter: { fontSize: 22, fontFamily: "Inter_900Black" },
  infoModalName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  infoModalCategory: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoModalDivider: { height: 1, marginBottom: 8 },
  infoModalRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 11,
  },
  infoModalIconWrap: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  infoModalRowLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  infoModalRowValue: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  miniMapWrap: {
    marginHorizontal: 0, marginTop: 4, marginBottom: 10,
    borderRadius: 12, overflow: "hidden",
    height: 140,
    position: "relative",
  },
  miniMapWebView: { flex: 1 },
  directionsBtn: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#E2006A", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  directionsBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
