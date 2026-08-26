import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import ProfileScreenLayout from "@/components/ProfileScreenLayout";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/api";
import { uploadAvatar } from "@/lib/upload";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const PINK = "#FF385C";

export default function InfoScreen() {
  const colors = useColors();
  const { user, updateUser, token } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const dirty =
    name !== (user?.name ?? "") ||
    email !== (user?.email ?? "") ||
    phone !== (user?.phone ?? "") ||
    address !== (user?.address ?? "") ||
    avatarUrl !== user?.avatarUrl;

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Autorisez l'accès à la galerie pour changer votre photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";

    if (!token) {
      Alert.alert("Erreur", "Vous devez être connecté pour uploader une image.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(asset.uri, mimeType, token);
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert("Erreur upload", e?.message ?? "Impossible d'uploader l'image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (name.trim().length < 2) {
      Alert.alert("Nom invalide", "Le nom doit contenir au moins 2 caractères.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        avatarUrl: avatarUrl ?? null,
      });
      await updateUser({ ...user, ...updated });
      Alert.alert("Enregistré", "Vos informations ont été mises à jour.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name ?? "J").charAt(0).toUpperCase();

  return (
    <ProfileScreenLayout title="Informations personnelles">
      <View style={styles.body}>
        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper} activeOpacity={0.8}>
            {avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: PINK }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: PINK }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>Appuyez pour changer</Text>
        </View>

        <Field label="Nom complet" value={name} onChangeText={setName} placeholder="Votre nom" colors={colors} />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="vous@example.com" keyboardType="email-address" autoCapitalize="none" colors={colors} />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+212 6 ..." keyboardType="phone-pad" colors={colors} />
        <Field label="Adresse principale" value={address} onChangeText={setAddress} placeholder="Rue, ville" multiline colors={colors} />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: dirty ? PINK : colors.muted }]}
          disabled={!dirty || saving || uploadingAvatar}
          onPress={onSave}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: dirty ? "#fff" : colors.mutedForeground }]}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>
    </ProfileScreenLayout>
  );
}

function Field({ label, multiline, colors, ...rest }: { label: string; multiline?: boolean; colors: any } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        {...rest}
        multiline={multiline}
        style={[styles.input, { backgroundColor: colors.card, color: colors.heading, borderColor: colors.border, height: multiline ? 80 : 48, textAlignVertical: multiline ? "top" : "center" }]}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarWrapper: { position: "relative", width: 88, height: 88 },
  avatarImg: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#f0f0f0" },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold" },
  avatarBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  avatarHint: { marginTop: 8, fontSize: 12, fontFamily: "Inter_400Regular" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { marginTop: 12, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
