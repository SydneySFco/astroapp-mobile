import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {useForgotPasswordMutation} from '../../features/auth/authApi';
import {colors} from '../../theme/colors';

type Props = {
  onGoLogin: () => void;
};

export function ForgotPasswordScreen({onGoLogin}: Props) {
  const [email, setEmail] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [forgotPassword, {isLoading, isError}] = useForgotPasswordMutation();

  const emailError = useMemo(() => {
    if (!email.trim()) {
      return 'E-posta zorunludur.';
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return 'Geçerli bir e-posta girin.';
    }

    return '';
  }, [email]);

  const onSubmit = async () => {
    setLocalSuccess('');
    if (emailError) {
      return;
    }

    try {
      await forgotPassword({email: email.trim()}).unwrap();
      setLocalSuccess('Şifre sıfırlama bağlantısı gönderildi. E-postanı kontrol et.');
    } catch {
      // API error state aşağıda gösteriliyor.
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Şifremi Unuttum</Text>
      <Text style={styles.subtitle}>
        Hesabına bağlı e-posta adresini gir. Sana şifre sıfırlama bağlantısı gönderelim.
      </Text>

      <TextInput
        placeholder="E-posta"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {email.length > 0 && emailError ? <Text style={styles.error}>{emailError}</Text> : null}

      <Pressable onPress={onSubmit} style={styles.primaryButton} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Bağlantı Gönder</Text>
        )}
      </Pressable>

      {isError ? (
        <Text style={styles.error}>İşlem başarısız. Bağlantını kontrol edip tekrar dene.</Text>
      ) : null}
      {localSuccess ? <Text style={styles.success}>{localSuccess}</Text> : null}

      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Giriş ekranına dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#4A63F5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  success: {
    color: colors.success,
    fontSize: 12,
  },
  link: {
    color: '#8EA2FF',
    marginTop: 8,
    textAlign: 'center',
  },
});
