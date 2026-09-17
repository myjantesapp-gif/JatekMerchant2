import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Platform, Keyboard, Modal, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/contexts/LanguageContext";
import {
  searchPlaces,
  reverseGeocode,
  checkDeliveryZone,
  PlaceSuggestion,
  MAX_RADIUS_KM,
} from "@/utils/deliveryZone";
import { DeviceLocationError, getDeviceLocation, openLocationSettings } from "@/utils/deviceLocation";

interface Props {
  value: string;
  onChange: (address: string) => void;
  onZoneChange?: (inZone: boolean, distanceKm?: number) => void;
}

export function AddressAutocomplete({ value, onChange, onZoneChange }: Props) {
  const colors = useColors();
  const t = useT();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [zoneInfo, setZoneInfo] = useState<{ inZone: boolean; distanceKm: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const locatingRef = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current += 1;
    searchAbortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const runSearch = useCallback(async (text: string) => {
    const request = ++requestRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPlaces(text, controller.signal);
      if (request !== requestRef.current || !mountedRef.current) return;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      if (request === requestRef.current && mountedRef.current && !controller.signal.aborted) {
        setSuggestions([]);
      }
    } finally {
      if (request === requestRef.current && mountedRef.current) setSearching(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    requestRef.current += 1;
    searchAbortRef.current?.abort();
    setQuery(text);
    onChange(text);
    setZoneInfo(null);
    onZoneChange?.(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 450);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    requestRef.current += 1;
    searchAbortRef.current?.abort();
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSuggestions([]);

    const addr = [suggestion.shortName, suggestion.secondaryText]
      .filter(Boolean)
      .join(", ");

    setQuery(addr);
    onChange(addr);

    const zone = checkDeliveryZone(suggestion.latitude, suggestion.longitude);
    setZoneInfo(zone);
    onZoneChange?.(zone.inZone, zone.distanceKm);

    if (Platform.OS !== "web") {
      void Haptics.impactAsync(
        zone.inZone
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      ).catch(() => {});
    }
  };

  const requestLocateNow = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    const request = ++requestRef.current;
    searchAbortRef.current?.abort();
    setShowGpsModal(false);
    setLocating(true);
    try {
      const { latitude, longitude } = await getDeviceLocation();
      const { address } = await reverseGeocode(latitude, longitude);
      if (request !== requestRef.current || !mountedRef.current) return;

      setQuery(address);
      onChange(address);

      const zone = checkDeliveryZone(latitude, longitude);
      setZoneInfo(zone);
      onZoneChange?.(zone.inZone, zone.distanceKm);

      setShowSuggestions(false);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(
          zone.inZone
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        ).catch(() => {});
      }
    } catch (error) {
      if (request !== requestRef.current || !mountedRef.current) return;
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Keyboard.dismiss();
      if (error instanceof DeviceLocationError && error.reason === "permission-denied") {
        Alert.alert(
          t("gps_denied_title"),
          error.canAskAgain
            ? t("gps_denied_text")
            : "Autorisez la localisation dans les réglages, ou saisissez votre adresse manuellement.",
          error.canAskAgain ? [{ text: t("ok") }] : [
            { text: t("ok"), style: "cancel" },
            { text: "Ouvrir les réglages", onPress: () => void openLocationSettings() },
          ],
        );
      } else {
        const disabled = error instanceof DeviceLocationError && error.reason === "services-disabled";
        Alert.alert(
          disabled ? "GPS désactivé" : "Adresse introuvable",
          disabled
            ? "Activez les services de localisation puis réessayez."
            : "Votre position ou son adresse n’a pas pu être déterminée. Réessayez ou saisissez l’adresse manuellement.",
        );
      }
    } finally {
      if (request === requestRef.current && mountedRef.current) {
        locatingRef.current = false;
        setLocating(false);
      }
    }
  };

  const handleUseLocation = () => {
    Keyboard.dismiss();
    setShowGpsModal(true);
  };

  const handleClear = () => {
    requestRef.current += 1;
    searchAbortRef.current?.abort();
    setQuery("");
    onChange("");
    setSuggestions([]);
    setShowSuggestions(false);
    setZoneInfo(null);
    onZoneChange?.(true);
    inputRef.current?.focus();
  };

  const isOutOfZone = zoneInfo !== null && !zoneInfo.inZone;

  return (
    <View>
      {/* Input row */}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.card,
            borderColor: isOutOfZone ? "#EF4444" : zoneInfo?.inZone ? "#22C55E" : colors.border,
            borderWidth: zoneInfo !== null ? 1.5 : 1,
          },
        ]}
      >
        <Ionicons
          name="location"
          size={20}
          color={isOutOfZone ? "#EF4444" : zoneInfo?.inZone ? "#22C55E" : colors.primary}
        />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          placeholder="Enter your delivery address in Oujda"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={handleChangeText}
          multiline={false}
          returnKeyType="search"
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
        />
        {/* Trailing icons */}
        {searching && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
        {!searching && query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleUseLocation}
          disabled={locating}
          hitSlop={8}
          style={[styles.gpsBtn, { backgroundColor: colors.primary + "18" }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate" size={17} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" },
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => String(item.placeId)}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionRow}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.pinIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name="location-outline" size={15} color={colors.primary} />
                </View>
                <View style={styles.suggestionText}>
                  <Text style={[styles.suggestionMain, { color: colors.foreground }]} numberOfLines={1}>
                    {item.shortName}
                  </Text>
                  <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* GPS permission popup — branded */}
      <Modal visible={showGpsModal} transparent animationType="fade" onRequestClose={() => setShowGpsModal(false)}>
        <View style={gpsStyles.overlay}>
          <View style={[gpsStyles.card, { backgroundColor: colors.background }]}>
            <View style={[gpsStyles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="navigate" size={28} color={colors.primary} />
            </View>
            <Text style={[gpsStyles.title, { color: colors.heading }]}>{t("gps_title")}</Text>
            <Text style={[gpsStyles.text, { color: colors.mutedForeground }]}>{t("gps_text")}</Text>
            <View style={gpsStyles.row}>
              <TouchableOpacity onPress={() => setShowGpsModal(false)} style={[gpsStyles.btn, { backgroundColor: colors.muted, flex: 1 }]} activeOpacity={0.85}>
                <Text style={[gpsStyles.btnText, { color: colors.heading }]}>{t("gps_deny")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={requestLocateNow} style={[gpsStyles.btn, { backgroundColor: colors.primary, flex: 1.4 }]} activeOpacity={0.85}>
                <Ionicons name="navigate" size={16} color="#fff" />
                <Text style={[gpsStyles.btnText, { color: "#fff", marginLeft: 6 }]}>{t("gps_allow")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Zone status banner */}
      {zoneInfo !== null && (
        <View
          style={[
            styles.zoneBanner,
            {
              backgroundColor: zoneInfo.inZone ? "#DCFCE7" : "#FEE2E2",
              borderColor: zoneInfo.inZone ? "#BBF7D0" : "#FECACA",
            },
          ]}
        >
          <Ionicons
            name={zoneInfo.inZone ? "checkmark-circle" : "warning"}
            size={16}
            color={zoneInfo.inZone ? "#16A34A" : "#DC2626"}
          />
          {zoneInfo.inZone ? (
            <Text style={[styles.zoneText, { color: "#16A34A" }]}>
              ✓ Within delivery zone — {zoneInfo.distanceKm.toFixed(1)} km from city centre
            </Text>
          ) : (
            <Text style={[styles.zoneText, { color: "#DC2626" }]}>
              Désolé, cette adresse est à {zoneInfo.distanceKm.toFixed(1)} km du centre d'Oujda — hors de notre zone ({MAX_RADIUS_KM} km). Nous arrivons bientôt chez vous !
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  gpsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pinIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  suggestionMain: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  suggestionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  zoneBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  zoneText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});

const gpsStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(10,27,61,0.45)", justifyContent: "center", alignItems: "center", padding: 28 },
  card: { width: "100%", maxWidth: 380, borderRadius: 22, padding: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 19, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  text: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: "row", gap: 10, width: "100%" },
  btn: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
