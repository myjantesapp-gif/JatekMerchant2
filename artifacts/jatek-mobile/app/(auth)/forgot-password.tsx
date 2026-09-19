import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { getApiBaseSafe } from "@/lib/apiBase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Step = "email" | "code" | "newPassword" | "done";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const initialEmail = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const initialCode = typeof params.code === "string" ? params.code.replace(/\D/g, "").slice(0, 6) : "";
  const [step, setStep] = useState<Step>(initialCode.length === 6 ? "code" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const sendCode = async (emailVal: string, isResend = false) => {
    if (isResend && resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const base = getApiBaseSafe();
      const res = await fetch(`${base}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client": "mobile" },
        body: JSON.stringify({ email: emailVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'envoi");
      setEmail(emailVal);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setDemoOtp(typeof data.demoOtp === "string" && /^\d{6}$/.test(data.demoOtp) ? data.demoOtp : "");
      setResendCountdown(60);
      setStep("code");
    } catch (e: any) {
      setError(e?.message ?? "Une erreur est survenue. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    const emailVal = email.trim().toLowerCase();
    if (!emailVal) { setError("Veuillez entrer votre adresse e-mail."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) { setError("Adresse e-mail invalide."); return; }
    await sendCode(emailVal);
  };

  const handleVerifyAndReset = async () => {
    if (!/^\d{6}$/.test(code.trim())) { setError("Le code doit contenir exactement 6 chiffres."); return; }
    if (!newPassword || newPassword.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (newPassword !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setError("");
    setLoading(true);
    try {
      const base = getApiBaseSafe();
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client": "mobile" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Code invalide ou expiré");
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
    inner: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 20 },
    title: { fontSize: 28, fontWeight: "800", color: colors.foreground, textAlign: "center" },
    subtitle: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22 },
    input: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
      padding: 14, fontSize: 16, color: colors.foreground,
      backgroundColor: colors.card,
    },
    btn: {
      backgroundColor: colors.authPrimary, borderRadius: 14, height: 48,
      alignItems: "center", marginTop: 4,
    },
    btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    back: { alignItems: "center", marginTop: 8 },
    backText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
    resendRow: { alignItems: "center", gap: 8 },
    demo: { fontSize: 13, textAlign: "center" },
    error: { color: "#EF4444", fontSize: 13, textAlign: "center", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10 },
    successIcon: { fontSize: 64, textAlign: "center" },
  });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={s.inner}>
        {step === "email" && (
          <>
            <Text style={s.title}>Mot de passe oublié ?</Text>
            <Text style={s.subtitle}>Entrez votre adresse e-mail. Nous vous enverrons un code de réinitialisation.</Text>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TextInput
              style={s.input}
              placeholder="votre@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSendCode}
            />
            <TouchableOpacity style={s.btn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Envoyer le code</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.back} onPress={() => router.back()}>
              <Text style={s.backText}>← Retour à la connexion</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "code" && (
          <>
            <Text style={s.title}>Vérification</Text>
            <Text style={s.subtitle}>Un code a été envoyé à {email}. Entrez-le ci-dessous et choisissez un nouveau mot de passe.</Text>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TextInput
              style={s.input}
              placeholder="Code de vérification"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              autoCapitalize="none"
              maxLength={6}
              value={code}
              onChangeText={(value) => { setCode(value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            />
            {demoOtp ? <Text style={[s.demo, { color: colors.mutedForeground }]}>Code de démonstration : {demoOtp}</Text> : null}
            <TextInput
              style={s.input}
              placeholder="Nouveau mot de passe (min. 8 caractères)"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={s.input}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onSubmitEditing={handleVerifyAndReset}
            />
            <TouchableOpacity style={s.btn} onPress={handleVerifyAndReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Réinitialiser le mot de passe</Text>}
            </TouchableOpacity>
            <View style={s.resendRow}>
              {resendCountdown > 0 ? (
                <Text style={[s.backText, { color: colors.mutedForeground }]}>Renvoyer le code dans {resendCountdown}s</Text>
              ) : (
                <TouchableOpacity onPress={() => void sendCode(email.trim().toLowerCase(), true)} disabled={loading}>
                  <Text style={s.backText}>{loading ? "Envoi en cours…" : "Renvoyer le code"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.back} onPress={() => { setError(""); setStep("email"); }}>
                <Text style={s.backText}>← Modifier l’adresse</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === "done" && (
          <>
            <Text style={s.successIcon}>✅</Text>
            <Text style={s.title}>Mot de passe mis à jour !</Text>
            <Text style={s.subtitle}>Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.</Text>
            <TouchableOpacity style={s.btn} onPress={() => router.replace("/(auth)/login")}>
              <Text style={s.btnText}>Se connecter</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
