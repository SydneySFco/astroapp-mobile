import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {trackEvent} from '../features/analytics/analytics';
import {Report} from '../features/reports/reportsSlice';
import {colors} from '../theme/colors';

type Props = {
  report: Report;
  onBuy: () => void;
  onBack: () => void;
};

export function ReportDetailScreen({report, onBuy, onBack}: Props) {
  useEffect(() => {
    trackEvent('report_view', {report_id: report.id, price: report.price});
  }, [report.id, report.price]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.subtitle}>Ön izleme</Text>
      <Text style={styles.preview}>{report.preview}</Text>

      <View style={styles.footerCard}>
        <Text style={styles.price}>Fiyat: ₺{report.price}</Text>
        <Pressable style={styles.buyButton} onPress={onBuy}>
          <Text style={styles.buyButtonText}>Satın Al</Text>
        </Pressable>
      </View>

      <Pressable onPress={onBack}>
        <Text style={styles.backText}>Rapor listesine dön</Text>
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
  subtitle: {
    color: '#9FB0FF',
    fontWeight: '700',
  },
  preview: {
    color: colors.textSecondary,
    lineHeight: 22,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B355D',
    padding: 12,
  },
  footerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B355D',
    padding: 12,
    gap: 10,
  },
  price: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  buyButton: {
    backgroundColor: '#4A63F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
