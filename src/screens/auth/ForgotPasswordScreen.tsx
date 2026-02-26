import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

import {ScreenState} from '../../components/ScreenState';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Input} from '../../components/ui/Input';
import {StateBanner} from '../../components/ui/StateBanner';
import {trackEvent} from '../../features/analytics/analytics';
import {useForgotPasswordMutation} from '../../features/auth/authApi';
import {useTheme} from '../../theme/ThemeProvider';

type Props = {
  onGoLogin: () => void;
};

export function ForgotPasswordScreen({onGoLogin}: Props) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [forgotPassword, {isLoading, isError, reset}] = useForgotPasswordMutation();

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
      trackEvent('auth_error', {scope: 'forgot_password'});
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Şifremi Unuttum</Text>
      <Text style={styles.subtitle}>
        Hesabına bağlı e-posta adresini gir. Sana şifre sıfırlama bağlantısı gönderelim.
      </Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Sıfırlama talebi gönderiliyor"
          description="Bağlantı kuruluyor, lütfen bekle."
        />
      ) : null}

      <Input
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {email.length > 0 && emailError ? <Text style={styles.error}>{emailError}</Text> : null}

      <Button label="Bağlantı Gönder" onPress={onSubmit} disabled={isLoading} />

      {isError ? (
        <ScreenState
          mode="error"
          title="İşlem başarısız"
          description="Bağlantı hatası ya da zaman aşımı oluştu."
          onRetry={() => {
            trackEvent('auth_retry', {scope: 'forgot_password'});
            reset();
            onSubmit();
          }}
        />
      ) : null}
      {localSuccess ? <StateBanner tone="success" description={localSuccess} /> : null}

      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Giriş ekranına dön</Text>
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
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 8,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
    },
    link: {
      color: colors.primary,
      marginTop: 8,
      textAlign: 'center',
    },
  });