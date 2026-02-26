import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {RootState} from '../store/store';
import {colors} from '../theme/colors';

type Props = {
  onOpenPaywall: () => void;
  onOpenReportsMarketplace: () => void;
  onOpenMyReports: () => void;
};

export function HomeScreen({onOpenPaywall, onOpenReportsMarketplace, onOpenMyReports}: Props) {
  const dispatch = useDispatch();
  const isPremium = useSelector((state: RootState) => state.subscription.isPremium);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isPremium ? 'Premium Ana Sayfa' : 'Ana Sayfa'}</Text>
      <Text style={styles.description}>
        Günlük rehberliğine hoş geldin. Bugünkü küçük adımın seni bekliyor ✨
      </Text>

      {!isPremium ? (
        <Pressable style={styles.primaryButton} onPress={onOpenPaywall}>
          <Text style={styles.primaryButtonText}>Premium’u Aç</Text>
        </Pressable>
      ) : (
        <Text style={styles.premiumInfo}>Premium aktif: tüm premium içerikler açıldı.</Text>
      )}

      <Pressable style={styles.secondaryButton} onPress={onOpenReportsMarketplace}>
        <Text style={styles.secondaryButtonText}>Rapor Markete Git</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onOpenMyReports}>
        <Text style={styles.secondaryButtonText}>Raporlarım</Text>
      </Pressable>

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
  premiumInfo: {
    color: colors.success,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#4A63F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  secondaryButton: {
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
