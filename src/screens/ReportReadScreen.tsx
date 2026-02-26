import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ScreenState} from '../components/ScreenState';
import {trackEvent} from '../features/analytics/analytics';
import {
  getNextRealtimeClock,
  isValidLifecycleTransition,
  shouldAcceptRealtimeEvent,
} from '../features/reports/lifecycleGuards';
import {ReportLifecycleStatus, useGetReportDetailQuery} from '../features/reports/reportsApi';
import {isSupabaseConfigured, supabase} from '../services/supabase/client';
import {colors} from '../theme/colors';

type Props = {
  reportId: string;
  fallbackReportTitle: string;
  localLifecycleStatus?: ReportLifecycleStatus;
  onLifecycleStatusChange?: (status: ReportLifecycleStatus) => void;
  onBack: () => void;
};

type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
type RealtimePayload = {
  new?: {
    status?: unknown;
    updated_at?: string | null;
    version?: number | null;
  };
};

const FALLBACK_POLLING_INTERVAL = 15000;
const RETRIABLE_ERROR_CODES = [401, 403, 408] as const;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

export function ReportReadScreen({
  reportId,
  fallbackReportTitle,
  localLifecycleStatus,
  onLifecycleStatusChange,
  onBack,
}: Props) {
  const [retryCount, setRetryCount] = useState(0);
  const readyAtRef = useRef<number | null>(null);
  const lifecycleStartAtRef = useRef<number | null>(null);
  const previousStatusRef = useRef<ReportLifecycleStatus | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldKeepRealtimeRef = useRef(true);
  const realtimeClockRef = useRef<{updatedAt: number | null; version: number | null}>({
    updatedAt: null,
    version: null,
  });

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetReportDetailQuery(reportId, {
    pollingInterval: FALLBACK_POLLING_INTERVAL,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const effectiveStatus: ReportLifecycleStatus =
    data?.lifecycleStatus ?? localLifecycleStatus ?? 'queued';

  useEffect(() => {
    if (!data?.lifecycleStatus || !onLifecycleStatusChange) {
      return;
    }

    const previousStatus = previousStatusRef.current ?? data.lifecycleStatus;

    if (isValidLifecycleTransition(previousStatus, data.lifecycleStatus)) {
      onLifecycleStatusChange(data.lifecycleStatus);
    }
  }, [data?.lifecycleStatus, onLifecycleStatusChange]);

  useEffect(() => {
    if (!data?.lifecycleStatus) {
      return;
    }

    const currentStatus = data.lifecycleStatus;
    const previousStatus = previousStatusRef.current;
    const now = Date.now();

    if (!lifecycleStartAtRef.current) {
      lifecycleStartAtRef.current = now;
    }

    if (previousStatus && previousStatus !== currentStatus) {
      trackEvent('report_lifecycle_transition', {
        report_id: reportId,
        from_status: previousStatus,
        to_status: currentStatus,
      });
    }

    if (currentStatus === 'ready' && !readyAtRef.current && lifecycleStartAtRef.current) {
      readyAtRef.current = now;
      trackEvent('report_lifecycle_ready', {
        report_id: reportId,
        time_to_ready_ms: now - lifecycleStartAtRef.current,
        retry_count: retryCount,
      });
    }

    previousStatusRef.current = currentStatus;
  }, [data?.lifecycleStatus, reportId, retryCount]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    shouldKeepRealtimeRef.current = true;

    const subscribeWithBackoff = () => {
      const channel = supabase
        .channel(`report-read-status:${reportId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_reports',
            filter: `report_catalog_id=eq.${reportId}`,
          },
          payload => {
            const realtimePayload = payload as RealtimePayload;
            const nextStatus = realtimePayload.new?.status;

            if (
              !shouldAcceptRealtimeEvent(realtimeClockRef.current, {
                updatedAt: realtimePayload.new?.updated_at,
                version: realtimePayload.new?.version,
              })
            ) {
              trackEvent('report_realtime_stale_event_ignored', {
                report_id: reportId,
              });
              return;
            }

            realtimeClockRef.current = getNextRealtimeClock(realtimeClockRef.current, {
              updatedAt: realtimePayload.new?.updated_at,
              version: realtimePayload.new?.version,
            });

            if (
              (nextStatus === 'queued' || nextStatus === 'processing' || nextStatus === 'ready') &&
              isValidLifecycleTransition(previousStatusRef.current ?? nextStatus, nextStatus)
            ) {
              onLifecycleStatusChange?.(nextStatus);
            }

            refetch();
          },
        )
        .subscribe(status => {
          const realtimeStatus = status as RealtimeStatus;

          if (realtimeStatus === 'SUBSCRIBED') {
            reconnectAttemptsRef.current = 0;
            trackEvent('report_realtime_subscription', {
              report_id: reportId,
              subscription_status: 'subscribed',
            });
            return;
          }

          if (realtimeStatus === 'CLOSED' || realtimeStatus === 'TIMED_OUT' || realtimeStatus === 'CHANNEL_ERROR') {
            trackEvent('report_realtime_subscription_drop', {
              report_id: reportId,
              subscription_status: realtimeStatus.toLowerCase(),
            });

            supabase.removeChannel(channel);

            if (!shouldKeepRealtimeRef.current) {
              return;
            }

            const attempt = reconnectAttemptsRef.current + 1;
            reconnectAttemptsRef.current = attempt;
            const delay = RECONNECT_BACKOFF_MS[Math.min(attempt - 1, RECONNECT_BACKOFF_MS.length - 1)];

            trackEvent('report_realtime_reconnect_attempt', {
              report_id: reportId,
              reconnect_attempt: attempt,
              reconnect_delay_ms: delay,
            });

            reconnectTimerRef.current = setTimeout(() => {
              if (!shouldKeepRealtimeRef.current) {
                return;
              }

              subscribeWithBackoff();
            }, delay);
          }
        });

      return channel;
    };

    const activeChannel = subscribeWithBackoff();

    return () => {
      shouldKeepRealtimeRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      supabase.removeChannel(activeChannel);
    };
  }, [onLifecycleStatusChange, refetch, reportId]);

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

  const retryLabel = useMemo(() => {
    const status = (error as {status?: number})?.status;

    return RETRIABLE_ERROR_CODES.includes(status as (typeof RETRIABLE_ERROR_CODES)[number])
      ? 'Tekrar dene'
      : 'Yeniden yükle';
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
          retryLabel={retryLabel}
          onRetry={() => {
            setRetryCount(current => current + 1);
            trackEvent('reports_retry', {
              scope: 'report_read',
              report_id: reportId,
              retry_count: retryCount + 1,
            });
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
          description="Kişisel raporun oluşturuluyor. Tamamlandığında ekran otomatik olarak güncellenecek."
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
