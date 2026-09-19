import React, { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { JatekWordmark } from "@/components/JatekWordmark";
import { useListCategories } from "@workspace/api-client-react";

const PINK      = "#FF4593";
const PINK_DEEP = "#E91E63";
const TURQUOISE = "#00BFA6";
const YELLOW    = "#FFC107";
const PURPLE    = "#7B61FF";
const ORANGE    = "#FF7A45";

const DRAWER_W = 80;

interface MenuEntry {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}

const ENTRIES: MenuEntry[] = [
  { id: "cart",      label: "Panier",              icon: "cart",        color: PINK_DEEP, route: "/cart" },
  { id: "fav",       label: "Favoris",             icon: "heart",       color: PINK,      route: "/profile/favorites" },
  { id: "promo",     label: "Promotions",          icon: "pricetag",    color: ORANGE,    route: "/profile/coupons" },
  { id: "orders",    label: "Commandes",           icon: "bag-handle",  color: TURQUOISE, route: "/(tabs)/orders" },
  { id: "rewards",   label: "Récompenses",         icon: "gift",        color: YELLOW,    route: "/profile/coupons" },
  { id: "addresses", label: "Adresses",            icon: "location",    color: PURPLE,    route: "/profile/addresses" },
  { id: "help",      label: "Aide",                icon: "chatbubbles", color: "#0EA5E9", route: "/profile/help" },
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function categoryIcon(category: any): keyof typeof Ionicons.glyphMap {
  const value = normalize(`${category?.slug} ${category?.name} ${category?.businessType}`);
  if (value.includes("pharm") || value.includes("sant")) return "medkit";
  if (value.includes("market") || value.includes("grocery") || value.includes("supermarch") || value.includes("epicer")) return "basket";
  if (value.includes("shop") || value.includes("boutique") || value.includes("store")) return "bag-handle";
  if (value.includes("restaurant") || value.includes("restauration") || value.includes("food")) return "restaurant";
  return "grid";
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SideMenu({ visible, onClose }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const slide   = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const { data: categories } = useListCategories();
  const categoryEntries = useMemo<MenuEntry[]>(
    () =>
      (categories ?? [])
        .filter((category: any) => category.parentId == null && category.isActive !== false && typeof category.slug === "string")
        .map((category: any) => ({
          id: `category-${category.slug}`,
          label: category.name || category.slug,
          icon: categoryIcon(category),
          color: category.accentColor || PINK_DEEP,
          route: `/category/${encodeURIComponent(category.slug)}`,
        })),
    [categories],
  );
  const menuEntries = useMemo(() => [...ENTRIES, ...categoryEntries], [categoryEntries]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide,   { toValue: 0,         duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 1,         duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slide,   { toValue: -DRAWER_W, duration: 220, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 0,         duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slide, overlay]);

  const handleNav = (route: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(() => router.push(route as any), 220);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={styles.root}>
        {/* dim overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* compact icon rail */}
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          {/* top: Jatek logo + close */}
          <View style={[styles.header, { paddingTop: insets.top + 30 }]}>
            <JatekWordmark width={48} height={18} />
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* icon list */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.itemsWrap, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {menuEntries.map((entry, i) => (
              <IconItem
                key={entry.id}
                entry={entry}
                index={i}
                visible={visible}
                onPress={() => handleNav(entry.route)}
              />
            ))}

            {/* settings at bottom */}
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => handleNav("/profile/info" as any)}
                style={styles.settingsBtn}
                accessibilityRole="button"
                accessibilityLabel="Paramètres"
              >
                <Ionicons name="settings-outline" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function IconItem({
  entry,
  index,
  visible,
  onPress,
}: {
  entry: MenuEntry;
  index: number;
  visible: boolean;
  onPress: () => void;
}) {
  const enter  = useRef(new Animated.Value(0)).current;
  const press  = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(enter, {
        toValue: 1,
        duration: 340,
        delay: 60 + index * 45,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    } else {
      enter.setValue(0);
    }
  }, [visible, index, enter]);

  const handlePressIn = () => {
    Animated.spring(press, { toValue: 0.88, useNativeDriver: true, friction: 5 }).start();
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1,  duration: 70, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0,  duration: 70, useNativeDriver: true }),
    ]).start();
  };
  const handlePressOut = () =>
    Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 4 }).start();

  const translateX = enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const rotate     = wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
    >
      <Animated.View
        style={[
          styles.itemRow,
          { opacity: enter, transform: [{ translateX }, { scale: press }] },
        ]}
      >
        <Animated.View
          style={[
            styles.chip,
            { backgroundColor: entry.color + "20", transform: [{ rotate }] },
          ]}
        >
          <Ionicons name={entry.icon} size={22} color={entry.color} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, flexDirection: "row" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,27,61,0.52)" },

  drawer: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: DRAWER_W,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 5, height: 0 },
    elevation: 16,
  },

  header: {
    alignItems: "center",
    paddingBottom: 14,
    gap: 10,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll:    { flex: 1 },
  itemsWrap: { alignItems: "center", gap: 6, paddingTop: 4 },

  itemRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  settingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
