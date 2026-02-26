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
  | 'settings_retry';

type AnalyticsPayload = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, payload?: AnalyticsPayload) {
  // TODO: analytics provider entegrasyonu (Firebase/Segment vb.)
  // Şimdilik iskelet dispatch: geliştirme ortamında loglanır.
  console.log('[analytics]', name, payload ?? {});
}
