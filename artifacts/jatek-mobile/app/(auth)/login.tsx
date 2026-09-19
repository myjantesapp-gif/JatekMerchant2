import React, { useRef, useState } from "react";
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLogin, useSendOtp, type SendOtpBody } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { CountryPickerModal } from "@/components/CountryPickerModal";
import { DEFAULT_COUNTRY, type Country } from "@/lib/countries";
import { useT } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { JatekWordmark } from "@/components/JatekWordmark";

type Method = "email" | "sms";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = useT();
  const { login, logout } = useAuth();
  const [method, setMethod] = useState<Method>("email");

  // Email/password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  // SMS
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showPicker, setShowPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [showEmailCta, setShowEmailCta] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const emailInputRef = useRef<any>(null);

  const mobileRequest = { headers: { "X-Client": "mobile" } };
  const loginMutation = useLogin({ request: mobileRequest });
  const sendOtp = useSendOtp({ request: mobileRequest });

  const fullPhone = `${country.dialCode}${phone.replace(/^0+/, "").replace(/\s/g, "")}`;

  const handleEmailLogin = () => {
    if (!isChecked) {
      setEmailError("Vous devez accepter les conditions générales et la politique RGPD.");
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t("login_email_error"));
      return;
    }
    if (password.length < 1) {
      setEmailError("Saisissez votre mot de passe.");
      return;
    }
    setEmailError("");
    loginMutation.mutate({ data: { email: trimmed, password } }, {
      onSuccess: async (res) => {
        if (res.user?.role !== "customer") {
          await logout();
          setEmailError("L'application mobile est réservée aux comptes clients.");
          return;
        }
        await login(res.token, { ...res.user, phone: res.user.phone ?? null });
        router.replace("/(tabs)");
      },
      onError: (err: any) => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setEmailError(err?.data?.error || "Email ou mot de passe incorrect.");
      },
    });
  };

  const handleSmsLogin = () => {
    if (!isChecked) {
      setPhoneError("Vous devez accepter les conditions générales et la politique RGPD.");
      return;
    }
    const local = phone.trim().replace(/\s/g, "");
    if (local.length < 5) {
      setPhoneError(t("login_phone_error"));
      return;
    }
    setPhoneError("");
    const payload: SendOtpBody = { phone: fullPhone, channel: "sms", intent: "login" };
    sendOtp.mutate({ data: payload }, {
       onSuccess: (res) => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
          pathname: "/(auth)/otp",
          params: {
            phone: fullPhone,
            intent: "login",
            demo: res?.demoOtp ? "1" : "0",
            demoOtp: res?.demoOtp ?? "",
            channel: res?.channel ?? "twilio-verify-sms",
          },
        });
      },
      onError: (err) => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhoneError(err instanceof Error ? err.message : t("login_send_fail"));
        if (err && typeof err === "object" && "data" in err) {
          const data = err.data;
            if (data && typeof data === "object" && "code" in data && data.code === "INVALID_PHONE_FOR_SMS") {
            setShowEmailCta(true);
          }
        }
      },
    });
  };

  const pending = loginMutation.isPending || sendOtp.isPending;
  const horizontalPadding = Math.max(18, Math.min(28, width * 0.06));
  const logoWidth = Math.min(150, Math.max(120, width * 0.36));
  const logoHeight = Math.round(logoWidth * 0.386);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              if (router.canGoBack()) router.back();
              else router.replace("/(auth)/welcome");
            }}
            style={[styles.backBtn, { backgroundColor: colors.muted }]}
            hitSlop={10}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.logoWrap, { width: logoWidth, height: logoHeight }]}>
            <JatekWordmark width={logoWidth} height={logoHeight} />
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Connectez-vous pour commander</Text>

          {/* Method toggle */}
          <View style={[styles.toggle, { backgroundColor: colors.muted, borderColor: colors.authBorder }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, method === "email" && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
              onPress={() => { setMethod("email"); setPhoneError(""); }}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={15} color={method === "email" ? colors.authTeal : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: method === "email" ? colors.authInk : colors.mutedForeground }]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, method === "sms" && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
              onPress={() => { setMethod("sms"); setEmailError(""); }}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={method === "sms" ? colors.authTeal : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: method === "sms" ? colors.authInk : colors.mutedForeground }]}>SMS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {method === "email" ? (
              <>
                <View style={[styles.channelBadge, { backgroundColor: colors.authTeal }]}>
                  <Ionicons name="lock-closed-outline" size={19} color={colors.authBadgeForeground} />
                  <Text style={[styles.channelBadgeText, { color: colors.authBadgeForeground }]}>Connexion sécurisée par email</Text>
                </View>
                <Text style={[styles.label, { color: colors.authInk }]}>Adresse email</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: emailError ? colors.destructive : colors.authBorder }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.authPlum} style={{ paddingLeft: 15 }} />
                  <TextInput
                    ref={emailInputRef}
                    style={[styles.input, { color: colors.authPlum }]}
                    placeholder="vous@exemple.com"
                    placeholderTextColor={colors.authPlum}
                    value={email}
                    onChangeText={(v) => { setEmail(v); setEmailError(""); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                <Text style={[styles.label, { color: colors.authInk }]}>Mot de passe</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: emailError ? colors.destructive : colors.authBorder }]}>
                  <Ionicons name="key-outline" size={20} color={colors.authPlum} style={{ paddingLeft: 15 }} />
                  <TextInput
                    style={[styles.input, { color: colors.authPlum }]}
                    placeholder="Votre mot de passe"
                    placeholderTextColor={colors.authPlum}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setEmailError(""); }}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleEmailLogin}
                  />
                </View>
                {emailError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{emailError}</Text> : null}
                <TouchableOpacity
                  style={[styles.consentRow, { borderColor: colors.authBorder }]}
                  onPress={() => setIsChecked((checked) => !checked)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  testID="login-consent-checkbox"
                >
                  <Ionicons
                    name={isChecked ? "checkbox" : "square-outline"}
                    size={24}
                    color={isChecked ? colors.authPrimary : colors.mutedForeground}
                  />
                  <Text style={[styles.consentText, { color: colors.authInk }]}>
                    J'accepte les conditions générales et la politique RGPD
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, {
                    backgroundColor: colors.authPrimary,
                    opacity: pending ? 0.7 : isChecked ? 1 : 0.45,
                  }]}
                  onPress={handleEmailLogin}
                  disabled={pending || !isChecked}
                  activeOpacity={0.8}
                  testID="login-submit"
                >
                  {loginMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="log-in-outline" size={20} color="#fff" />
                      <Text style={styles.btnText}>Se connecter</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.secondaryRow}>
                  <Text style={[styles.switchText, { color: colors.authPlum }]}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.channelBadge, { backgroundColor: "#25D36618" }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.authTeal} />
                  <Text style={[styles.channelBadgeText, { color: colors.authTeal }]}>Connexion par code SMS</Text>
                </View>
                <Text style={[styles.label, { color: colors.authInk }]}>Numéro de téléphone</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: phoneError ? colors.destructive : colors.authBorder }]}>
                  <TouchableOpacity
                    style={[styles.dialCodeBtn, { borderRightColor: colors.authBorder }]}
                    onPress={() => setShowPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dialCodeText, { color: colors.authPlum }]}>{country.dialCode}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { color: colors.authPlum }]}
                    placeholder="6 12 34 56 78"
                  placeholderTextColor={colors.authPlum}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setPhoneError(""); setShowEmailCta(false); }}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSmsLogin}
                  />
                </View>
                {phoneError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{phoneError}</Text> : null}
                {showEmailCta ? (
                  <TouchableOpacity
                    style={[styles.emailCtaBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setMethod("email");
                      setPhoneError("");
                      setShowEmailCta(false);
                      setTimeout(() => emailInputRef.current?.focus(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mail-outline" size={16} color={colors.primary} />
                    <Text style={[styles.emailCtaText, { color: colors.primary }]}>Connexion par email →</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.consentRow, { borderColor: colors.authBorder }]}
                  onPress={() => setIsChecked((checked) => !checked)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  testID="login-sms-consent-checkbox"
                >
                  <Ionicons
                    name={isChecked ? "checkbox" : "square-outline"}
                    size={24}
                    color={isChecked ? colors.authPrimary : colors.mutedForeground}
                  />
                  <Text style={[styles.consentText, { color: colors.authInk }]}>
                    J'accepte les conditions générales et la politique RGPD
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, {
                    backgroundColor: colors.authPrimary,
                    opacity: pending ? 0.7 : isChecked ? 1 : 0.45,
                  }]}
                  onPress={handleSmsLogin}
                  disabled={pending || !isChecked}
                  activeOpacity={0.8}
                  testID="login-sms-submit"
                >
                  {sendOtp.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                      <Text style={styles.btnText}>Recevoir le code</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
                <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                  Un code à 6 chiffres sera envoyé par SMS.
                </Text>
              </>
            )}

            {/* Register link */}
            <View style={[styles.divider, { borderTopColor: colors.authBorder }]} />
            <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.switchRow} activeOpacity={0.7}>
              <Ionicons name="person-add-outline" size={16} color={colors.authTeal} />
              <Text style={[styles.switchText, { color: colors.authPlum }]}>Pas encore de compte ? S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <CountryPickerModal visible={showPicker} selected={country} onSelect={setCountry} onClose={() => setShowPicker(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 24, paddingTop: 20, alignItems: "center" },
  backBtn: { position: "absolute", top: 10, left: 24, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", zIndex: 10 },
  logoWrap: { width: 140, height: 54, alignItems: "center", justifyContent: "center", marginTop: 14 },
  subtitle: { fontSize: 17, lineHeight: 24, fontFamily: "Montserrat_400Regular", marginTop: 8, marginBottom: 22, textAlign: "center" },
  toggle: { flexDirection: "row", borderRadius: 25, borderWidth: 1, padding: 4, marginBottom: 24, width: "100%", height: 50 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 21 },
  toggleText: { fontSize: 14, fontFamily: "Montserrat_600SemiBold" },
  form: { width: "100%", gap: 12 },
  label: { fontSize: 16, lineHeight: 22, fontFamily: "Montserrat_500Medium", marginTop: 1, marginBottom: 2 },
  channelBadge: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  channelBadgeText: { fontSize: 15, lineHeight: 20, fontFamily: "Montserrat_700Bold", flexShrink: 1 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 22, borderWidth: 1.5, height: 58, overflow: "hidden" },
  dialCodeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, height: "100%", borderRightWidth: 1 },
  dialCodeText: { fontSize: 15, fontFamily: "Montserrat_600SemiBold" },
  input: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: "Montserrat_400Regular", paddingHorizontal: 14 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  helperText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  btn: { height: 58, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  btnText: { color: "#fff", fontSize: 17, fontFamily: "Montserrat_700Bold" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4, marginTop: 4 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  secondaryRow: { alignItems: "center", paddingVertical: 6 },
  switchText: { fontSize: 15, lineHeight: 21, flexShrink: 1, textAlign: "center", fontFamily: "Montserrat_500Medium", textDecorationLine: "underline" },
  emailCtaBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  emailCtaText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
