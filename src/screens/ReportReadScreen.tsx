import React, {useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {
  ReportLifecycleStatus,
  useGetReportDetailQuery,
} from '../features/reports/reportsApi';
import {trackEvent} from '../features/analytics/analytics';
import {colors} from '../theme/colors';

type Props = {
  reportId: string;
  fallbackReportTitle: string;
  localLifecycleStatus?: ReportLifecycleStatus;
  onLifecycleStatusChange?: (status: ReportLifecycleStatus) => void;
  onBack: () => void;
};

export function ReportReadScreen({
  reportId,
  fallbackReportTitle,
  localLifecycleStatus,
  onLifecycleStatusChange,
  onBack,
}: Props) {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetReportDetailQuery(reportId, {
    pollingInterval: 4000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const effectiveStatus: ReportLifecycleStatus =
    data?.lifecycleStatus ?? localLifecycleStatus ?? 'queued';

  useEffect(() => {
    if (!data?.lifecycleStatus || !onLifecycleStatusChange) {
      return;
    }

    onLifecycleStatusChange(data.lifecycleStatus);
  }, [data?.lifecycleStatus, onLifecycleStatusChange]);

  const errorState = useMemo(() => {
    const status = (error as {status?: number})?.status;

    if (status === 401) {
      return {
        title: 'Oturum doğrulaması gerekli',
        description: 'Raporu okumak için tekrar giriş yapman gerekebilir. Lütfen yeniden deneyin.',
      };
    }

    if (status === 403) {
      return {
        title: 'Bu rapora erişim izni yok',
        description:
          'Satın alma henüz tamamlanmamış veya erişim yetkin bulunmuyor. Birkaç dakika sonra tekrar dene.',
      };
    }

    if (status === 408) {
      return {
        title: 'Bağlantı zaman aşımına uğradı',
        description: 'Sunucu yanıtı gecikti. İnternet bağlantını kontrol edip tekrar deneyebilirsin.',
      };
    }

    return {
      title: 'Rapor yüklenemedi',
      description: 'Geçici bir sorun oluştu. Birazdan tekrar dene.',
    };
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data?.title ?? fallbackReportTitle}</Text>

      {isLoading || (isFetching && !data) ? (
        <ScreenState
          mode="loading"
          title="Rapor hazırlanıyor"
          description="Detaylar yüklenirken lütfen bekle."
        />
      ) : isError ? (
        <ScreenState
          mode="error"
          title={errorState.title}
          description={errorState.description}
          onRetry={() => {
            trackEvent('reports_retry', {scope: 'report_read', report_id: reportId});
            refetch();
          }}
        />
      ) : effectiveStatus === 'queued' ? (
        <ScreenState
          mode="loading"
          title="Rapor sıraya alındı"
          description="Satın alma sonrası raporun kuyruğa eklendi. Hazırlanmaya başlayınca otomatik güncellenecek."
        />
      ) : effectiveStatus === 'processing' ? (
        <ScreenState
          mode="loading"
          title="Rapor işleniyor"
          description="Kişisel raporun oluşturuluyor. Birkaç dakika içinde okunabilir olacak."
        />
      ) : (
        <Text style={styles.content}>{data?.fullContent ?? 'Rapor içeriği bulunamadı.'}</Text>
      )}

      <Pressable onPress={onBack}>
        <Text style={styles.backText}>Raporlarıma dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  content: {
    color: colors.textSecondary,
    lineHeight: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#2B355D',
    borderRadius: 12,
    padding: 12,
  },
  backText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});