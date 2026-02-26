import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Report} from '../features/reports/reportsSlice';
import {colors} from '../theme/colors';

type Props = {
  reports: Report[];
  onOpenReport: (reportId: string) => void;
  onClose: () => void;
};

export function MyReportsScreen({reports, onOpenReport, onClose}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Raporlarım</Text>
      <Text style={styles.subtitle}>Satın aldığın raporlar burada.</Text>

      {reports.length === 0 ? (
        <Text style={styles.emptyText}>Henüz satın alınmış rapor yok.</Text>
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
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 20,
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
