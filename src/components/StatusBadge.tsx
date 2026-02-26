import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme/colors';

type Props = {
  ok: boolean;
};

export function StatusBadge({ok}: Props) {
  return (
    <View style={[styles.badge, ok ? styles.ok : styles.error]}>
      <Text style={styles.label}>{ok ? 'UP' : 'DOWN'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  ok: {
    backgroundColor: colors.success,
  },
  error: {
    backgroundColor: colors.danger,
  },
  label: {
    color: '#fff',
    fontWeight: '700',
  },
});
