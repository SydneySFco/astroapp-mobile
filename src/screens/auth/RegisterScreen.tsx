import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {ScreenState} from '../../components/ScreenState';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Input} from '../../components/ui/Input';
import {StateBanner} from '../../components/ui/StateBanner';
import {trackEvent} from '../../features/analytics/analytics';
import {useRegisterMutation} from '../../features/auth/authApi';
import {setOnboardingComplete} from '../../features/onboarding/onboardingSlice';
import {fontFamilies} from '../../theme/typography';
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

  if (step === 4) {
    return (
      <View style={styles.birthScreen}>
        <View style={styles.birthAppBar}>
          <Pressable onPress={onPrev} style={styles.appBarBackButton}>
            <Text style={styles.appBarBackText}>←</Text>
          </Pressable>
          <Text style={styles.birthAppBarTitle}>Birth Details</Text>
          <Text style={styles.stepChip}>4/5</Text>
        </View>

        <ScrollView contentContainerStyle={styles.birthContent}>
          <Text style={styles.birthTitle}>Let's find your cosmic blueprint</Text>
          <Text style={styles.subtitle}>Kişisel haritanı doğru hesaplamak için doğum verilerini net girelim.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>◷</Text>
              <Input
                placeholder="DD / MM / YYYY"
                value={birthDate}
                onChangeText={setBirthDate}
                style={styles.fieldInput}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.timeHeaderRow}>
              <Text style={styles.fieldLabel}>Time of Birth</Text>
              <Pressable
                style={[styles.unknownTimeToggle, unknownBirthTime && styles.unknownTimeToggleActive]}
                onPress={() => setUnknownBirthTime(current => !current)}>
                <Text style={[styles.unknownTimeText, unknownBirthTime && styles.unknownTimeTextActive]}>
                  Unknown time
                </Text>
              </Pressable>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>◔</Text>
              <Input
                placeholder="--:--"
                style={[styles.fieldInput, unknownBirthTime ? styles.disabledInput : undefined]}
                value={birthTime}
                onChangeText={setBirthTime}
                editable={!unknownBirthTime}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Place of Birth</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>⌖</Text>
              <Input placeholder="City" value={city} onChangeText={setCity} style={styles.fieldInput} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>◎</Text>
              <Input placeholder="Country" value={country} onChangeText={setCountry} style={styles.fieldInput} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.stickyFooter}>
          {stepError ? <StateBanner tone="error" description={stepError} /> : null}
          <Button label="Continue" onPress={onNext} disabled={isLoading} style={styles.stickyButton} />
        </View>
      </View>
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

      {step === 1 ? <Input placeholder="Ad Soyad" value={fullName} onChangeText={setFullName} style={styles.tallInput} /> : null}

      {step === 2 ? (
        <Input
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.tallInput}
        />
      ) : null}

      {step === 3 ? (
        <Input placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry style={styles.tallInput} />
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
    card: {
      gap: 10,
      borderRadius: 16,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontFamily: fontFamilies.heading,
      letterSpacing: -0.2,
    },
    stepIndicator: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 6,
      fontFamily: fontFamilies.bodyMedium,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: fontFamilies.body,
    },
    tallInput: {
      minHeight: 54,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    disabledInput: {
      opacity: 0.5,
    },
    group: {
      gap: 8,
    },
    birthScreen: {
      flex: 1,
      backgroundColor: '#0F0F23',
      marginHorizontal: -22,
      marginVertical: -18,
    },
    birthAppBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#252A4D',
      backgroundColor: '#151935',
    },
    appBarBackButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#212751',
    },
    appBarBackText: {
      color: '#F4F6FF',
      fontSize: 18,
      marginTop: -1,
    },
    birthAppBarTitle: {
      color: '#F5F7FF',
      fontSize: 16,
      fontFamily: fontFamilies.heading,
    },
    stepChip: {
      color: '#AEB7DE',
      fontSize: 12,
      fontFamily: fontFamilies.bodyBold,
      minWidth: 34,
      textAlign: 'right',
    },
    birthContent: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 120,
      gap: 14,
    },
    birthTitle: {
      color: '#F5F7FF',
      fontSize: 30,
      lineHeight: 36,
      fontFamily: fontFamilies.display,
      letterSpacing: -0.5,
    },
    fieldGroup: {
      gap: 8,
    },
    fieldLabel: {
      color: '#E6EBFF',
      fontSize: 13,
      fontFamily: fontFamilies.bodyBold,
      marginLeft: 2,
    },
    fieldRow: {
      minHeight: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#28305A',
      backgroundColor: '#1A2148',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 8,
      gap: 8,
    },
    fieldIcon: {
      color: '#95A1C8',
      fontSize: 14,
      width: 18,
      textAlign: 'center',
    },
    fieldInput: {
      flex: 1,
      minHeight: 46,
      borderWidth: 0,
      borderRadius: 10,
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: 'transparent',
      color: '#EAF0FF',
    },
    timeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unknownTimeToggle: {
      borderWidth: 1,
      borderColor: '#30396A',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: '#1A2148',
    },
    unknownTimeToggleActive: {
      borderColor: '#7A7AFF',
      backgroundColor: '#232A58',
    },
    unknownTimeText: {
      color: '#A7B2DA',
      fontSize: 11,
      fontFamily: fontFamilies.bodyBold,
    },
    unknownTimeTextActive: {
      color: '#AFA5FF',
    },
    stickyFooter: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#151935',
      borderTopWidth: 1,
      borderTopColor: '#252A4D',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 8,
    },
    stickyButton: {
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: '#7A7AFF',
    },
    intentHeader: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fontFamilies.bodyBold,
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
      fontFamily: fontFamilies.body,
    },
    intentTextActive: {
      color: colors.ctaPrimaryText,
      fontFamily: fontFamilies.bodyBold,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    rowButton: {
      flex: 1,
      minHeight: 48,
      justifyContent: 'center',
      borderRadius: 12,
    },
    link: {
      color: colors.primary,
      marginTop: 8,
      textAlign: 'center',
      fontFamily: fontFamilies.bodyBold,
    },
    summaryBox: {
      marginTop: 8,
      backgroundColor: colors.primarySoft,
    },
    summaryLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fontFamilies.body,
    },
    recommendation: {
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 20,
      fontFamily: fontFamilies.body,
    },
  });
