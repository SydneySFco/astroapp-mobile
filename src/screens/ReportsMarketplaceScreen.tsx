import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {trackEvent} from '../features/analytics/analytics';
import {ReportListItem} from '../features/reports/reportsApi';
import {colors} from '../theme/colors';

type Props = {
  reports: ReportListItem[];
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onSelectReport: (reportId: string) => void;
  onClose: () => void;
};

export function ReportsMarketplaceScreen({
  reports,
  isLoading = false,
  hasError = false,
  onRetry,
  onSelectReport,
  onClose,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rapor Marketi</Text>
      <Text style={styles.subtitle}>Kendin için en uygun raporu seç, ön izle ve satın al.</Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Raporlar yükleniyor"
          description="Market verisi getiriliyor, lütfen bekle."
        />
      ) : hasError ? (
        <ScreenState
          mode="error"
          title="Raporlar alınamadı"
          description="Bağlantı veya servis sorunu olabilir. Tekrar deneyebilirsin."
          onRetry={onRetry}
        />
      ) : reports.length === 0 ? (
        <ScreenState
          mode="empty"
          title="Henüz rapor bulunmuyor"
          description="Market kısa süreliğine boş görünüyor. Birazdan tekrar kontrol edebilirsin."
        />
      ) : (
        <View style={styles.cardList}>
          {reports.map(report => (
            <Pressable
              key={report.id}
              style={styles.card}
              onPress={() => {
                trackEvent('report_view', {report_id: report.id, source: 'marketplace'});
                onSelectReport(report.id);
              }}>
              <Text style={styles.cardTitle}>{report.title}</Text>
              <Text style={styles.cardDescription}>{report.shortDescription}</Text>
              <Text style={styles.price}>{`${report.currency} ${report.price}`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={onClose}>
        <Text style={styles.backText}>Ana sayfaya dön</Text>
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
  subtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardList: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 17,
  },
  cardDescription: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  price: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: 4,
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});
