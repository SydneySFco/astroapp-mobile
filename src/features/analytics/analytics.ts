type AnalyticsEventName =
  | 'signup_start'
  | 'signup_complete'
  | 'onboarding_step_view'
  | 'onboarding_complete'
  | 'paywall_view'
  | 'subscribe_success'
  | 'report_view'
  | 'report_buy'
  | 'settings_view'
  | 'logout_click'
  | 'delete_request_click'
  | 'legal_open'
  | 'auth_error'
  | 'auth_retry'
  | 'paywall_error'
  | 'paywall_retry'
  | 'reports_error'
  | 'reports_retry'
  | 'settings_error'
  | 'settings_retry'
  | 'report_lifecycle_transition'
  | 'report_lifecycle_ready'
  | 'report_realtime_subscription'
  | 'report_realtime_subscription_drop'
  | 'report_realtime_reconnect_attempt'
  | 'report_realtime_stale_event_ignored';

type AnalyticsPayload = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, payload?: AnalyticsPayload) {
  // TODO: analytics provider entegrasyonu (Firebase/Segment vb.)
  // Şimdilik iskelet dispatch: geliştirme ortamında loglanır.
  console.log('[analytics]', name, payload ?? {});
}
