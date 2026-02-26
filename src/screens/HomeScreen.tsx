import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {RootState} from '../store/store';

type Props = {
  onOpenPaywall: () => void;
  onOpenReportsMarketplace: () => void;
  onOpenMyReports: () => void;
  onOpenSettings: () => void;
};

export function HomeScreen({
  onOpenPaywall,
  onOpenReportsMarketplace,
  onOpenMyReports,
  onOpenSettings,
}: Props) {
  const dispatch = useDispatch();
  const isPremium = useSelector((state: RootState) => state.subscription.isPremium);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Daily Dashboard</Text>
        <Pressable style={styles.headerButton} onPress={onOpenSettings}>
          <Text style={styles.headerButtonIcon}>☰</Text>
        </Pressable>
      </View>

      <View style={styles.dateBlock}>
        <Text style={styles.dateTitle}>October 24</Text>
        <Text style={styles.dateSubtitle}>Wednesday, 2023</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroBadge}>HOROSCOPE</Text>
        <Text style={styles.heroTitle}>The Moon Enters Pisces</Text>
        <Text style={styles.heroDescription}>
          A wave of intuition washes over you today. Trust your gut feelings in professional matters.
        </Text>

        <Pressable style={styles.heroButton} onPress={onOpenReportsMarketplace}>
          <Text style={styles.heroButtonText}>Read Full Insight →</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricTag}>PHASE</Text>
          <Text style={styles.metricTitle}>Waxing Gibbous</Text>
          <Text style={styles.metricValue}>82% Illumination</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTag}>CRYSTAL</Text>
          <Text style={styles.metricTitle}>Amethyst</Text>
          <Text style={styles.metricSub}>For clarity and peaceful energy today.</Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Daily Tip</Text>
        <Text style={styles.tipBody}>
          Mercury is in retrograde. Double-check your emails before hitting send.
        </Text>
      </View>

      <Pressable style={styles.navButton} onPress={onOpenMyReports}>
        <Text style={styles.navButtonText}>Reports Library</Text>
      </Pressable>

      {!isPremium ? (
        <Pressable style={styles.primaryButton} onPress={onOpenPaywall}>
          <Text style={styles.primaryButtonText}>Unlock Premium</Text>
        </Pressable>
      ) : (
        <Text style={styles.premiumInfo}>Premium active: all premium insights unlocked.</Text>
      )}

      <Pressable
        style={styles.resetButton}
        onPress={() => dispatch(setOnboardingComplete(false))}>
        <Text style={styles.resetButtonText}>Demo için onboarding'e dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191022',
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLabel: {
    color: '#8C2BEE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#231B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonIcon: {
    color: '#B9A3D8',
    fontSize: 14,
  },
  dateBlock: {
    alignItems: 'center',
    marginBottom: 2,
  },
  dateTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  dateSubtitle: {
    color: '#9B90B0',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#322840',
    backgroundColor: '#231B2E',
    padding: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    backgroundColor: '#8C2BEE',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroDescription: {
    color: '#C5BCD3',
    fontSize: 13,
    lineHeight: 20,
  },
  heroButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#8C2BEE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8C2BEE',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#31283F',
    backgroundColor: '#231B2E',
    minHeight: 120,
    padding: 12,
    justifyContent: 'flex-end',
    gap: 4,
  },
  metricTag: {
    color: '#80718F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metricTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
  metricValue: {
    color: '#A86BF1',
    fontSize: 12,
    fontWeight: '600',
  },
  metricSub: {
    color: '#9A8FAF',
    fontSize: 11,
    lineHeight: 16,
  },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#513868',
    backgroundColor: 'rgba(140,43,238,0.12)',
    padding: 14,
    gap: 4,
  },
  tipTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  tipBody: {
    color: '#B9A7CD',
    fontSize: 12,
    lineHeight: 18,
  },
  navButton: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#352A43',
    backgroundColor: '#231B2E',
  },
  navButtonText: {
    color: '#ECE7F5',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8C2BEE',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  premiumInfo: {
    color: '#76E39B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  resetButtonText: {
    color: '#8D7CFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
