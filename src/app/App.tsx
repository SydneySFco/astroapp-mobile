import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';

import {HealthScreen} from '../screens/HealthScreen';
import {colors} from '../theme/colors';

export function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <HealthScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
