import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {ScreenState} from '../../components/ScreenState';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Input} from '../../components/ui/Input';
import {StateBanner} from '../../components/ui/StateBanner';
import {trackEvent} from '../../features/analytics/analytics';
import {useRegisterMutation} from '../../features/auth/authApi';
import {setOnboardingComplete} from '../../features/onboarding/onboardingSlice';
import {useTheme} from '../../theme/ThemeProvider';

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
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const [register, {isLoading, isError, reset}] = useRegisterMutation();

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
      trackEvent('auth_error', {scope: 'register'});
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
      <Card style={styles.card}>
        <Text style={styles.title}>Onboarding tamamlandı 🎉</Text>
        <Text style={styles.subtitle}>Kısa profilin hazır. İlk rehberliğine geçmeye hazırsın.</Text>

        <Card style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>☀️ Güneş: Hesaplanıyor...</Text>
          <Text style={styles.summaryLabel}>🌙 Ay: Hesaplanıyor...</Text>
          <Text style={styles.summaryLabel}>⬆️ Yükselen: Hesaplanıyor...</Text>
        </Card>

        <Text style={styles.recommendation}>
          İlk kişisel önerin: Bugün 10 dakika boyunca niyetine odaklanıp küçük ve net bir adım seç.
        </Text>

        <Button label="Ana Sayfaya Geç" onPress={completeOnboarding} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Text style={styles.stepIndicator}>
        Adım {step}/{TOTAL_STEPS}
      </Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Hesap oluşturuluyor"
          description="Bilgilerin kaydediliyor, lütfen bekle."
        />
      ) : null}

      {step === 1 ? <Input placeholder="Ad Soyad" value={fullName} onChangeText={setFullName} /> : null}

      {step === 2 ? (
        <Input
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      ) : null}

      {step === 3 ? (
        <Input placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
      ) : null}

      {step === 4 ? (
        <View style={styles.group}>
          <Input placeholder="Doğum Tarihi (GG/AA/YYYY)" value={birthDate} onChangeText={setBirthDate} />

          <Input
            placeholder="Doğum Saati (SS:DD)"
            style={unknownBirthTime ? styles.disabledInput : undefined}
            value={birthTime}
            onChangeText={setBirthTime}
            editable={!unknownBirthTime}
          />

          <Button
            onPress={() => setUnknownBirthTime(current => !current)}
            label="Bilmiyorum"
            variant={unknownBirthTime ? 'primary' : 'secondary'}
          />

          <Input placeholder="Şehir" value={city} onChangeText={setCity} />
          <Input placeholder="Ülke" value={country} onChangeText={setCountry} />
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

      {stepError ? <StateBanner tone="error" description={stepError} /> : null}

      <View style={styles.row}>
        <Button label="Geri" variant="secondary" onPress={onPrev} disabled={step === 1 || isLoading} style={styles.rowButton} />

        {step < TOTAL_STEPS ? (
          <Button label="İleri" onPress={onNext} disabled={isLoading} style={styles.rowButton} />
        ) : (
          <Button label="Özeti Gör" onPress={onSubmit} disabled={isLoading} style={styles.rowButton} />
        )}
      </View>

      {isError ? (
        <ScreenState
          mode="error"
          title="Kayıt başarısız"
          description="Zayıf ağ, offline ya da zaman aşımı oluşmuş olabilir."
          onRetry={() => {
            trackEvent('auth_retry', {scope: 'register'});
            reset();
            onSubmit();
          }}
        />
      ) : null}
      {localSuccess ? <StateBanner tone="success" description={localSuccess} /> : null}

      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text>
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
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: 'transparent',
    },
    intentOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    intentText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    intentTextActive: {
      color: colors.ctaPrimaryText,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    rowButton: {
      flex: 1,
    },
    link: {
      color: colors.primary,
      marginTop: 8,
      textAlign: 'center',
    },
    summaryBox: {
      marginTop: 8,
      backgroundColor: colors.primarySoft,
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