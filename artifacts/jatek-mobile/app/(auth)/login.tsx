import React, { useRef, useState } from "react";
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLogin } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { login } = useAuth();
  // Email/password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  const emailInputRef = useRef<any>(null);

  const loginMutation = useLogin();

  const handleEmailLogin = () => {
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
        await login(res.token, res.user as any);
        router.replace("/(tabs)");
      },
      onError: (err: any) => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setEmailError(err?.data?.error || "Email ou mot de passe incorrect.");
      },
    });
  };

  const pending = loginMutation.isPending;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
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

          <View style={[styles.logoWrap, { backgroundColor: colors.card }]}>
            <Image source={require("../../assets/images/jatek-logo.png")} style={{ width: 56, height: 56 }} resizeMode="contain" />
          </View>
          <Text style={[styles.brand, { color: colors.heading }]}>Jatek.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Connectez-vous pour commander</Text>

          <View style={styles.form}>
            <View style={[styles.channelBadge, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
              <Text style={[styles.channelBadgeText, { color: colors.primary }]}>Connexion sécurisée par email</Text>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Adresse email</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: emailError ? colors.destructive : colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={{ paddingLeft: 14 }} />
              <TextInput
                ref={emailInputRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="vous@exemple.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Mot de passe</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: emailError ? colors.destructive : colors.border }]}>
              <Ionicons name="key-outline" size={18} color={colors.mutedForeground} style={{ paddingLeft: 14 }} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Votre mot de passe"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(v) => { setPassword(v); setEmailError(""); }}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
              />
            </View>
            {emailError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{emailError}</Text> : null}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: pending ? 0.7 : 1 }]}
              onPress={handleEmailLogin}
              disabled={pending}
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
              <Text style={[styles.switchText, { color: colors.primary }]}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {/* Register link */}
            <View style={[styles.divider, { borderTopColor: colors.border }]} />
            <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.switchRow} activeOpacity={0.7}>
              <Ionicons name="person-add-outline" size={16} color={colors.primary} />
              <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Pas encore de compte ? S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, alignItems: "center" },
  backBtn: { position: "absolute", top: 12, left: 16, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 10 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", shadowColor: "#E2006A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  brand: { fontSize: 32, fontFamily: "Inter_700Bold", marginTop: 16, fontStyle: "italic" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, marginBottom: 24 },
  form: { width: "100%", gap: 10 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 2 },
  channelBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  channelBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, height: 54, overflow: "hidden" },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", paddingHorizontal: 14 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  btn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  secondaryRow: { alignItems: "center", paddingVertical: 4 },
  switchText: { fontSize: 13, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
});
