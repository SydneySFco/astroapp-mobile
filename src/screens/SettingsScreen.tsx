import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {StateBanner} from '../components/ui/StateBanner';
import {trackEvent} from '../features/analytics/analytics';
import {useTheme} from '../theme/ThemeProvider';
import {ThemePreference} from '../theme/tokens';

type DeleteRequestStatus = 'idle' | 'success' | 'fail';
type RequestStatus = 'idle' | 'loading' | 'error';

type Props = {
  onOpenLegal: () => void;
  onLogout: () => void;
  themePreference: ThemePreference;
  onChangeThemePreference: (next: ThemePreference) => Promise<void>;
};

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu',
};

export function SettingsScreen({
  onOpenLegal,
  onLogout,
  themePreference,
  onChangeThemePreference,
}: Props) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [deleteStatus, setDeleteStatus] = useState<DeleteRequestStatus>('idle');
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  const handleOpenLegal = () => {
    trackEvent('legal_open', {source: 'settings'});
    onOpenLegal();
  };

  const handleLogout = () => {
    trackEvent('logout_click');
    onLogout();
  };

  const handleDeleteRequest = () => {
    setRequestStatus('loading');
    setDeleteStatus('idle');
    trackEvent('delete_request_click');

    setTimeout(() => {
      const shouldTimeout = attempt % 2 === 0;
      setAttempt(current => current + 1);

      if (shouldTimeout) {
        setRequestStatus('error');
        trackEvent('settings_error', {scope: 'delete_request', reason: 'timeout'});
        return;
      }

      setRequestStatus('idle');
      const isSuccess = Math.random() > 0.35;
      setDeleteStatus(isSuccess ? 'success' : 'fail');

      if (!isSuccess) {
        trackEvent('settings_error', {scope: 'delete_request', reason: 'server_fail'});
      }
    }, 900);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ayarlar</Text>

      <Card>
        <Text style={styles.cardTitle}>Tema Modu</Text>
        <View style={styles.optionRow}>
          {THEME_OPTIONS.map(option => (
            <Button
              key={option}
              label={THEME_LABELS[option]}
              variant={themePreference === option ? 'primary' : 'secondary'}
              style={styles.themeButton}
              onPress={() => onChangeThemePreference(option)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Profil Özeti</Text>
        <Text style={styles.cardText}>Demo Kullanıcı</Text>
        <Text style={styles.cardText}>demo@astroapp.local</Text>
        <Text style={styles.cardText}>Plan: Ücretsiz</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Bilgilendirme ve Onay</Text>
        <Text style={styles.cardText}>
          AstroApp’i kullanarak KVKK/Gizlilik/Koşullar metinlerini okuduğunu ve veri işleme
          bilgilendirmesini kabul ettiğini beyan edersin.
        </Text>
      </Card>

      <Button label="Yasal Metinleri Gör" variant="secondary" onPress={handleOpenLegal} />
      <Button
        label="Hesap Silme Talebi Oluştur (Demo)"
        variant="dangerSoft"
        onPress={handleDeleteRequest}
      />

      {requestStatus === 'loading' ? (
        <ScreenState
          mode="loading"
          title="Silme talebi gönderiliyor"
          description="İsteğin işleniyor, lütfen bekle."
        />
      ) : null}

      {requestStatus === 'error' ? (
        <ScreenState
          mode="error"
          title="Silme talebi zaman aşımına uğradı"
          description="Bağlantını kontrol edip tekrar dene."
          onRetry={() => {
            trackEvent('settings_retry', {scope: 'delete_request'});
            handleDeleteRequest();
          }}
        />
      ) : null}

      {deleteStatus === 'success' ? (
        <StateBanner tone="success" description="Talebin alındı. 24 saat içinde e-posta ile dönüş yapılır." />
      ) : null}

      {deleteStatus === 'fail' ? (
        <StateBanner tone="error" description="Talep şu an alınamadı. Lütfen tekrar dene." />
      ) : null}

      <Button label="Çıkış Yap" onPress={handleLogout} style={styles.logoutButton} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    cardText: {
      color: colors.textSecondary,
      lineHeight: 20,
    },
    optionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    themeButton: {
      flex: 1,
    },
    logoutButton: {
      marginTop: 'auto',
    },
  });