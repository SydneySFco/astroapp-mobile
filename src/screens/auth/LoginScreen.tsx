import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {useLoginMutation} from '../../features/auth/authApi';
import {colors} from '../../theme/colors';

type Props = {
  onGoRegister: () => void;
  onGoForgotPassword: () => void;
};

export function LoginScreen({onGoRegister, onGoForgotPassword}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [login, {isLoading, isError}] = useLoginMutation();

  const errors = useMemo(() => {
    const nextErrors: {email?: string; password?: string} = {};
    if (!email.trim()) {
      nextErrors.email = 'E-posta zorunludur.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = 'Geçerli bir e-posta girin.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Şifre zorunludur.';
    } else if (password.length < 6) {
      nextErrors.password = 'Şifre en az 6 karakter olmalıdır.';
    }

    return nextErrors;
  }, [email, password]);

  const isValid = Object.keys(errors).length === 0;

  const onSubmit = async () => {
    setLocalSuccess('');
    if (!isValid) {
      return;
    }

    try {
      await login({email: email.trim(), password}).unwrap();
      setLocalSuccess('Giriş başarılı. Hoş geldin ✨');
    } catch {
      // API hata metni global toast ile de gösterilebilir.
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Giriş Yap</Text>

      <TextInput
        placeholder="E-posta"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {email.length > 0 && errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <TextInput
        placeholder="Şifre"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {password.length > 0 && errors.password ? (
        <Text style={styles.error}>{errors.password}</Text>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Giriş Yap</Text>
        )}
      </Pressable>

      {isError ? <Text style={styles.error}>Giriş başarısız. Bilgilerini kontrol edip tekrar dene.</Text> : null}
      {localSuccess ? <Text style={styles.success}>{localSuccess}</Text> : null}

      <Pressable onPress={onGoForgotPassword}>
        <Text style={styles.link}>Şifremi unuttum</Text>
      </Pressable>

      <Pressable onPress={onGoRegister}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
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
  link: {
    color: '#8EA2FF',
    marginTop: 6,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  success: {
    color: colors.success,
    fontSize: 12,
  },
});
