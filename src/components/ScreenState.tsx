import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme/colors';

type Mode = 'loading' | 'error' | 'empty';

type Props = {
  mode: Mode;
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ScreenState({mode, title, description, retryLabel = 'Tekrar Dene', onRetry}: Props) {
  return (
    <View style={styles.container}>
      {mode === 'loading' ? (
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonLineLg} />
          <View style={styles.skeletonLineMd} />
          <View style={styles.skeletonLineSm} />
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {mode === 'error' && onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#2B355D',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  skeletonWrap: {
    gap: 8,
  },
  skeletonLineLg: {
    height: 14,
    width: '92%',
    borderRadius: 8,
    backgroundColor: '#2B355D',
  },
  skeletonLineMd: {
    height: 14,
    width: '72%',
    borderRadius: 8,
    backgroundColor: '#2B355D',
  },
  skeletonLineSm: {
    height: 14,
    width: '56%',
    borderRadius: 8,
    backgroundColor: '#2B355D',
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  description: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderColor: '#4A63F5',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryText: {
    color: '#9FB0FF',
    fontWeight: '700',
  },
});
