import React, {useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {useSelector} from 'react-redux';

import {HomeScreen} from '../screens/HomeScreen';
import {PaywallScreen} from '../screens/PaywallScreen';
import {AuthFlowScreen} from '../screens/auth/AuthFlowScreen';
import {RootState} from '../store/store';
import {colors} from '../theme/colors';

type AppScreen = 'home' | 'paywall';

export function App() {
  const onboardingComplete = useSelector((state: RootState) => state.onboarding.completed);
  const [screen, setScreen] = useState<AppScreen>('home');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {onboardingComplete ? (
        screen === 'home' ? (
          <HomeScreen onOpenPaywall={() => setScreen('paywall')} />
        ) : (
          <PaywallScreen onClose={() => setScreen('home')} />
        )
      ) : (
        <AuthFlowScreen />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
