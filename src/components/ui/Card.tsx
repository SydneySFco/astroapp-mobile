import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Card({children, style}: Props) {
  const {colors} = useTheme();

  return <View style={[styles.base, {backgroundColor: colors.card, borderColor: colors.border}, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
});