import React from 'react';
import {StyleSheet, TextInput, TextInputProps} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';

type Props = TextInputProps;

export function Input(props: Props) {
  const {colors} = useTheme();

  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textSecondary}
      style={[
        styles.input,
        {
          borderColor: colors.border,
          color: colors.textPrimary,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});