import React, {useMemo, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, Text} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from '../features/analytics/analytics';
import {setOnboardingComplete} from '../features/onboarding/onboardingSlice';
import {
  ReportLifecycleStatus,
  useGetReportCatalogQuery,
  useGetPurchasedReportsQuery,
  usePurchaseReportMutation,
} from '../features/reports/reportsApi';
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

export function App() {
  const dispatch = useDispatch();
  const {colors, preference, setPreference, resolvedMode} = useTheme();
  const onboardingComplete = useSelector((state: RootState) => state.onboarding.completed);

  const [screen, setScreen] = useState<AppScreen>('home');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [localPurchasedReportIds, setLocalPurchasedReportIds] = useState<string[]>([]);
  const [localLifecycleByReportId, setLocalLifecycleByReportId] = useState<
    Record<string, ReportLifecycleStatus>
  >({});

  const {
    data: catalogData,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch: refetchCatalog,
  } = useGetReportCatalogQuery();
  const {
    data: purchasedData,
    isLoading: isPurchasedLoading,
    isError: isPurchasedError,
    refetch: refetchPurchased,
  } = useGetPurchasedReportsQuery();
  const [purchaseReport] = usePurchaseReportMutation();

  const reportsCatalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);
  const purchasedReportIds = useMemo(() => {
    const remotePurchased = (purchasedData?.items ?? []).map(item => item.reportId);
    return Array.from(new Set([...remotePurchased, ...localPurchasedReportIds]));
  }, [localPurchasedReportIds, purchasedData?.items]);

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

  const completePurchase = async () => {
    if (!activeReportId) {
      return;
    }

    try {
      await purchaseReport({reportCatalogId: activeReportId}).unwrap();
      setLocalPurchasedReportIds(current =>
        current.includes(activeReportId) ? current : [...current, activeReportId],
      );
      setLocalLifecycleByReportId(current => ({...current, [activeReportId]: 'queued'}));
      setScreen('my_reports');
      return;
    } catch (error) {
      const status = (error as {status?: number})?.status;
      const reason = status === 401 ? 'auth_401' : status === 403 ? 'auth_403' : status === 408 ? 'timeout' : 'purchase_mutation_failed';

      trackEvent('reports_error', {
        scope: 'checkout',
        report_id: activeReportId,
        reason,
      });
    }
  };

  const openSettings = () => {
    trackEvent('settings_view');
    setScreen('settings');
  };

  const logout = async () => {
    await runLogoutFlow(dispatch);
    dispatch(setPremium(false));
    dispatch(setOnboardingComplete(false));
    setScreen('home');
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
            onOpenPaywall={() => setScreen('paywall')}
            onOpenReportsMarketplace={() => setScreen('reports_marketplace')}
            onOpenMyReports={() => setScreen('my_reports')}
            onOpenSettings={openSettings}
          />
        ) : screen === 'paywall' ? (
          <PaywallScreen onClose={() => setScreen('home')} />
        ) : screen === 'reports_marketplace' ? (
          <ReportsMarketplaceScreen
            reports={reportsCatalog}
            isLoading={isCatalogLoading}
            hasError={isCatalogError}
            onRetry={refetchCatalog}
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
            isLoading={isPurchasedLoading}
            hasError={isPurchasedError}
            onRetry={refetchPurchased}
            onOpenReport={reportId => openReport(reportId, 'report_read')}
            onClose={() => setScreen('home')}
          />
        ) : screen === 'report_read' && activeReport ? (
          <ReportReadScreen
            reportId={activeReport.id}
            fallbackReportTitle={activeReport.title}
            localLifecycleStatus={localLifecycleByReportId[activeReport.id]}
            onLifecycleStatusChange={status =>
              setLocalLifecycleByReportId(current => ({...current, [activeReport.id]: status}))
            }
            onBack={() => setScreen('my_reports')}
          />
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
          <HomeScreen
            onOpenPaywall={() => setScreen('paywall')}
            onOpenReportsMarketplace={() => setScreen('reports_marketplace')}
            onOpenMyReports={() => setScreen('my_reports')}
            onOpenSettings={openSettings}
          />
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
  });
