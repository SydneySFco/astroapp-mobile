import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {ScreenState} from '../components/ScreenState';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {StateBanner} from '../components/ui/StateBanner';
import {trackEvent} from '../features/analytics/analytics';
import {setPremium} from '../features/subscription/subscriptionSlice';
import {useTheme} from '../theme/ThemeProvider';

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
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

        <Button label="Geri dön" variant="ghost" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Premium’a geç</Text>
      <Text style={styles.subtitle}>Daha derin ve tutarlı rehberlik için planını seç.</Text>

      <View style={styles.planRow}>
        <Card style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}>
          <Text style={styles.planName}>Aylık</Text>
          <Text style={styles.planPrice}>₺199 / ay</Text>
          <Button label="Aylık Seç" variant="ghost" onPress={() => setSelectedPlan('monthly')} />
        </Card>

        <Card style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}>
          <Text style={styles.planName}>Yıllık</Text>
          <Text style={styles.planPrice}>₺1.199 / yıl</Text>
          <Text style={styles.badge}>2 ay bedava</Text>
          <Button label="Yıllık Seç" variant="ghost" onPress={() => setSelectedPlan('yearly')} />
        </Card>
      </View>

      <Card>
        {VALUE_PROPS.map(item => (
          <Text key={item} style={styles.valueItem}>
            • {item}
          </Text>
        ))}
      </Card>

      <Button label="Premium’u Başlat" onPress={() => runPurchase('subscribe')} />
      <Button label="Restore Purchases" variant="ghost" onPress={() => runPurchase('restore')} />

      {result !== 'idle' ? (
        <StateBanner
          tone={result === 'success' ? 'success' : result === 'fail' ? 'error' : 'warning'}
          description={resultMessage}
        />
      ) : null}

      <View style={styles.resultActions}>
        <Button label="Fail" variant="secondary" onPress={() => setResult('fail')} style={styles.resultButton} />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => setResult('cancel')}
          style={styles.resultButton}
        />
      </View>

      <Button label="Geri dön" variant="ghost" onPress={onClose} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
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
    valueItem: {
      color: colors.textSecondary,
      lineHeight: 20,
    },
    resultActions: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
    },
    resultButton: {
      flex: 1,
    },
  });