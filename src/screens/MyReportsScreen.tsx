import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {ReportListItem} from '../features/reports/reportsApi';
import {colors} from '../theme/colors';

type Props = {
  reports: ReportListItem[];
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onOpenReport: (reportId: string) => void;
  onClose: () => void;
};

export function MyReportsScreen({
  reports,
  isLoading = false,
  hasError = false,
  onRetry,
  onOpenReport,
  onClose,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Raporlarım</Text>
      <Text style={styles.subtitle}>Satın aldığın raporlar burada.</Text>

      {isLoading ? (
        <ScreenState
          mode="loading"
          title="Raporların hazırlanıyor"
          description="Satın alınan raporlar yükleniyor, lütfen bekle."
        />
      ) : hasError ? (
        <ScreenState
          mode="error"
          title="Raporların yüklenemedi"
          description="Servis veya bağlantı hatası olabilir. Tekrar deneyebilirsin."
          onRetry={onRetry}
        />
      ) : reports.length === 0 ? (
        <ScreenState
          mode="empty"
          title="Henüz satın alınmış rapor yok"
          description="Bir rapor satın aldığında burada görünecek."
        />
      ) : (
        <View style={styles.list}>
          {reports.map(report => (
            <Pressable key={report.id} style={styles.item} onPress={() => onOpenReport(report.id)}>
              <Text style={styles.itemTitle}>{report.title}</Text>
              <Text style={styles.readCta}>Raporu oku</Text>
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
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
  },
  list: {
    gap: 10,
  },
  item: {
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  readCta: {
    color: '#9FB0FF',
    marginTop: 6,
    fontWeight: '700',
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
