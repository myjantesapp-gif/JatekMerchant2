import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { validatePromoCode } from "@/lib/api";

/** Server-validated promo code applied to the cart. */
export interface AppliedCoupon {
  code: string;
  promoCodeId: number;
  type: "percentage" | "fixed" | "free_delivery";
  value: number;
  /** User-facing label (server description, falls back to the code). */
  label: string;
  /** Minimum subtotal required — used to drop the coupon if the cart shrinks. */
  minOrderAmount?: number;
}

export interface CartItem {
  /** Unique line identifier (combines menuItemId + variant + extras).
   *  Used for client-side de-duplication & quantity updates. */
  cartLineId: string;
  /** REAL menu item id from the database — sent to the API at checkout. */
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  /** Selected size label, e.g. "Large" */
  selectedSize?: string;
  /** DB id of selected size (sent to API for server-side price validation). */
  selectedSizeId?: number;
  /** Price adjustment for the selected size (included in `price`). */
  selectedSizePriceAdjustment?: number;
  /** Selected extra labels, e.g. ["Fromage extra"] */
  selectedExtras?: string[];
  /** DB ids of selected extras (sent to API for server-side price validation). */
  selectedExtraIds?: number[];
}

export interface RestaurantPricing {
  deliveryFee?: number | null;
  freeDeliveryThreshold?: number | null;
  /** Jatek service-fee rate, stored by the API as a decimal (0.20 = 20%). */
  commissionRate?: number | null;
}

export type CouponApplyResult = { ok: true; label: string } | { ok: false; reason: string };

interface CartContextType {
  items: CartItem[];
  restaurantId: number | null;
  restaurantName: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  commissionRate: number;
  addItem: (restaurantId: number, restaurantName: string, item: Omit<CartItem, "quantity">, pricing?: RestaurantPricing) => void;
  /** Like addItem but sets an exact quantity instead of always incrementing by 1.
   *  Use this when the user picks qty > 1 in the detail modal. */
  addItemWithQty: (restaurantId: number, restaurantName: string, item: Omit<CartItem, "quantity">, qty: number, pricing?: RestaurantPricing) => void;
  removeItem: (cartLineId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
  selectedAddress: string;
  selectedAddressInZone: boolean;
  setSelectedAddress: (a: string, inZone?: boolean) => void;
  /** Currently applied coupon (validated server-side). */
  appliedCoupon: AppliedCoupon | null;
  /** Discount on items (MAD, positive). 0 if no coupon or coupon is shipping-only. */
  itemsDiscount: number;
  /** True when coupon offers free delivery. */
  freeDeliveryCoupon: boolean;
  /** Try to apply a code — validated by the server. Stored on success. */
  applyCoupon: (code: string, opts?: { loyaltyPoints?: number }) => Promise<CouponApplyResult>;
  /** Remove the currently applied coupon. */
  removeCoupon: () => void;
  /** Free-form note to the restaurant (allergies, cooking prefs, etc.). */
  notes: string;
  setNotes: (n: string) => void;
}

const CartContext = createContext<CartContextType | null>(null);
// Bumped to v3 — schema change: items now require `cartLineId` for de-dup
// (real `menuItemId` is preserved separately so the API gets the right DB id).
// Previous carts (v2) may contain items with the old fake variant id stored
// as `menuItemId` and would cause /api/orders to return 404.
const CART_KEY = "jatek_cart_v4";
const ADDR_KEY = "jatek_selected_address_v1";
const COUPON_KEY = "jatek_cart_coupon_v1";
const NOTES_KEY = "jatek_cart_notes_v1";
const OLD_CART_KEYS = ["jatek_cart_v2", "jatek_cart"];

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.cartLineId === "string"
    && typeof item.menuItemId === "number"
    && typeof item.name === "string"
    && typeof item.price === "number"
    && Number.isFinite(item.price)
    && typeof item.quantity === "number"
    && Number.isFinite(item.quantity)
    && item.quantity > 0;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  // Pricing is supplied by the selected restaurant API response. Zero is only
  // the empty-cart state; addItem replaces it with the persisted DB values.
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(0);
  const [commissionRate, setCommissionRate] = useState<number>(0.10);
  const [selectedAddress, setSelectedAddressState] = useState<string>("");
  const [selectedAddressInZone, setSelectedAddressInZone] = useState<boolean>(true);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [notes, setNotesState] = useState<string>("");
  const [ready, setReady] = useState(false);
  const storageQueues = useRef<Record<string, Promise<void>>>({});
  const conflictAlertOpen = useRef(false);
  const couponRequestId = useRef(0);
  const cartMutationVersion = useRef(0);

