import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {trackEvent} from '../features/analytics/analytics';
import {Report} from '../features/reports/reportsSlice';
import {colors} from '../theme/colors';

type CheckoutResult = 'idle' | 'success' | 'fail' | 'cancel';
type RequestStatus = 'idle' | 'loading' | 'error';

type Props = {
  report: Report;
  onSuccess: () => void;
  onBack: () => void;
};

const MOCK_TIMEOUT_MS = 1000;

export function ReportCheckoutScreen({report, onSuccess, onBack}: Props) {
  const [result, setResult] = useState<CheckoutResult>('idle');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  const resultText = useMemo(() => {
    switch (result) {
      case 'success':
        return 'Satın alma başarılı. Raporun artık kütüphanende hazır ✨';
      case 'fail':
        return 'Ödeme başarısız oldu. Kart bilgisini kontrol edip tekrar deneyebilirsin.';
      case 'cancel':
        return 'İşlem iptal edildi. Hazır olduğunda tekrar deneyebilirsin.';
      default:
        return 'Durum simülasyonu için bir sonuç seç.';
    }
  }, [result]);

  const runCheckout = (nextResult: Exclude<CheckoutResult, 'idle'>) => {
    if (nextResult !== 'success') {
      setResult(nextResult);
      trackEvent('report_buy', {
        report_id: report.id,
        price: report.price,
        result: nextResult,
      });
      return;
    }

    setStatus('loading');
    setResult('idle');

    setTimeout(() => {
      const shouldTimeout = attempt % 2 === 0;
      setAttempt(current => current + 1);

      if (shouldTimeout) {
        setStatus('error');
        trackEvent('reports_error', {
          scope: 'checkout',
          report_id: report.id,
          reason: 'timeout',
        });
        return;
      }

      setStatus('idle');
      setResult('success');
      trackEvent('report_buy', {
        report_id: report.id,
        price: report.price,
        result: 'success',
      });
      onSuccess();
    }, MOCK_TIMEOUT_MS);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rapor Checkout</Text>
      <Text style={styles.description}>{report.title}</Text>
      <Text style={styles.price}>Ödenecek tutar: ₺{report.price}</Text>

      {status === 'loading' ? (
        <ScreenState
          mode="loading"
          title="Ödeme bağlantısı kuruluyor"
          description="İşlem hazırlanıyor, lütfen bekle."
        />
      ) : status === 'error' ? (
        <ScreenState
          mode="error"
          title="Checkout zaman aşımına uğradı"
          description="Bağlantı zayıf görünüyor. Tekrar deneyerek satın almayı sürdürebilirsin."
          onRetry={() => {
            trackEvent('reports_retry', {scope: 'checkout', report_id: report.id});
            runCheckout('success');
          }}
        />
      ) : (
        <View style={styles.stateButtons}>
          <Pressable style={styles.primaryButton} onPress={() => runCheckout('success')}>
            <Text style={styles.primaryButtonText}>Success</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => runCheckout('fail')}>
            <Text style={styles.secondaryButtonText}>Fail</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => runCheckout('cancel')}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <Text
        style={[
          styles.resultText,
          result === 'success' ? styles.successText : result === 'fail' ? styles.failText : styles.cancelText,
        ]}>
        {resultText}
      </Text>

      {(result === 'fail' || result === 'cancel') && (
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            trackEvent('reports_retry', {scope: 'checkout', report_id: report.id});
            runCheckout('success');
          }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      )}

      <Pressable onPress={onBack}>
        <Text style={styles.backText}>Detaya dön</Text>
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
    fontSize: 26,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
  },
  price: {
    color: '#9FB0FF',
    fontWeight: '700',
    fontSize: 16,
  },
  stateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#4A63F5',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2B355D',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  resultText: {
    lineHeight: 20,
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
  retryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A63F5',
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#9FB0FF',
    fontWeight: '700',
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
