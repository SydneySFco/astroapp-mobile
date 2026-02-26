import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
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
        <Pressable style={styles.headerIconButton} onPress={onOpenSettings}>
          <Text style={styles.headerIcon}>☰</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Daily Dashboard</Text>
          <Text style={styles.headerTitle}>Today's Energy</Text>
        </View>

        <View style={styles.headerIconButton}>
          <Text style={styles.headerIcon}>◷</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateTitle}>October 24</Text>
          <Text style={styles.dateSubtitle}>Wednesday, 2023</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroImageArea}>
            <View style={styles.heroImageGlow} />
            <Text style={styles.heroBadge}>HOROSCOPE</Text>
            <Text style={styles.heroTitle}>The Moon Enters Pisces</Text>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroDescription}>
              A wave of intuition washes over you today. Trust your gut feelings in professional matters,
              as logical analysis might miss subtle cues.
            </Text>

            <Pressable style={styles.heroButton} onPress={onOpenReportsMarketplace}>
              <Text style={styles.heroButtonText}>Read Full Insight</Text>
              <Text style={styles.heroButtonArrow}>→</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricSymbol}>◔</Text>
              <Text style={styles.metricTag}>PHASE</Text>
            </View>
            <Text style={styles.metricTitle}>Waxing Gibbous</Text>
            <Text style={styles.metricValue}>82% Illumination</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricSymbol}>◈</Text>
              <Text style={styles.metricTag}>CRYSTAL</Text>
            </View>
            <Text style={styles.metricTitle}>Amethyst</Text>
            <Text style={styles.metricSub}>For clarity and peaceful energy today.</Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Text style={styles.tipIcon}>✦</Text>
          </View>
          <View style={styles.tipTextWrap}>
            <Text style={styles.tipTitle}>Daily Tip</Text>
            <Text style={styles.tipBody}>
              Mercury is in retrograde. Double-check your emails before hitting send to avoid
              misunderstandings.
            </Text>
          </View>
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

        <View style={styles.bottomNav}>
          <Text style={styles.bottomNavActive}>Home</Text>
          <Text style={styles.bottomNavItem}>Reports</Text>
          <Text style={styles.bottomNavItem}>Tribes</Text>
          <Text style={styles.bottomNavItem}>Settings</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191022',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2234',
    backgroundColor: 'rgba(25,16,34,0.98)',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 1,
  },
  headerLabel: {
    color: '#8C2BEE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#231B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    color: '#B8A4D6',
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 14,
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
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#322840',
    backgroundColor: '#231B2E',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  heroImageArea: {
    minHeight: 148,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    justifyContent: 'flex-end',
    backgroundColor: '#312449',
  },
  heroImageGlow: {
    position: 'absolute',
    top: -10,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(140,43,238,0.24)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#8C2BEE',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  heroBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  heroDescription: {
    color: '#C8BED7',
    fontSize: 13,
    lineHeight: 20,
  },
  heroButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#8C2BEE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  heroButtonArrow: {
    color: '#FFFFFF',
    fontSize: 17,
    marginTop: -1,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#31283F',
    backgroundColor: '#231B2E',
    minHeight: 128,
    padding: 12,
    justifyContent: 'flex-end',
    gap: 4,
  },
  metricTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricSymbol: {
    color: '#8C2BEE',
    fontSize: 15,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(140,43,238,0.24)',
    backgroundColor: 'rgba(140,43,238,0.10)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(140,43,238,0.24)',
    marginTop: 2,
  },
  tipIcon: {
    color: '#B47AF7',
    fontSize: 14,
  },
  tipTextWrap: {
    flex: 1,
  },
  tipTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
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
  bottomNav: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#2E253A',
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bottomNavActive: {
    color: '#8C2BEE',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomNavItem: {
    color: '#7F7394',
    fontSize: 11,
    fontWeight: '600',
  },
});