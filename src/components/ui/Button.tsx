import React from 'react';
import {Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dangerSoft';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({label, onPress, variant = 'primary', disabled = false, style, textStyle}: Props) {
  const {colors} = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.base,
        variant === 'primary' && {backgroundColor: pressed ? colors.primaryPressed : colors.primary},
        variant === 'secondary' && {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        variant === 'ghost' && {backgroundColor: 'transparent'},
        variant === 'dangerSoft' && {backgroundColor: colors.stateErrorBg},
        disabled && styles.disabled,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          variant === 'primary' && {color: colors.ctaPrimaryText},
          variant === 'secondary' && {color: colors.ctaSecondaryText},
          variant === 'ghost' && {color: colors.primary},
          variant === 'dangerSoft' && {color: colors.error},
          textStyle,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  label: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});