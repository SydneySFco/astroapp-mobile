import React, {useMemo, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';

import {HomeScreen} from '../screens/HomeScreen';
import {PaywallScreen} from '../screens/PaywallScreen';
import {AuthFlowScreen} from '../screens/auth/AuthFlowScreen';
import {RootState} from '../store/store';
import {colors} from '../theme/colors';
import {ReportsMarketplaceScreen} from '../screens/ReportsMarketplaceScreen';
import {ReportDetailScreen} from '../screens/ReportDetailScreen';
import {ReportCheckoutScreen} from '../screens/ReportCheckoutScreen';
import {MyReportsScreen} from '../screens/MyReportsScreen';
import {ReportReadScreen} from '../screens/ReportReadScreen';
import {markReportPurchased} from '../features/reports/reportsSlice';

type AppScreen =
  | 'home'
  | 'paywall'
  | 'reports_marketplace'
  | 'report_detail'
  | 'report_checkout'
  | 'my_reports'
  | 'report_read';

export function App() {
  const dispatch = useDispatch();
  const onboardingComplete = useSelector((state: RootState) => state.onboarding.completed);
  const reportsCatalog = useSelector((state: RootState) => state.reports.catalog);
  const purchasedReportIds = useSelector((state: RootState) => state.reports.purchasedReportIds);

  const [screen, setScreen] = useState<AppScreen>('home');
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
    setScreen('my_reports');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {onboardingComplete ? (
        screen === 'home' ? (
          <HomeScreen
            onOpenPaywall={() => setScreen('paywall')}
            onOpenReportsMarketplace={() => setScreen('reports_marketplace')}
            onOpenMyReports={() => setScreen('my_reports')}
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
        ) : (
          <HomeScreen
            onOpenPaywall={() => setScreen('paywall')}
            onOpenReportsMarketplace={() => setScreen('reports_marketplace')}
            onOpenMyReports={() => setScreen('my_reports')}
          />
        )
      ) : (
        <AuthFlowScreen />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
