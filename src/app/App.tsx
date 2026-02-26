import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';

import {AuthFlowScreen} from '../screens/auth/AuthFlowScreen';
import {colors} from '../theme/colors';

export function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <AuthFlowScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
