import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import ProfileScreenLayout from "@/components/ProfileScreenLayout";
import { useColors } from "@/hooks/useColors";
import { getPublicAppConfig, type LegalDocument } from "@/lib/api";

export default function LegalScreen() {
  const colors = useColors();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [data, setData] = useState<LegalDocument | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicAppConfig()
      .then((config) => {
        if (!active) return;
        const key = type === "terms" || type === "cookies" || type === "mentions" ? type : "privacy";
        const document = config.legalContent?.[key];
        if (!document) setError(true);
        else setData(document);
      })
      .catch(() => active && setError(true));
    return () => { active = false; };
  }, [type]);

  if (!data) {
    return (
      <ProfileScreenLayout title="Jatek">
        <View style={styles.center}>
          {error ? <Text style={{ color: colors.destructive }}>Impossible de charger ce document.</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      </ProfileScreenLayout>
    );
  }

  return (
    <ProfileScreenLayout title={data.title}>
      <View style={{ padding: 20 }}>
        {data.intro ? <Text style={[styles.intro, { color: colors.mutedForeground }]}>{data.intro}</Text> : null}
        {data.sections.map((s, i) => (
          <View key={i} style={{ marginBottom: 22 }}>
            <Text style={[styles.h, { color: colors.heading }]}>{s.h}</Text>
            <Text style={[styles.p, { color: colors.mutedForeground }]}>{s.p}</Text>
          </View>
        ))}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>Dernière mise à jour : {data.updatedAt}</Text>
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  intro: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 22 },
  h: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  p: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  footer: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 16 },
});