  const persist = useCallback((key: string, value: string | null) => {
    const previous = storageQueues.current[key] ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value));
    storageQueues.current[key] = next;
    next.catch((err) => console.warn(`[Cart] failed to persist ${key}:`, err));
  }, []);

  useEffect(() => {
    // Always set ready=true — even if AsyncStorage is unavailable (rare on
    // older Android Expo Go builds) we still want the app to render with
    // empty defaults instead of being stuck.
    OLD_CART_KEYS.forEach((k) => { AsyncStorage.removeItem(k).catch(() => {}); });
    const hydrationVersion = cartMutationVersion.current;
    Promise.all([
      AsyncStorage.getItem(CART_KEY),
      AsyncStorage.getItem(ADDR_KEY),
      AsyncStorage.getItem(COUPON_KEY),
      AsyncStorage.getItem(NOTES_KEY),
    ])
      .then(([raw, addr, couponRaw, notesRaw]) => {
        // Do not let slow storage restore an old cart over an action the
        // customer performed immediately after opening the app.
        if (cartMutationVersion.current !== hydrationVersion) return;
        let restoredHasItems = false;
        if (raw) {
          try {
            const s = JSON.parse(raw);
            const restoredItems = Array.isArray(s.items) ? s.items.filter(isCartItem) : [];
            restoredHasItems = restoredItems.length > 0;
            setItems(restoredItems);
            setRestaurantId(restoredHasItems && typeof s.restaurantId === "number" ? s.restaurantId : null);
            setRestaurantName(restoredHasItems && typeof s.restaurantName === "string" ? s.restaurantName : "");
            if (typeof s.deliveryFee === "number") setDeliveryFee(s.deliveryFee);
            if (typeof s.freeDeliveryThreshold === "number") setFreeDeliveryThreshold(s.freeDeliveryThreshold);
            if (typeof s.commissionRate === "number" && s.commissionRate >= 0 && s.commissionRate <= 1) {
              setCommissionRate(s.commissionRate);
            }
          } catch (err) {
            console.warn("[Cart] failed to parse persisted cart:", err);
          }
        }
        if (addr) {
          try {
            const parsed = JSON.parse(addr);
            if (typeof parsed === "string") { setSelectedAddressState(parsed); setSelectedAddressInZone(true); }
            else { setSelectedAddressState(String(parsed.address ?? "")); setSelectedAddressInZone(parsed.inZone !== false); }
          } catch { setSelectedAddressState(addr); }
        }
        if (couponRaw && restoredHasItems) {
          try {
            const parsed = JSON.parse(couponRaw);
            if (parsed && typeof parsed.code === "string") setAppliedCoupon(parsed);
          } catch { /* ignore */ }
        }
        if (typeof notesRaw === "string") setNotesState(notesRaw);
      })
      .catch((err) => {
        console.warn("[Cart] AsyncStorage unavailable:", err);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    persist(CART_KEY, JSON.stringify({ items, restaurantId, restaurantName, deliveryFee, freeDeliveryThreshold, commissionRate }));
  }, [items, restaurantId, restaurantName, deliveryFee, freeDeliveryThreshold, commissionRate, ready, persist]);

  useEffect(() => {
    if (!ready) return;
    if (appliedCoupon) {
      persist(COUPON_KEY, JSON.stringify(appliedCoupon));
    } else {
      persist(COUPON_KEY, null);
    }
  }, [appliedCoupon, ready, persist]);

  useEffect(() => {
    if (!ready) return;
    if (notes) {
      persist(NOTES_KEY, notes);
    } else {
      persist(NOTES_KEY, null);
    }
  }, [notes, ready, persist]);

  // All actions below are wrapped in `useCallback` so consumers passing them
  // to `React.memo`-ised children don't re-render on every parent render.
  const setNotes = useCallback((n: string) => {
    cartMutationVersion.current += 1;
    setNotesState(n);
  }, []);

  const setSelectedAddress = useCallback((a: string, inZone: boolean = true) => {
    cartMutationVersion.current += 1;
    setSelectedAddressState(a);
    setSelectedAddressInZone(inZone);
    persist(ADDR_KEY, JSON.stringify({ address: a, inZone }));
  }, [persist]);

  const applyPricing = useCallback((pricing?: RestaurantPricing) => {
    if (!pricing) return;
    if (typeof pricing.deliveryFee === "number" && Number.isFinite(pricing.deliveryFee) && pricing.deliveryFee >= 0) {
      setDeliveryFee(pricing.deliveryFee);
    }
    if (
      typeof pricing.freeDeliveryThreshold === "number"
      && Number.isFinite(pricing.freeDeliveryThreshold)
      && pricing.freeDeliveryThreshold >= 0
    ) {
      setFreeDeliveryThreshold(pricing.freeDeliveryThreshold);
    }
    if (typeof pricing.commissionRate === "number" && pricing.commissionRate >= 0 && pricing.commissionRate <= 1) {
      setCommissionRate(pricing.commissionRate);
    }
  }, []);

  /** Shared logic for adding/updating an item — increments or sets exact qty. */
  const _addOrSet = useCallback((rId: number, rName: string, item: Omit<CartItem, "quantity">, exactQty: number | null, pricing?: RestaurantPricing) => {
    cartMutationVersion.current += 1;
    if (restaurantId && restaurantId !== rId) {
      if (conflictAlertOpen.current) return;
      conflictAlertOpen.current = true;
      Alert.alert(
        "Nouveau restaurant",
        "Votre panier contient des articles d'un autre restaurant. Vider le panier et continuer ?",
        [
          { text: "Annuler", style: "cancel", onPress: () => { conflictAlertOpen.current = false; } },
          {
            text: "Vider et continuer",
            style: "destructive",
            onPress: () => {
              conflictAlertOpen.current = false;
              setItems([{ ...item, quantity: exactQty ?? 1 }]);
              setRestaurantName(rName);
              applyPricing(pricing);
              setRestaurantId(rId);
              // A coupon and restaurant note belong to the previous cart.
              couponRequestId.current += 1;
              setAppliedCoupon(null);
              setNotesState("");
            },
          },
        ],
      );
      return;
    }

    setRestaurantId((prevId) => {
      if (prevId && prevId !== rId) return prevId;
      setRestaurantName(rName);
      applyPricing(pricing);
      setItems((prev) => {
        const ex = prev.find((i) => i.cartLineId === item.cartLineId);
        if (exactQty !== null) {
          // addItemWithQty: set to exact value (replace or add new)
          if (ex) return prev.map((i) => i.cartLineId === item.cartLineId ? { ...i, quantity: exactQty } : i);
          return [...prev, { ...item, quantity: exactQty }];
        } else {
          // addItem: increment by 1 (or add with qty 1)
          if (ex) return prev.map((i) => i.cartLineId === item.cartLineId ? { ...i, quantity: i.quantity + 1 } : i);
          return [...prev, { ...item, quantity: 1 }];
        }
      });
      return rId;
    });
  }, [applyPricing, restaurantId]);

  const addItem = useCallback((rId: number, rName: string, item: Omit<CartItem, "quantity">, pricing?: RestaurantPricing) => {
    _addOrSet(rId, rName, item, null, pricing);
  }, [_addOrSet]);

  const addItemWithQty = useCallback((rId: number, rName: string, item: Omit<CartItem, "quantity">, qty: number, pricing?: RestaurantPricing) => {
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    _addOrSet(rId, rName, item, safeQty, pricing);
  }, [_addOrSet]);

  const removeItem = useCallback((cartLineId: string) => {
    cartMutationVersion.current += 1;
    setItems((prev) => {
      const next = prev.filter((i) => i.cartLineId !== cartLineId);
      if (next.length === 0) {
        setRestaurantId(null);
        setRestaurantName("");
        setDeliveryFee(0);
        setFreeDeliveryThreshold(0);
        setCommissionRate(0.10);
        couponRequestId.current += 1;
        setAppliedCoupon(null);
        setNotesState("");
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((cartLineId: string, quantity: number) => {
    cartMutationVersion.current += 1;
    if (quantity <= 0) { removeItem(cartLineId); return; }
    const safeQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    if (safeQuantity <= 0) { removeItem(cartLineId); return; }
    setItems((prev) => prev.map((i) => i.cartLineId === cartLineId ? { ...i, quantity: safeQuantity } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    cartMutationVersion.current += 1;
    setItems([]); setRestaurantId(null); setRestaurantName("");
    setDeliveryFee(0);
    setFreeDeliveryThreshold(0);
    setCommissionRate(0.10);
    couponRequestId.current += 1;
    setAppliedCoupon(null);
    setNotesState("");
  }, []);

  // Derived values memoized so we don't recompute on every parent re-render
  // and consumers using shallow-compare receive stable references.
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // Drop the coupon if the cart shrinks below the server-declared minimum
  // (final enforcement happens again server-side at order creation).
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) {
      setAppliedCoupon(null);
    }
  }, [subtotal, appliedCoupon]);

  // Discount recomputed locally from the server-provided type/value so it
  // tracks cart changes without re-hitting the API on every keystroke.
  const discount = useMemo(() => {
    if (!appliedCoupon) return { itemsDiscount: 0, freeDelivery: false, label: "" };
    if (appliedCoupon.type === "percentage") {
      return { itemsDiscount: Math.round(Math.min(subtotal, (subtotal * appliedCoupon.value) / 100) * 100) / 100, freeDelivery: false, label: appliedCoupon.label };
    }
    if (appliedCoupon.type === "fixed") {
      return { itemsDiscount: Math.min(subtotal, appliedCoupon.value), freeDelivery: false, label: appliedCoupon.label };
    }
    return { itemsDiscount: 0, freeDelivery: true, label: appliedCoupon.label };
  }, [appliedCoupon, subtotal]);

  const applyCoupon = useCallback(async (code: string): Promise<CouponApplyResult> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { ok: false, reason: "Saisissez un code." };
    cartMutationVersion.current += 1;
    const requestId = ++couponRequestId.current;
    const requestRestaurantId = restaurantId;
    const requestSubtotal = subtotal;
    try {
      const res = await validatePromoCode({ code: trimmed, restaurantId: requestRestaurantId, subtotal: requestSubtotal });
      if (requestId !== couponRequestId.current) return { ok: false, reason: "Une validation plus récente est en cours." };
      const coupon: AppliedCoupon = {
        code: trimmed,
        promoCodeId: res.promoCodeId,
        type: res.type,
        value: res.value,
        label: res.description || trimmed,
        minOrderAmount: (res as any).minOrderAmount,
      };
      setAppliedCoupon(coupon);
      return { ok: true, label: coupon.label };
    } catch (err: any) {
      return { ok: false, reason: err?.message || "Code promo invalide." };
    }
  }, [subtotal, restaurantId]);

  const removeCoupon = useCallback(() => {
    cartMutationVersion.current += 1;
    couponRequestId.current += 1;
    setAppliedCoupon(null);
  }, []);

  // Memoize the entire context value so consumers that don't depend on the
  // cart state don't re-render when an unrelated state slice changes.
  const value = useMemo<CartContextType>(() => ({
    items,
    restaurantId,
    restaurantName,
    deliveryFee,
    freeDeliveryThreshold,
    commissionRate,
    addItem,
    addItemWithQty,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    itemCount,
    selectedAddress,
    selectedAddressInZone,
    setSelectedAddress,
    appliedCoupon,
    itemsDiscount: discount.itemsDiscount,
    freeDeliveryCoupon: discount.freeDelivery,
    applyCoupon,
    removeCoupon,
    notes,
    setNotes,
  }), [
    items, restaurantId, restaurantName, deliveryFee, freeDeliveryThreshold,
    addItem, addItemWithQty, removeItem, updateQuantity, clearCart,
    subtotal, itemCount, commissionRate,
    selectedAddress, selectedAddressInZone, setSelectedAddress,
    appliedCoupon, discount.itemsDiscount, discount.freeDelivery,
    applyCoupon, removeCoupon, notes, setNotes,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
