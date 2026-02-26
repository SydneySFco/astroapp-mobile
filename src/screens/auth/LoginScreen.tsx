import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

import {ScreenState} from '../../components/ScreenState';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Input} from '../../components/ui/Input';
import {StateBanner} from '../../components/ui/StateBanner';
import {trackEvent} from '../../features/analytics/analytics';
import {useLoginMutation} from '../../features/auth/authApi';
import {useTheme} from '../../theme/ThemeProvider';

type Props = {
  onGoRegister: () => void;
  onGoForgotPassword: () => void;
};

export function LoginScreen({onGoRegister, onGoForgotPassword}: Props) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [login, {isLoading, isError, reset}] = useLoginMutation();

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
      trackEvent('auth_error', {scope: 'login'});
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Giriş Yap</Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Giriş doğrulanıyor"
          description="Bilgilerin kontrol ediliyor, lütfen bekle."
        />
      ) : null}

      <Input
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {email.length > 0 && errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <Input placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
      {password.length > 0 && errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

      <Button label="Giriş Yap" onPress={onSubmit} disabled={isLoading} />

      {isError ? (
        <ScreenState
          mode="error"
          title="Giriş başarısız"
          description="Bağlantını veya bilgilerini kontrol edip tekrar deneyebilirsin."
          onRetry={() => {
            trackEvent('auth_retry', {scope: 'login'});
            reset();
            onSubmit();
          }}
        />
      ) : null}
      {localSuccess ? <StateBanner tone="success" description={localSuccess} /> : null}

      <Pressable onPress={onGoForgotPassword}>
        <Text style={styles.link}>Şifremi unuttum</Text>
      </Pressable>

      <Pressable onPress={onGoRegister}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
      </Pressable>
    </Card>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {gap: 8},
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
    },
    link: {
      color: colors.primary,
      marginTop: 6,
      textAlign: 'center',
    },
    error: {
      color: colors.danger,
      fontSize: 12,
    },
  });