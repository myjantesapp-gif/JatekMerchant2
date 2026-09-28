import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, font } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwRef = useRef<TextInput>(null);
  const top = Platform.OS === 'web' ? 67 : insets.top;

  const submit = async () => {
    if (!email.trim() || !password) { setError('Saisissez votre e-mail et votre mot de passe.'); return; }
    setBusy(true); setError(null);
    try { await login(email, password); setPassword(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  };

  const input = [s.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, borderRadius: c.radius }];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={[s.wrap, { paddingTop: top + 32, paddingBottom: insets.bottom + 34 }]}
      >
        <View style={[s.hero, { backgroundColor: c.ink, borderRadius: c.radius + 8 }]}>
          <View style={[s.mark, { backgroundColor: c.primary }]}>
            <Text style={[s.markText, { color: c.primaryForeground }]}>J</Text>
          </View>
          <Text style={[s.kicker, { color: c.accent }]}>ESPACE MARCHAND</Text>
          <Text style={[s.title, { color: c.inkForeground }]}>Vos commandes,{'\n'}dans la poche.</Text>
          <Text style={[s.sub, { color: '#b9b3aa' }]}>Suivez vos boutiques et commandes Jatek en temps réel.</Text>
        </View>

        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={[s.label, { color: c.foreground }]}>E-mail</Text>
            <TextInput
              testID="email" accessibilityLabel="E-mail" style={input} value={email} onChangeText={setEmail}
              placeholder="vous@boutique.ma" placeholderTextColor={c.mutedForeground}
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[s.label, { color: c.foreground }]}>Mot de passe</Text>
            <View>
              <TextInput
                ref={pwRef} testID="password" accessibilityLabel="Mot de passe" style={[input, { paddingRight: 56 }]} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={c.mutedForeground}
                secureTextEntry={!show} autoComplete="password" returnKeyType="go" onSubmitEditing={submit}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                accessibilityState={{ checked: show }}
                hitSlop={6}
                style={s.eye}
                onPress={() => setShow((v) => !v)}
              >
                <Feather name={show ? 'eye-off' : 'eye'} size={18} color={c.mutedForeground} />
              </Pressable>
            </View>
          </View>
          {error ? (
            <View style={[s.err, { backgroundColor: '#d8393514', borderRadius: c.radius }]} testID="login-error">
              <Feather name="alert-circle" size={16} color={c.destructive} />
              <Text style={[s.errText, { color: c.destructive }]}>{error}</Text>
            </View>
          ) : null}
          <Button testID="login-submit" label="Se connecter" icon="log-in" onPress={submit} loading={busy} />
          <Text style={[s.foot, { color: c.mutedForeground }]}>Connexion sécurisée à api.jatek.app</Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 28, flexGrow: 1, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { padding: 24, gap: 10 },
  mark: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  markText: { fontFamily: font.bold, fontSize: 22 },
  kicker: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6 },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 34 },
  sub: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: font.medium, fontSize: 13 },
  input: { height: 50, borderWidth: 1, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 15 },
  eye: { position: 'absolute', right: 3, top: 3, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  err: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
  errText: { fontFamily: font.medium, fontSize: 13, flex: 1, lineHeight: 18 },
  foot: { fontFamily: font.regular, fontSize: 12, textAlign: 'center' },
});
