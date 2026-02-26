import React from 'react';
import {ImageBackground, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {RootState} from '../store/store';
import {fontFamilies} from '../theme/typography';

type TabKey = 'home' | 'reports' | 'tribes' | 'settings';

type Props = {
  activeTab: TabKey;
  onOpenPaywall: () => void;
  onOpenReportsMarketplace: () => void;
  onOpenMyReports: () => void;
  onOpenSettings: () => void;
  onChangeTab: (tab: TabKey) => void;
};

export function HomeScreen({
  activeTab,
  onOpenPaywall,
  onOpenReportsMarketplace,
  onOpenMyReports,
  onOpenSettings,
  onChangeTab,
}: Props) {
  const dispatch = useDispatch();
  const isPremium = useSelector((state: RootState) => state.subscription.isPremium);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.headerIconButton} onPress={onOpenSettings}>
          <Text style={styles.headerIcon}>≡</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Daily Dashboard</Text>
          <Text style={styles.headerTitle}>Today's Energy</Text>
        </View>

        <View style={styles.headerIconButton}>
          <Text style={styles.headerIcon}>◔</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateTitle}>October 24</Text>
          <Text style={styles.dateSubtitle}>Wednesday, 2023</Text>
        </View>

        <View style={styles.heroCard}>
          <ImageBackground source={require('../assets/images/home-hero-nebula.png')} style={styles.heroImageArea} imageStyle={styles.heroImageStyle}>
            <View style={styles.heroOverlay} />
            <Text style={styles.heroBadge}>HOROSCOPE</Text>
            <Text style={styles.heroTitle}>The Moon Enters Pisces</Text>
          </ImageBackground>

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
              <View style={styles.metricIconWrap}>
                <Text style={styles.metricSymbol}>◔</Text>
              </View>
              <Text style={styles.metricTag}>PHASE</Text>
            </View>
            <Text style={styles.metricTitle}>Waxing Gibbous</Text>
            <Text style={styles.metricValue}>82% Illumination</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <View style={styles.metricIconWrap}>
                <Text style={styles.metricSymbol}>◈</Text>
              </View>
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
      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          {label: 'Home', key: 'home'},
          {label: 'Reports', key: 'reports'},
          {label: 'Tribes', key: 'tribes'},
          {label: 'Settings', key: 'settings'},
        ].map(item => {
          const selected = activeTab === item.key;
          return (
            <Pressable key={item.key} onPress={() => onChangeTab(item.key as TabKey)} style={styles.bottomNavButton}>
              <Text style={selected ? styles.bottomNavActive : styles.bottomNavItem}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fontFamilies.heading,
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
    fontFamily: fontFamilies.display,
    lineHeight: 36,
  },
  dateSubtitle: {
    color: '#9B90B0',
    fontSize: 15,
    marginTop: 4,
    fontFamily: fontFamilies.bodyMedium,
  },
  heroCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#322840',
    backgroundColor: '#231B2E',
  },
  heroImageArea: {
    minHeight: 148,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    justifyContent: 'flex-end',
  },
  heroImageStyle: {
    opacity: 0.95,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31,22,46,0.35)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#8C2BEE',
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fontFamilies.display,
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
    fontFamily: fontFamilies.body,
  },
  heroButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#8C2BEE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fontFamilies.bodyBold,
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
  metricIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(140,43,238,0.2)',
  },
  metricSymbol: {
    color: '#CBA4FF',
    fontSize: 12,
  },
  metricTag: {
    color: '#80718F',
    fontSize: 10,
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1,
  },
  metricTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 20,
    fontFamily: fontFamilies.heading,
  },
  metricValue: {
    color: '#A86BF1',
    fontSize: 12,
    fontFamily: fontFamilies.bodyMedium,
  },
  metricSub: {
    color: '#9A8FAF',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fontFamilies.body,
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
    fontFamily: fontFamilies.bodyBold,
    marginBottom: 2,
  },
  tipBody: {
    color: '#B9A7CD',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fontFamilies.body,
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
    fontFamily: fontFamilies.bodyBold,
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
    fontFamily: fontFamilies.bodyBold,
  },
  premiumInfo: {
    color: '#76E39B',
    fontFamily: fontFamilies.bodyBold,
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
    fontFamily: fontFamilies.bodyMedium,
  },
  bottomNav: {
    borderTopWidth: 1,
    borderTopColor: '#2E253A',
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#191022',
  },
  bottomNavButton: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavActive: {
    color: '#8C2BEE',
    fontSize: 11,
    fontFamily: fontFamilies.bodyBold,
  },
  bottomNavItem: {
    color: '#7F7394',
    fontSize: 11,
    fontFamily: fontFamilies.bodyMedium,
  },
});
