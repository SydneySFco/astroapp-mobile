import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {trackEvent} from '../../features/analytics/analytics';
import {useRegisterMutation} from '../../features/auth/authApi';
import {setOnboardingComplete} from '../../features/onboarding/onboardingSlice';
import {colors} from '../../theme/colors';

type Props = {
  onGoLogin: () => void;
};

const TOTAL_STEPS = 5;

const INTENT_OPTIONS = [
  'Bugün neye odaklanacağımı görmek istiyorum',
  'Duygumu regüle etmek için kısa yönlendirme istiyorum',
  'Kendim hakkında kısa ve kişisel bir içgörü istiyorum',
];

export function RegisterScreen({onGoLogin}: Props) {
  const dispatch = useDispatch();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [intent, setIntent] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [localSuccess, setLocalSuccess] = useState('');

  const [register, {isLoading, isError}] = useRegisterMutation();

  useEffect(() => {
    trackEvent('signup_start', {source: 'register_screen'});
  }, []);

  useEffect(() => {
    if (!showSummary) {
      trackEvent('onboarding_step_view', {step});
    }
  }, [showSummary, step]);

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
        if (!unknownBirthTime && !birthTime.trim()) {
          return 'Doğum saati girin ya da "Bilmiyorum" seçin.';
        }
        if (!city.trim()) {
          return 'Şehir zorunludur.';
        }
        if (!country.trim()) {
          return 'Ülke zorunludur.';
        }
        return '';
      case 5:
        if (!intent.trim()) {
          return 'Niyet seçimi zorunludur.';
        }
        return '';
      default:
        return '';
    }
  }, [birthDate, birthTime, city, country, email, fullName, intent, password, step, unknownBirthTime]);

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
        birthTime: unknownBirthTime ? undefined : birthTime.trim(),
        city: city.trim(),
        country: country.trim(),
        intent: intent.trim(),
      }).unwrap();

      trackEvent('signup_complete', {source: 'register_screen'});
      setLocalSuccess('Hesabın oluşturuldu. Son adım: kısa özetin hazır ✨');
      setShowSummary(true);
    } catch {
      // API error state aşağıda gösteriliyor.
    }
  };

  const completeOnboarding = () => {
    trackEvent('onboarding_complete', {
      intent,
      birthTimeKnown: !unknownBirthTime,
    });
    dispatch(setOnboardingComplete(true));
  };

  if (showSummary) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Onboarding tamamlandı 🎉</Text>
        <Text style={styles.subtitle}>
          Kısa profilin hazır. İlk rehberliğine geçmeye hazırsın.
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>☀️ Güneş: Hesaplanıyor...</Text>
          <Text style={styles.summaryLabel}>🌙 Ay: Hesaplanıyor...</Text>
          <Text style={styles.summaryLabel}>⬆️ Yükselen: Hesaplanıyor...</Text>
        </View>

        <Text style={styles.recommendation}>
          İlk kişisel önerin: Bugün 10 dakika boyunca niyetine odaklanıp küçük ve net bir adım seç.
        </Text>

        <Pressable onPress={completeOnboarding} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Ana Sayfaya Geç</Text>
        </Pressable>
      </View>
    );
  }

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
        <View style={styles.group}>
          <TextInput
            placeholder="Doğum Tarihi (GG/AA/YYYY)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={birthDate}
            onChangeText={setBirthDate}
          />

          <TextInput
            placeholder="Doğum Saati (SS:DD)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, unknownBirthTime && styles.disabledInput]}
            value={birthTime}
            onChangeText={setBirthTime}
            editable={!unknownBirthTime}
          />

          <Pressable
            onPress={() => setUnknownBirthTime(current => !current)}
            style={[styles.intentOption, unknownBirthTime && styles.intentOptionActive]}>
            <Text style={[styles.intentText, unknownBirthTime && styles.intentTextActive]}>
              Bilmiyorum
            </Text>
          </Pressable>

          <TextInput
            placeholder="Şehir"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={city}
            onChangeText={setCity}
          />

          <TextInput
            placeholder="Ülke"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={country}
            onChangeText={setCountry}
          />
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.group}>
          <Text style={styles.intentHeader}>Bugün uygulamadan ne bekliyorsun?</Text>
          <Text style={styles.subtitle}>Bir niyet seç, günlük önerilerin buna göre şekillensin.</Text>
          {INTENT_OPTIONS.map(option => {
            const selected = option === intent;
            return (
              <Pressable
                key={option}
                onPress={() => setIntent(option)}
                style={[styles.intentOption, selected && styles.intentOptionActive]}>
                <Text style={[styles.intentText, selected && styles.intentTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
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
              <Text style={styles.primaryButtonText}>Özeti Gör</Text>
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
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabledInput: {
    opacity: 0.5,
  },
  group: {
    gap: 8,
  },
  intentHeader: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  intentOption: {
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  intentOptionActive: {
    backgroundColor: '#4A63F5',
    borderColor: '#4A63F5',
  },
  intentText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  intentTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
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
  summaryBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    backgroundColor: '#1B2240',
  },
  summaryLabel: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  recommendation: {
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
});
