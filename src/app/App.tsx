import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {useSelector} from 'react-redux';

import {HomeScreen} from '../screens/HomeScreen';
import {AuthFlowScreen} from '../screens/auth/AuthFlowScreen';
import {RootState} from '../store/store';
import {colors} from '../theme/colors';

export function App() {
  const onboardingComplete = useSelector((state: RootState) => state.onboarding.completed);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {onboardingComplete ? <HomeScreen /> : <AuthFlowScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
