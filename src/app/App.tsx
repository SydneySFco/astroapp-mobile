import React, {useMemo, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from '../features/analytics/analytics';
import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {markReportPurchased} from '../features/reports/reportsSlice';
import {setPremium} from '../features/subscription/subscriptionSlice';
import {runLogoutFlow} from '../features/auth/logoutFlow';
import {AuthFlowScreen} from '../screens/auth/AuthFlowScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LegalScreen} from '../screens/LegalScreen';
import {MyReportsScreen} from '../screens/MyReportsScreen';
import {PaywallScreen} from '../screens/PaywallScreen';
import {ReportCheckoutScreen} from '../screens/ReportCheckoutScreen';
import {ReportDetailScreen} from '../screens/ReportDetailScreen';
import {ReportReadScreen} from '../screens/ReportReadScreen';
import {ReportsMarketplaceScreen} from '../screens/ReportsMarketplaceScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {RootState} from '../store/store';
import {appBuildLabel} from '../config/appConfig';
import {useTheme} from '../theme/ThemeProvider';

type AppScreen =
  | 'home'
  | 'paywall'
  | 'reports_marketplace'
  | 'report_detail'
  | 'report_checkout'
  | 'my_reports'
  | 'report_read'
  | 'settings'
  | 'legal';

type MainTab = 'home' | 'reports' | 'tribes' | 'settings';

export function App() {
  const dispatch = useDispatch();
  const {colors, preference, setPreference, resolvedMode} = useTheme();
  const onboardingComplete = useSelector((state: RootState) => state.onboarding.completed);
  const reportsCatalog = useSelector((state: RootState) => state.reports.catalog);
  const purchasedReportIds = useSelector((state: RootState) => state.reports.purchasedReportIds);

  const [screen, setScreen] = useState<AppScreen>('home');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const activeReport = useMemo(
    () => reportsCatalog.find(item => item.id === activeReportId) ?? null,
    [activeReportId, reportsCatalog],
  );

  const purchasedReports = useMemo(
    () => reportsCatalog.filter(item => purchasedReportIds.includes(item.id)),
    [purchasedReportIds, reportsCatalog],
  );

  const openReport = (reportId: string, nextScreen: AppScreen) => {
    setActiveReportId(reportId);
    setScreen(nextScreen);
  };

  const completePurchase = () => {
    if (!activeReportId) {
      return;
    }

    dispatch(markReportPurchased(activeReportId));
    setActiveTab('reports');
    setScreen('my_reports');
  };

  const openSettings = () => {
    trackEvent('settings_view');
    setActiveTab('settings');
    setScreen('settings');
  };

  const onChangeTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setScreen('home');
      return;
    }

    if (tab === 'reports') {
      setScreen('my_reports');
      return;
    }

    if (tab === 'settings') {
      openSettings();
      return;
    }

    setScreen('home');
  };

  const logout = async () => {
    await runLogoutFlow(dispatch);
    dispatch(setPremium(false));
    dispatch(setOnboardingComplete(false));
    setScreen('home');
    setActiveTab('home');
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={resolvedMode === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      {onboardingComplete ? (
        screen === 'home' ? (
          <HomeScreen
            activeTab={activeTab}
            onChangeTab={onChangeTab}
            onOpenPaywall={() => setScreen('paywall')}
            onOpenReportsMarketplace={() => setScreen('reports_marketplace')}
            onOpenMyReports={() => {
              setActiveTab('reports');
              setScreen('my_reports');
            }}
            onOpenSettings={openSettings}
          />
        ) : screen === 'paywall' ? (
          <PaywallScreen onClose={() => setScreen('home')} />
        ) : screen === 'reports_marketplace' ? (
          <ReportsMarketplaceScreen
            reports={reportsCatalog}
            onSelectReport={reportId => openReport(reportId, 'report_detail')}
            onClose={() => setScreen('home')}
          />
        ) : screen === 'report_detail' && activeReport ? (
          <ReportDetailScreen
            report={activeReport}
            onBuy={() => setScreen('report_checkout')}
            onBack={() => setScreen('reports_marketplace')}
          />
        ) : screen === 'report_checkout' && activeReport ? (
          <ReportCheckoutScreen
            report={activeReport}
            onSuccess={completePurchase}
            onBack={() => setScreen('report_detail')}
          />
        ) : screen === 'my_reports' ? (
          <MyReportsScreen
            reports={purchasedReports}
            onOpenReport={reportId => openReport(reportId, 'report_read')}
            onClose={() => setScreen('home')}
          />
        ) : screen === 'report_read' && activeReport ? (
          <ReportReadScreen report={activeReport} onBack={() => setScreen('my_reports')} />
        ) : screen === 'settings' ? (
          <SettingsScreen
            onOpenLegal={() => setScreen('legal')}
            onLogout={logout}
            themePreference={preference}
            onChangeThemePreference={setPreference}
          />
        ) : screen === 'legal' ? (
          <LegalScreen onBack={() => setScreen('settings')} />
        ) : (
          <View style={styles.centerFallback}>
            <Text style={styles.fallbackText}>Coming soon</Text>
          </View>
        )
      ) : (
        <AuthFlowScreen />
      )}
      <Text style={styles.buildLabel}>{`build ${appBuildLabel}`}</Text>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    buildLabel: {
      textAlign: 'center',
      fontSize: 11,
      color: colors.textSecondary,
      paddingBottom: 8,
    },
    centerFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallbackText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
  });
