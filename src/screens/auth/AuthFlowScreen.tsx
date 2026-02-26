import React, {useMemo, useState} from 'react';
import {ImageBackground, Pressable, StyleSheet, Text, View} from 'react-native';

import {fontFamilies} from '../../theme/typography';
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
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <View style={styles.brandIconWrap}>
                <Text style={styles.brandIcon}>✦</Text>
              </View>
              <Text style={styles.brandName}>Cosmos</Text>
            </View>

            <Pressable style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          </View>

          <ImageBackground source={require('../../assets/images/welcome-hero-bg.png')} style={styles.heroVisual} imageStyle={styles.heroImageStyle}>
            <View style={styles.heroInnerGlow} />
            <View style={styles.heroOverlay} />
          </ImageBackground>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Your Path,{"\n"}Written in the Stars</Text>
            <Text style={styles.heroDescription}>
              Discover daily guidance and deep analysis for a balanced, harmonious life.
            </Text>
          </View>

          <View style={styles.welcomeActions}>
            <Pressable style={styles.getStartedButton} onPress={() => setScreen('login')}>
              <Text style={styles.getStartedText}>Get Started</Text>
              <Text style={styles.getStartedArrow}>→</Text>
            </Pressable>

            <Pressable onPress={() => setScreen('login')}>
              <Text style={styles.loginLink}>
                Already have an account? <Text style={styles.loginLinkStrong}>Log in</Text>
              </Text>
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
      backgroundColor: '#0F0F23',
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 12,
      position: 'relative',
      overflow: 'hidden',
    },
    glowTop: {
      position: 'absolute',
      top: -130,
      left: -96,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: 'rgba(122,122,255,0.18)',
    },
    glowBottom: {
      position: 'absolute',
      bottom: -150,
      right: -80,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: 'rgba(122,122,255,0.12)',
    },
    welcomeContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: 8,
      paddingBottom: 8,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 6,
      paddingBottom: 6,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
      fontSize: 18,
      marginTop: -1,
    },
    brandName: {
      color: '#FFFFFF',
      fontFamily: fontFamilies.heading,
      fontSize: 22,
      letterSpacing: -0.2,
    },
    settingsButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    settingsIcon: {
      color: '#B4B9D3',
      fontSize: 16,
    },
    heroVisual: {
      width: '100%',
      aspectRatio: 1,
      maxHeight: 340,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
      marginTop: 4,
      marginBottom: 10,
    },
    heroImageStyle: {
      opacity: 0.95,
    },
    heroInnerGlow: {
      position: 'absolute',
      top: 26,
      left: 24,
      right: 24,
      bottom: 32,
      borderRadius: 999,
      backgroundColor: 'rgba(122,122,255,0.22)',
    },
    heroOverlay: {
      flex: 1,
      backgroundColor: 'rgba(8,10,28,0.42)',
    },
    heroTextBlock: {
      alignItems: 'center',
      gap: 14,
      marginTop: 2,
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    heroTitle: {
      fontSize: 44,
      lineHeight: 48,
      textAlign: 'center',
      color: '#F8F9FF',
      fontFamily: fontFamilies.display,
      letterSpacing: -0.8,
    },
    heroDescription: {
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      color: '#9CA3BF',
      maxWidth: 320,
      fontFamily: fontFamilies.body,
    },
    welcomeActions: {
      gap: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    getStartedButton: {
      height: 56,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#7A7AFF',
      shadowColor: '#7A7AFF',
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.34,
      shadowRadius: 20,
      elevation: 8,
    },
    getStartedText: {
      color: '#F7F9FF',
      fontSize: 18,
      fontFamily: fontFamilies.bodyBold,
      letterSpacing: 0.2,
    },
    getStartedArrow: {
      color: '#FFFFFF',
      fontSize: 20,
      marginTop: -1,
    },
    loginLink: {
      textAlign: 'center',
      color: '#6D738C',
      fontSize: 12,
      fontFamily: fontFamilies.bodyMedium,
    },
    loginLinkStrong: {
      color: '#7A7AFF',
      fontFamily: fontFamilies.bodyBold,
    },
    authContent: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 10,
      paddingBottom: 18,
    },
  });
