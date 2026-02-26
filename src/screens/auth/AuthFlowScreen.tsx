import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';
import {ForgotPasswordScreen} from './ForgotPasswordScreen';
import {LoginScreen} from './LoginScreen';
import {RegisterScreen} from './RegisterScreen';

type ScreenKey = 'login' | 'register' | 'forgotPassword';

export function AuthFlowScreen() {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [screen, setScreen] = useState<ScreenKey>('login');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>AstroApp</Text>
      <Text style={styles.description}>Günlük rehberliğine başlamak için hesabınla devam et.</Text>

      <View>
        {screen === 'login' ? (
          <LoginScreen
            onGoForgotPassword={() => setScreen('forgotPassword')}
            onGoRegister={() => setScreen('register')}
          />
        ) : null}

        {screen === 'register' ? <RegisterScreen onGoLogin={() => setScreen('login')} /> : null}

        {screen === 'forgotPassword' ? (
          <ForgotPasswordScreen onGoLogin={() => setScreen('login')} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      padding: 20,
      justifyContent: 'center',
      gap: 12,
    },
    header: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    description: {
      color: colors.textSecondary,
      marginBottom: 8,
    },
  });