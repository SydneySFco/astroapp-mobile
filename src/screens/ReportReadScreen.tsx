import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ReportListItem} from '../features/reports/reportsApi';
import {colors} from '../theme/colors';

type Props = {
  report: ReportListItem;
  onBack: () => void;
};

export function ReportReadScreen({report, onBack}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.content}>{report.preview}</Text>

      <Pressable onPress={onBack}>
        <Text style={styles.backText}>Raporlarıma dön</Text>
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
  content: {
    color: colors.textSecondary,
    lineHeight: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 12,
    padding: 12,
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
