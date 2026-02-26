type AnalyticsEventName = 'signup_start' | 'signup_complete';

type AnalyticsPayload = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, payload?: AnalyticsPayload) {
  // TODO: analytics provider entegrasyonu (Firebase/Segment vb.)
  // Şimdilik iskelet dispatch: geliştirme ortamında loglanır.
  console.log('[analytics]', name, payload ?? {});
}
