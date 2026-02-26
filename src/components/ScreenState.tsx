import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useTheme} from '../theme/ThemeProvider';
import {Button} from './ui/Button';
import {Card} from './ui/Card';

type Mode = 'loading' | 'error' | 'empty';

type Props = {
  mode: Mode;
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ScreenState({mode, title, description, retryLabel = 'Tekrar Dene', onRetry}: Props) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card style={styles.container}>
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
        <Button label={retryLabel} variant="secondary" onPress={onRetry} style={styles.retryButton} />
      ) : null}
    </Card>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    skeletonWrap: {
      gap: 8,
    },
    skeletonLineLg: {
      height: 14,
      width: '92%',
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    skeletonLineMd: {
      height: 14,
      width: '72%',
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    skeletonLineSm: {
      height: 14,
      width: '56%',
      borderRadius: 8,
      backgroundColor: colors.border,
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
    },
  });