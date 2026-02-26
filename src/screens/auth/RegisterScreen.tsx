import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {trackEvent} from '../../features/analytics/analytics';
import {useRegisterMutation} from '../../features/auth/authApi';
import {colors} from '../../theme/colors';

type Props = {
  onGoLogin: () => void;
};

const TOTAL_STEPS = 5;

export function RegisterScreen({onGoLogin}: Props) {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [intent, setIntent] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const [register, {isLoading, isError}] = useRegisterMutation();

  useEffect(() => {
    trackEvent('signup_start', {source: 'register_screen'});
  }, []);

  const stepError = useMemo(() => {
    switch (step) {
      case 1:
        if (!fullName.trim()) {
          return 'Ad soyad zorunludur.';
        }
        return '';
      case 2:
        if (!email.trim()) {
          return 'E-posta zorunludur.';
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          return 'Geçerli bir e-posta girin.';
        }
        return '';
      case 3:
        if (!password.trim()) {
          return 'Şifre zorunludur.';
        }
        if (password.length < 6) {
          return 'Şifre en az 6 karakter olmalıdır.';
        }
        return '';
      case 4:
        if (!birthDate.trim()) {
          return 'Doğum tarihi zorunludur (GG/AA/YYYY).';
        }
        return '';
      case 5:
        if (!intent.trim()) {
          return 'Niyet alanı zorunludur.';
        }
        return '';
      default:
        return '';
    }
  }, [birthDate, email, fullName, intent, password, step]);

  const onNext = () => {
    setLocalSuccess('');
    if (stepError) {
      return;
    }
    setStep(current => Math.min(TOTAL_STEPS, current + 1));
  };

  const onPrev = () => {
    setLocalSuccess('');
    setStep(current => Math.max(1, current - 1));
  };

  const onSubmit = async () => {
    setLocalSuccess('');
    if (stepError) {
      return;
    }

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        birthDate: birthDate.trim(),
        intent: intent.trim(),
      }).unwrap();

      trackEvent('signup_complete', {source: 'register_screen'});
      setLocalSuccess('Kayıt tamamlandı. Hoş geldin ✨');
    } catch {
      // API error state aşağıda gösteriliyor.
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Text style={styles.stepIndicator}>
        Adım {step}/{TOTAL_STEPS}
      </Text>

      {step === 1 ? (
        <TextInput
          placeholder="Ad Soyad"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
        />
      ) : null}

      {step === 2 ? (
        <TextInput
          placeholder="E-posta"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      ) : null}

      {step === 3 ? (
        <TextInput
          placeholder="Şifre"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      ) : null}

      {step === 4 ? (
        <TextInput
          placeholder="Doğum Tarihi (GG/AA/YYYY)"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
        />
      ) : null}

      {step === 5 ? (
        <TextInput
          placeholder="Bugün en çok neye odaklanmak istiyorsun?"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.multilineInput]}
          multiline
          numberOfLines={3}
          value={intent}
          onChangeText={setIntent}
        />
      ) : null}

      {stepError ? <Text style={styles.error}>{stepError}</Text> : null}

      <View style={styles.row}>
        <Pressable onPress={onPrev} style={styles.secondaryButton} disabled={step === 1 || isLoading}>
          <Text style={styles.secondaryButtonText}>Geri</Text>
        </Pressable>

        {step < TOTAL_STEPS ? (
          <Pressable onPress={onNext} style={styles.primaryButton} disabled={isLoading}>
            <Text style={styles.primaryButtonText}>İleri</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onSubmit} style={styles.primaryButton} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Kayıt Ol</Text>
            )}
          </Pressable>
        )}
      </View>

      {isError ? <Text style={styles.error}>Kayıt başarısız. Lütfen tekrar dene.</Text> : null}
      {localSuccess ? <Text style={styles.success}>{localSuccess}</Text> : null}

      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text>
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
  stepIndicator: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#4A63F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#2B355D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
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
