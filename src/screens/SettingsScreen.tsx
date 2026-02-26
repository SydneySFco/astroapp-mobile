import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {trackEvent} from '../features/analytics/analytics';
import {colors} from '../theme/colors';

type DeleteRequestStatus = 'idle' | 'success' | 'fail';
type RequestStatus = 'idle' | 'loading' | 'error';

type Props = {
  onOpenLegal: () => void;
  onLogout: () => void;
};

export function SettingsScreen({onOpenLegal, onLogout}: Props) {
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profil Özeti</Text>
        <Text style={styles.cardText}>Demo Kullanıcı</Text>
        <Text style={styles.cardText}>demo@astroapp.local</Text>
        <Text style={styles.cardText}>Plan: Ücretsiz</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bilgilendirme ve Onay</Text>
        <Text style={styles.cardText}>
          AstroApp’i kullanarak KVKK/Gizlilik/Koşullar metinlerini okuduğunu ve veri işleme
          bilgilendirmesini kabul ettiğini beyan edersin.
        </Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={handleOpenLegal}>
        <Text style={styles.secondaryButtonText}>Yasal Metinleri Gör</Text>
      </Pressable>

      <Pressable style={styles.warningButton} onPress={handleDeleteRequest}>
        <Text style={styles.warningButtonText}>Hesap Silme Talebi Oluştur (Demo)</Text>
      </Pressable>

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
        <Text style={styles.successText}>Talebin alındı. 24 saat içinde e-posta ile dönüş yapılır.</Text>
      ) : null}

      {deleteStatus === 'fail' ? (
        <Text style={styles.errorText}>Talep şu an alınamadı. Lütfen tekrar dene.</Text>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={handleLogout}>
        <Text style={styles.primaryButtonText}>Çıkış Yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 6,
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
  primaryButton: {
    marginTop: 'auto',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.ctaPrimaryText,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.ctaSecondaryText,
    fontWeight: '700',
  },
  warningButton: {
    backgroundColor: colors.stateErrorBg,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warningButtonText: {
    color: colors.error,
    fontWeight: '700',
  },
  successText: {
    color: colors.success,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
});
