import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {trackEvent} from '../features/analytics/analytics';
import {setPremium} from '../features/subscription/subscriptionSlice';
import {colors} from '../theme/colors';

type Props = {
  onClose: () => void;
};

type PlanType = 'monthly' | 'yearly';
type PurchaseResult = 'idle' | 'success' | 'fail' | 'cancel';

const VALUE_PROPS = [
  'Her gün kişisel rehberlik ve mikro aksiyon',
  'Haftalık odak özeti ve sürdürülebilir rutin önerileri',
  'Reklamsız deneyim + premium içeriklere tam erişim',
];

export function PaywallScreen({onClose}: Props) {
  const dispatch = useDispatch();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  const [result, setResult] = useState<PurchaseResult>('idle');

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

  const onSubscribe = () => {
    setResult('success');
    dispatch(setPremium(true));
    trackEvent('subscribe_success', {plan: selectedPlan});
  };

  const onRestorePurchases = () => {
    setResult('success');
    dispatch(setPremium(true));
    trackEvent('subscribe_success', {plan: 'restore'});
  };

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

      <Pressable style={styles.primaryButton} onPress={onSubscribe}>
        <Text style={styles.primaryButtonText}>Premium’u Başlat</Text>
      </Pressable>

      <Pressable onPress={onRestorePurchases}>
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
    borderColor: '#2B355D',
    backgroundColor: colors.card,
    padding: 12,
    gap: 4,
  },
  planCardActive: {
    borderColor: '#4A63F5',
    backgroundColor: '#1D2750',
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
    color: '#9FB0FF',
    fontSize: 12,
    fontWeight: '700',
  },
  valueBox: {
    borderWidth: 1,
    borderColor: '#2B355D',
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
    backgroundColor: '#4A63F5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  restoreText: {
    color: '#8EA2FF',
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
    color: '#E5CC7B',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  resultButton: {
    backgroundColor: '#2B355D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
