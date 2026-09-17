import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import ProfileScreenLayout from "@/components/ProfileScreenLayout";
import { useColors } from "@/hooks/useColors";
import { listAddresses, createAddress, updateAddress, deleteAddress, type SavedAddress } from "@/lib/api";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { GoogleMapPicker } from "@/components/GoogleMapPicker";
import { useFriendlyAlert } from "@/components/FriendlyAlert";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { OUJDA_CENTER, checkDeliveryZone, reverseGeocode } from "@/utils/deliveryZone";

export default function AddressesScreen() {
  const colors = useColors();
  const friendly = useFriendlyAlert();
  const { user, token, isLoading: authLoading } = useAuth();
  const { select, returnTo } = useLocalSearchParams<{ select?: string; returnTo?: string }>();
  const selectMode = select === "1";
  const { setSelectedAddress } = useCart();

  const ALLOWED_RETURN_PATHS = ["/cart", "/(tabs)", "/(tabs)/profile"] as const;
  const pickAddress = (a: SavedAddress) => {
    const full = a.details ? `${a.fullAddress} (${a.details})` : a.fullAddress;
    setSelectedAddress(full);
    const safePath = ALLOWED_RETURN_PATHS.find((p) => p === returnTo) ?? null;
    if (safePath) {
      router.replace(safePath);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/cart");
    }
  };
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [formAddrInZone, setFormAddrInZone] = useState<boolean>(true);
  const [label, setLabel] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [details, setDetails] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState({ latitude: OUJDA_CENTER.latitude, longitude: OUJDA_CENTER.longitude });
  const mountedRef = useRef(true);
  const formOperationRef = useRef(0);
  const savingRef = useRef(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const loadOperationRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
    formOperationRef.current += 1;
    loadOperationRef.current += 1;
    geocodeAbortRef.current?.abort();
  }, []);

  const isUnauthenticated = (e: any) =>
    e?.status === 401 ||
    e?.code === "UNAUTHENTICATED" ||
    e?.message === "Authentication required";

  const load = useCallback(async () => {
    const operation = ++loadOperationRef.current;
    // Guard: token missing means the session is gone even if user cache remains.
    if (!user || !token) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    try {
      const next = await listAddresses();
      if (operation === loadOperationRef.current && mountedRef.current) setItems(next);
    }
    catch (e: any) {
      if (operation !== loadOperationRef.current || !mountedRef.current) return;
      if (isUnauthenticated(e)) {
        friendly.show({
          tone: "info",
          icon: "lock-closed-outline",
          title: "Session expirée",
          message: "Veuillez vous reconnecter pour accéder à vos adresses.",
          primary: { label: "Se connecter", href: "/(auth)/login" },
          secondary: { label: "Plus tard" },
        });
        return;
      }
      friendly.show({
        tone: "error",
        icon: "cloud-offline-outline",
        title: "Chargement impossible",
        message: e?.message ?? "Impossible de récupérer vos adresses pour le moment.",
        primary: { label: "OK" },
        hideSecondary: true,
      });
    }
    finally {
      if (operation === loadOperationRef.current && mountedRef.current) setLoading(false);
    }
  }, [friendly, user, token]);
  useEffect(() => { load(); }, [load]);

  const resetFormOperation = () => {
    formOperationRef.current += 1;
    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;
    savingRef.current = false;
    setSaving(false);
  };
  const closeForm = () => {
    resetFormOperation();
    setShowForm(false);
  };
  const openAdd = () => { resetFormOperation(); setEditing(null); setLabel(""); setFullAddress(""); setDetails(""); setIsDefault(items.length === 0); setFormAddrInZone(true); setCoords({ latitude: OUJDA_CENTER.latitude, longitude: OUJDA_CENTER.longitude }); setShowForm(true); };
  const openEdit = (a: SavedAddress) => { resetFormOperation(); setEditing(a); setLabel(a.label); setFullAddress(a.fullAddress); setDetails(a.details ?? ""); setIsDefault(a.isDefault); setFormAddrInZone(true); setCoords({ latitude: OUJDA_CENTER.latitude, longitude: OUJDA_CENTER.longitude }); setShowForm(true); };

  const onMapPick = async (c: { latitude: number; longitude: number }) => {
    const operation = ++formOperationRef.current;
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setCoords(c);
    const zone = checkDeliveryZone(c.latitude, c.longitude);
    setFormAddrInZone(zone.inZone);
    try {
      const { address } = await reverseGeocode(c.latitude, c.longitude, controller.signal);
      if (operation === formOperationRef.current && mountedRef.current && !controller.signal.aborted) {
        setFullAddress(address);
      }
    } catch { /* keep previous text */ }
  };

  const save = async () => {
    if (savingRef.current) return;
    if (!label.trim() || !fullAddress.trim()) {
      friendly.show({
        tone: "info",
        icon: "alert-circle-outline",
        title: "Champs requis",
        message: "Le libellé et l'adresse sont requis pour enregistrer.",
        primary: { label: "OK" },
        hideSecondary: true,
      });
      return;
    }
    if (!formAddrInZone) {
      friendly.show({
        tone: "warning",
        icon: "location-outline",
        title: "Hors zone de livraison",
        message: "Cette adresse est en dehors de notre zone de 5 km autour d'Oujda. Nous arrivons bientôt chez vous !",
        primary: { label: "OK" },
        hideSecondary: true,
      });
      return;
    }
    savingRef.current = true;
    const operation = ++formOperationRef.current;
    geocodeAbortRef.current?.abort();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateAddress(editing.id, { label: label.trim(), fullAddress: fullAddress.trim(), details: details.trim() || null, isDefault });
        if (operation !== formOperationRef.current || !mountedRef.current) return;
        setItems((prev) => prev.map((x) => x.id === updated.id ? updated : (isDefault ? { ...x, isDefault: false } : x)).map((x) => x.id === updated.id ? updated : x));
      } else {
        const created = await createAddress({ label: label.trim(), fullAddress: fullAddress.trim(), details: details.trim() || null, isDefault });
        if (operation !== formOperationRef.current || !mountedRef.current) return;
        setItems((prev) => [created, ...prev.map((x) => isDefault ? { ...x, isDefault: false } : x)]);
      }
      setShowForm(false);
    } catch (e: any) {
      if (operation !== formOperationRef.current || !mountedRef.current) return;
      friendly.show({
        tone: "error",
        icon: "alert-circle-outline",
        title: "Enregistrement impossible",
        message: e?.message ?? "Une erreur est survenue, veuillez réessayer.",
        primary: { label: "OK" },
        hideSecondary: true,
      });
    }
    finally {
      if (operation === formOperationRef.current && mountedRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const onDelete = (id: number) => {
    friendly.show({
      tone: "warning",
      icon: "trash-outline",
      title: "Supprimer cette adresse ?",
      message: "Vous pourrez toujours en ajouter une nouvelle plus tard.",
      primary: {
        label: "Supprimer",
        onPress: async () => {
          setItems((prev) => prev.filter((x) => x.id !== id));
          try { await deleteAddress(id); } catch { load(); }
        },
      },
      secondary: { label: "Annuler" },
    });
  };

  const setAsDefault = async (id: number) => {
    setItems((prev) => prev.map((x) => ({ ...x, isDefault: x.id === id })));
    try { await updateAddress(id, { isDefault: true }); } catch { load(); }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <ProfileScreenLayout title={selectMode ? "Choisir une adresse" : "Adresses enregistrées"} scroll={false}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ProfileScreenLayout>
    );
  }

  if (!user || !token) {
    return (
      <ProfileScreenLayout title={selectMode ? "Choisir une adresse" : "Adresses enregistrées"} scroll={false}>
        <View style={styles.authGate}>
          {/* Illustration */}
          <View style={[styles.authIllustration, { backgroundColor: colors.primary + "10" }]}>
            <View style={[styles.authIconRing, { borderColor: colors.primary + "25" }]}>
              <View style={[styles.authIconInner, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="location-outline" size={42} color={colors.primary} />
              </View>
            </View>
            <View style={[styles.authLockBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="lock-closed" size={13} color="#fff" />
            </View>
          </View>

          {/* Text */}
          <Text style={[styles.authTitle, { color: colors.heading }]}>
            Connexion requise
          </Text>
          <Text style={[styles.authDesc, { color: colors.mutedForeground }]}>
            {selectMode
              ? "Pour renseigner votre adresse de livraison, vous devez être connecté à votre compte Jatek."
              : "Connectez-vous pour enregistrer et gérer vos adresses de livraison."}
          </Text>

          {/* Steps hint — only in select mode */}
          {selectMode && (
            <View style={[styles.authSteps, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { icon: "person-circle-outline" as const, label: "Connectez-vous ou créez un compte" },
                { icon: "location-outline" as const, label: "Ajoutez votre adresse de livraison" },
                { icon: "checkmark-circle-outline" as const, label: "Finalisez votre commande" },
              ].map((step, i) => (
                <View key={i} style={styles.authStepRow}>
                  <View style={[styles.authStepNum, { backgroundColor: colors.primary + "15" }]}>
                    <Ionicons name={step.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.authStepText, { color: colors.heading }]}>{step.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* CTA buttons */}
          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            style={[styles.authBtnPrimary, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.authBtnPrimaryText}>Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/register")}
            style={[styles.authBtnSecondary, { borderColor: colors.primary + "50" }]}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={[styles.authBtnSecondaryText, { color: colors.primary }]}>Créer un compte</Text>
          </TouchableOpacity>

          {router.canGoBack() && (
            <TouchableOpacity onPress={() => router.back()} style={styles.authBackLink} activeOpacity={0.7}>
              <Text style={[styles.authBackLinkText, { color: colors.mutedForeground }]}>Retour</Text>
            </TouchableOpacity>
          )}
        </View>
      </ProfileScreenLayout>
    );
  }
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <ProfileScreenLayout
      title={selectMode ? "Choisir une adresse" : "Adresses enregistrées"}
      headerRight={<TouchableOpacity onPress={openAdd} hitSlop={10}><Ionicons name="add" size={26} color={colors.primary} /></TouchableOpacity>}
      scroll={false}
    >
      {selectMode && (
        <View style={[styles.selectHint, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.selectHintText, { color: colors.primary }]} numberOfLines={2}>Touchez une adresse pour la sélectionner. Appui long pour modifier.</Text>
        </View>
      )}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {items.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="location-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.heading }]}>Aucune adresse</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Ajoutez votre domicile, votre travail ou tout autre lieu de livraison.</Text>
            </View>
          ) : items.map((a) => (
            <View key={a.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name={a.label.toLowerCase().includes("dom") ? "home" : a.label.toLowerCase().includes("trav") || a.label.toLowerCase().includes("bur") ? "briefcase" : "location"} size={20} color={colors.primary} />
              </View>
              <TouchableOpacity onPress={() => selectMode ? pickAddress(a) : openEdit(a)} onLongPress={() => openEdit(a)} style={{ flex: 1 }} activeOpacity={0.7}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.title, { color: colors.heading }]}>{a.label}</Text>
                  {a.isDefault && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>Par défaut</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={2}>{a.fullAddress}</Text>
                {a.details ? <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{a.details}</Text> : null}
              </TouchableOpacity>
              <View style={{ gap: 6 }}>
                {!a.isDefault && (
                  <TouchableOpacity onPress={() => setAsDefault(a.id)} hitSlop={6}>
                    <Ionicons name="star-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onDelete(a.id)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={openAdd} style={[styles.addBtn, { borderColor: colors.primary }]}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Ajouter une adresse</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {showForm && (
      <Modal visible transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: colors.heading }]}>{editing ? "Modifier l'adresse" : "Nouvelle adresse"}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Choisir sur la carte</Text>
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <GoogleMapPicker latitude={coords.latitude} longitude={coords.longitude} onChange={onMapPick} height={220} />
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Libellé</Text>
              <TextInput value={label} onChangeText={setLabel} placeholder="Domicile, Bureau..." placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, color: colors.heading, borderColor: colors.border }]} />
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Adresse (saisie manuelle ou autocomplete)</Text>
               <AddressAutocomplete value={fullAddress} onChange={(value) => { formOperationRef.current += 1; geocodeAbortRef.current?.abort(); setFullAddress(value); }} onZoneChange={(inZone) => setFormAddrInZone(inZone)} />
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Détails (étage, code, etc.)</Text>
              <TextInput value={details} onChangeText={setDetails} placeholder="Optionnel" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, color: colors.heading, borderColor: colors.border }]} />
              <TouchableOpacity onPress={() => setIsDefault((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
                <Ionicons name={isDefault ? "checkbox" : "square-outline"} size={22} color={isDefault ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: colors.heading, fontSize: 14, fontFamily: "Inter_500Medium" }}>Définir par défaut</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 8 }}>
                 <TouchableOpacity onPress={closeForm} style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}>
                  <Text style={[styles.btnText, { color: colors.heading }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: "#fff" }]}>{editing ? "Enregistrer" : "Ajouter"}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  // ── Generic helpers ───────────────────────────────────────────────────────
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 12, textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  // ── Auth gate ─────────────────────────────────────────────────────────────
  authGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 24,
    gap: 0,
  },
  authIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    position: "relative",
  },
  authIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  authIconInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  authLockBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  authTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  authDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  authSteps: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  authStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authStepNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  authStepText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  authBtnPrimary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    marginBottom: 10,
  },
  authBtnPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  authBtnSecondary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  authBtnSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  authBackLink: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  authBackLinkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },

  // ── Address list ──────────────────────────────────────────────────────────
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  selectHint: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  selectHintText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", marginTop: 8 },
  addBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Add / edit modal ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "92%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
