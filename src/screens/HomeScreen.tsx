import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch} from 'react-redux';

import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {colors} from '../theme/colors';

export function HomeScreen() {
  const dispatch = useDispatch();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ana Sayfa</Text>
      <Text style={styles.description}>
        Günlük rehberliğine hoş geldin. Bugünkü küçük adımın seni bekliyor ✨
      </Text>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => dispatch(setOnboardingComplete(false))}>
        <Text style={styles.secondaryButtonText}>Demo için onboarding'e dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#2B355D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
