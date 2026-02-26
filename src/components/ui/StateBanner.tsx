import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';

type StateTone = 'success' | 'warning' | 'error' | 'info';

type Props = {
  tone: StateTone;
  title?: string;
  description: string;
};

export function StateBanner({tone, title, description}: Props) {
  const {colors} = useTheme();

  const palette = {
    success: {bg: colors.stateSuccessBg, text: colors.success},
    warning: {bg: colors.stateWarningBg, text: colors.warning},
    error: {bg: colors.stateErrorBg, text: colors.error},
    info: {bg: colors.stateInfoBg, text: colors.accent},
  }[tone];

  return (
    <View style={[styles.container, {backgroundColor: palette.bg}]}> 
      {title ? <Text style={[styles.title, {color: palette.text}]}>{title}</Text> : null}
      <Text style={[styles.description, {color: palette.text}]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  title: {
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});