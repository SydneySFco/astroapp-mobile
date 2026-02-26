import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useTheme} from '../../theme/ThemeProvider';
import {ForgotPasswordScreen} from './ForgotPasswordScreen';
import {LoginScreen} from './LoginScreen';
import {RegisterScreen} from './RegisterScreen';

type ScreenKey = 'welcome' | 'login' | 'register' | 'forgotPassword';

export function AuthFlowScreen() {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [screen, setScreen] = useState<ScreenKey>('welcome');

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {screen === 'welcome' ? (
        <View style={styles.welcomeContent}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconWrap}>
              <Text style={styles.brandIcon}>✦</Text>
            </View>
            <Text style={styles.brandName}>Cosmos</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Your Path,{"\n"}Written in the Stars</Text>
            <Text style={styles.heroDescription}>
              Discover daily guidance and deep analysis for a balanced, harmonious life.
            </Text>
          </View>

          <View style={styles.welcomeActions}>
            <Pressable style={styles.getStartedButton} onPress={() => setScreen('login')}>
              <Text style={styles.getStartedText}>Get Started  →</Text>
            </Pressable>

            <Pressable onPress={() => setScreen('login')}>
              <Text style={styles.loginLink}>Already have an account? Log in</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.authContent}>
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
      )}
    </View>
  );
}

const createStyles = (_colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#060B2A',
      paddingHorizontal: 24,
      paddingVertical: 20,
      position: 'relative',
      overflow: 'hidden',
    },
    glowTop: {
      position: 'absolute',
      top: -120,
      left: -90,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(122,122,255,0.20)',
    },
    glowBottom: {
      position: 'absolute',
      bottom: -140,
      right: -80,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(122,122,255,0.14)',
    },
    welcomeContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: 24,
      paddingBottom: 12,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(122,122,255,0.20)',
    },
    brandIcon: {
      color: '#8D7CFF',
      fontSize: 20,
      marginTop: -1,
    },
    brandName: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 21,
      letterSpacing: 0.2,
    },
    hero: {
      marginTop: 24,
      gap: 16,
    },
    heroTitle: {
      fontSize: 42,
      lineHeight: 46,
      color: '#F4F6FF',
      fontWeight: '800',
      letterSpacing: -0.7,
    },
    heroDescription: {
      fontSize: 16,
      lineHeight: 24,
      color: '#9AA4C6',
      maxWidth: 320,
    },
    welcomeActions: {
      gap: 16,
    },
    getStartedButton: {
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#7A7AFF',
      shadowColor: '#7A7AFF',
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 8,
    },
    getStartedText: {
      color: '#F7F9FF',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    loginLink: {
      textAlign: 'center',
      color: '#8F99BA',
      fontSize: 13,
    },
    authContent: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 10,
      paddingBottom: 18,
    },
  });
