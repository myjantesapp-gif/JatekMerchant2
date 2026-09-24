import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { ApiError } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { Field, PrimaryButton } from '@/components/MerchantUI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function MerchantLoginScreen() {
  const colors = useColors();
  const { login } = useMerchantAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Saisissez votre adresse e-mail et votre mot de passe.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? 'Adresse e-mail ou mot de passe incorrect.'
          : cause instanceof Error
            ? cause.message
            : 'La connexion a échoué. Réessayez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollViewCompat
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={[styles.brandMark, { backgroundColor: colors.sidebar }]}>
            <Feather name="shopping-bag" size={27} color={colors.accent} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>JATEK MARCHAND</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Bon retour.</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Connectez-vous pour gérer vos commandes et votre boutique.
          </Text>
          <View
            style={[
              styles.form,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Field
              label="Adresse e-mail"
              testID="input-merchant-email"
              value={email}
              onChangeText={setEmail}
              placeholder="nom@votreboutique.fr"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <Field
              label="Mot de passe"
              testID="input-merchant-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Votre mot de passe"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Feather name="alert-circle" size={17} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}
            <PrimaryButton
              label={isSubmitting ? 'Connexion…' : 'Se connecter'}
              onPress={() => void submit()}
              busy={isSubmitting}
              testID="button-merchant-login"
            />
            {isSubmitting ? (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            ) : null}
          </View>
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Utilisez les identifiants de votre compte marchand Jatek.
          </Text>
        </KeyboardAwareScrollViewCompat>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboard: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingTop: Platform.OS === 'web' ? 74 : 38,
    paddingBottom: 42,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { marginTop: 8, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  description: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  form: {
    gap: 17,
    borderWidth: 1,
    borderRadius: 23,
    padding: 20,
    marginTop: 26,
  },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  spinner: { marginTop: -7 },
  helpText: { textAlign: 'center', marginTop: 20, fontSize: 12, lineHeight: 18 },
});