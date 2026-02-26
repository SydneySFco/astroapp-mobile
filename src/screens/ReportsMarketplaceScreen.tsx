import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Report} from '../features/reports/reportsSlice';
import {colors} from '../theme/colors';

type Props = {
  reports: Report[];
  onSelectReport: (reportId: string) => void;
  onClose: () => void;
};

export function ReportsMarketplaceScreen({reports, onSelectReport, onClose}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rapor Marketi</Text>
      <Text style={styles.subtitle}>Kendin için en uygun raporu seç, ön izle ve satın al.</Text>

      <View style={styles.cardList}>
        {reports.map(report => (
          <Pressable key={report.id} style={styles.card} onPress={() => onSelectReport(report.id)}>
            <Text style={styles.cardTitle}>{report.title}</Text>
            <Text style={styles.cardDescription}>{report.shortDescription}</Text>
            <Text style={styles.price}>₺{report.price}</Text>
          </Pressable>
        ))}
      </View>

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
    borderColor: '#2B355D',
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
    color: '#9FB0FF',
    fontWeight: '700',
    marginTop: 4,
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});
