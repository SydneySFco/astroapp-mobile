import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {ScreenState} from '../components/ScreenState';
import {trackEvent} from '../features/analytics/analytics';
import {setPremium} from '../features/subscription/subscriptionSlice';
import {colors} from '../theme/colors';

type Props = {
  onClose: () => void;
};

type PlanType = 'monthly' | 'yearly';
type PurchaseResult = 'idle' | 'success' | 'fail' | 'cancel';
type RequestStatus = 'idle' | 'loading' | 'error';

const VALUE_PROPS = [
  'Her gün kişisel rehberlik ve mikro aksiyon',
  'Haftalık odak özeti ve sürdürülebilir rutin önerileri',
  'Reklamsız deneyim + premium içeriklere tam erişim',
];

const MOCK_TIMEOUT_MS = 1200;

export function PaywallScreen({onClose}: Props) {
  const dispatch = useDispatch();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  const [result, setResult] = useState<PurchaseResult>('idle');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    trackEvent('paywall_view', {source: 'free_home_entry'});
  }, []);

  const resultMessage = useMemo(() => {
    switch (result) {
      case 'success':
        return 'Abonelik başarılı! Premium özelliklerin açıldı ✨';
      case 'fail':
        return 'Ödeme alınamadı. Kartını kontrol edip tekrar deneyebilirsin.';
      case 'cancel':
        return 'İşlem iptal edildi. Hazır olduğunda kaldığın yerden devam edebilirsin.';
      default:
        return '';
    }
  }, [result]);

  const runPurchase = (purchaseType: 'subscribe' | 'restore') => {
    setStatus('loading');
    setResult('idle');

    setTimeout(() => {
      const shouldTimeout = attempt % 2 === 0;
      setAttempt(current => current + 1);

      if (shouldTimeout) {
        setStatus('error');
        trackEvent('paywall_error', {
          source: purchaseType,
          reason: 'timeout',
          plan: selectedPlan,
        });
        return;
      }

      setStatus('idle');
      setResult('success');
      dispatch(setPremium(true));
      trackEvent('subscribe_success', {plan: purchaseType === 'restore' ? 'restore' : selectedPlan});
    }, MOCK_TIMEOUT_MS);
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Premium’a geç</Text>
        <ScreenState
          mode="loading"
          title="Ödeme hazırlanıyor"
          description="Bağlantı kuruluyor, lütfen bekle."
        />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Premium’a geç</Text>
        <ScreenState
          mode="error"
          title="Bağlantı zaman aşımına uğradı"
          description="Ağ zayıf görünüyor. Yeniden deneyerek işleme devam edebilirsin."
          onRetry={() => {
            trackEvent('paywall_retry', {plan: selectedPlan});
            runPurchase('subscribe');
          }}
        />

        <Pressable onPress={onClose}>
          <Text style={styles.backText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Premium’a geç</Text>
      <Text style={styles.subtitle}>Daha derin ve tutarlı rehberlik için planını seç.</Text>

      <View style={styles.planRow}>
        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
          onPress={() => setSelectedPlan('monthly')}>
          <Text style={styles.planName}>Aylık</Text>
          <Text style={styles.planPrice}>₺199 / ay</Text>
        </Pressable>

        <Pressable
          style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}
          onPress={() => setSelectedPlan('yearly')}>
          <Text style={styles.planName}>Yıllık</Text>
          <Text style={styles.planPrice}>₺1.199 / yıl</Text>
          <Text style={styles.badge}>2 ay bedava</Text>
        </Pressable>
      </View>

      <View style={styles.valueBox}>
        {VALUE_PROPS.map(item => (
          <Text key={item} style={styles.valueItem}>
            • {item}
          </Text>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={() => runPurchase('subscribe')}>
        <Text style={styles.primaryButtonText}>Premium’u Başlat</Text>
      </Pressable>

      <Pressable onPress={() => runPurchase('restore')}>
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </Pressable>

      {result !== 'idle' ? (
        <Text
          style={[
            styles.resultText,
            result === 'success' ? styles.successText : result === 'fail' ? styles.failText : styles.cancelText,
          ]}>
          {resultMessage}
        </Text>
      ) : null}

      <View style={styles.resultActions}>
        <Pressable style={styles.resultButton} onPress={() => setResult('fail')}>
          <Text style={styles.resultButtonText}>Fail</Text>
        </Pressable>
        <Pressable style={styles.resultButton} onPress={() => setResult('cancel')}>
          <Text style={styles.resultButtonText}>Cancel</Text>
        </Pressable>
      </View>

      <Pressable onPress={onClose}>
        <Text style={styles.backText}>Geri dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
  },
  planCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 4,
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  planName: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  planPrice: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  badge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  valueBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: colors.card,
  },
  valueItem: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.ctaPrimaryText,
    fontWeight: '800',
  },
  restoreText: {
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  resultText: {
    fontSize: 13,
    lineHeight: 18,
  },
  successText: {
    color: colors.success,
  },
  failText: {
    color: colors.danger,
  },
  cancelText: {
    color: colors.warning,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  resultButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultButtonText: {
    color: colors.ctaSecondaryText,
    fontWeight: '700',
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
