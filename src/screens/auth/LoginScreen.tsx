import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../../components/ScreenState';
import {Button} from '../../components/ui/Button';
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
    <View style={styles.wrapper}>
      <Pressable onPress={onGoRegister} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <View style={styles.logoWrap}>
        <Text style={styles.logoIcon}>✦</Text>
      </View>

      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to continue your cosmic guidance.</Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Giriş doğrulanıyor"
          description="Bilgilerin kontrol ediliyor, lütfen bekle."
        />
      ) : null}

      <Text style={styles.fieldLabel}>Email Address</Text>
      <Input
        placeholder="name@example.com"
        placeholderTextColor="#5F6E95"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {email.length > 0 && errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <View style={styles.passwordRow}>
        <Text style={styles.fieldLabel}>Password</Text>
        <Pressable onPress={onGoForgotPassword}>
          <Text style={styles.forgotLink}>Forgot Password?</Text>
        </Pressable>
      </View>
      <Input
        placeholder="••••••••"
        placeholderTextColor="#5F6E95"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {password.length > 0 && errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

      <Button label="Sign In  →" onPress={onSubmit} disabled={isLoading} style={styles.signInButton} textStyle={styles.signInButtonText} />

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

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        <Pressable style={styles.socialButton}>
          <Text style={styles.socialIcon}>G</Text>
        </Pressable>
        <Pressable style={styles.socialButton}>
          <Text style={styles.socialIcon}></Text>
        </Pressable>
      </View>

      <Pressable onPress={onGoRegister}>
        <Text style={styles.footerLink}>Don’t have an account? <Text style={styles.footerLinkAccent}>Sign up</Text></Text>
      </Pressable>
    </View>
  );
}

const createStyles = (_colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: 'transparent',
      gap: 14,
      paddingHorizontal: 2,
    },
    backButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
    },
    backIcon: {
      color: '#E4E9FF',
      fontSize: 34,
      lineHeight: 34,
      marginTop: -2,
    },
    logoWrap: {
      width: 76,
      height: 76,
      borderRadius: 22,
      backgroundColor: '#1D234B',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    logoIcon: {
      color: '#8D7CFF',
      fontSize: 34,
      lineHeight: 36,
    },
    title: {
      color: '#F4F6FF',
      fontSize: 54,
      fontWeight: '800',
      lineHeight: 58,
      letterSpacing: -1.1,
      marginTop: 6,
    },
    subtitle: {
      color: '#90A0C0',
      fontSize: 19,
      lineHeight: 28,
      marginBottom: 8,
    },
    fieldLabel: {
      color: '#EEF2FF',
      fontSize: 22,
      fontWeight: '700',
      marginTop: 6,
    },
    input: {
      backgroundColor: '#1A2148',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#222B58',
      minHeight: 72,
      paddingHorizontal: 20,
      color: '#EAF0FF',
      fontSize: 18,
    },
    passwordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    forgotLink: {
      color: '#8D7CFF',
      fontWeight: '700',
      fontSize: 14,
      marginTop: 10,
    },
    signInButton: {
      marginTop: 22,
      borderRadius: 20,
      minHeight: 78,
      backgroundColor: '#8272F2',
      shadowColor: '#8272F2',
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 8,
    },
    signInButtonText: {
      color: '#EDF2FF',
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '700',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#243157',
    },
    dividerText: {
      color: '#7E8BAE',
      fontSize: 12,
      letterSpacing: 1,
      fontWeight: '600',
    },
    socialRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 2,
    },
    socialButton: {
      flex: 1,
      minHeight: 60,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#25325D',
      backgroundColor: '#1A224B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    socialIcon: {
      color: '#ECF1FF',
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 32,
    },
    footerLink: {
      color: '#97A4C3',
      textAlign: 'center',
      marginTop: 16,
      fontSize: 14,
    },
    footerLinkAccent: {
      color: '#8D7CFF',
      fontWeight: '700',
    },
    error: {
      color: '#FCA5A5',
      fontSize: 12,
      marginTop: -6,
      marginBottom: 4,
    },
  });
