# RLOOP-019 Notes — Server-side Lifecycle Authority + Realtime Reliability Hardening

## Scope Summary
- Lifecycle transition guard matrisi dokümante edildi ve backend blocker kurallarına hazır hale getirildi.
- Client tarafına defensive transition validation helper eklendi.
- Realtime subscription için reconnect + exponential backoff stratejisi uygulandı.
- Out-of-order update koruması için `updated_at` / `version` freshness guard eklendi.
- Realtime reliability telemetry event seti genişletildi.

## Technical Changes

### 1) Server-side authority prep + transition guard helper
- Yeni dosya: `src/features/reports/lifecycleGuards.ts`
  - `lifecycleTransitionMatrix`
  - `isValidLifecycleTransition(from, to)`
  - `shouldAcceptRealtimeEvent(lastClock, incomingMeta)`
  - `getNextRealtimeClock(previousClock, incomingMeta)`

### 2) Realtime reliability hardening
- Güncellendi: `src/screens/ReportReadScreen.tsx`
  - Subscription drop durumlarında yeniden bağlanma eklendi.
  - Backoff adımları: `1s -> 2s -> 4s -> 8s -> 15s`
  - `CLOSED | TIMED_OUT | CHANNEL_ERROR` durumları drop olarak ele alınıyor.
  - Realtime payload `updated_at` / `version` ile stale event tespiti yapılıyor.
  - Invalid transition veya stale event local lifecycle state'e uygulanmıyor.

### 3) Telemetry hardening
- Güncellendi: `src/features/analytics/analytics.ts`
- Yeni telemetry event adları:
  - `report_realtime_subscription_drop`
  - `report_realtime_reconnect_attempt`
  - `report_realtime_stale_event_ignored`

### 4) Documentation updates
- Yeni: `docs/LIFECYCLE_TRANSITION_MATRIX.md`
- Güncellendi: `docs/SUPABASE_BACKEND_PLAN.md`
- Yeni: `docs/RLOOP_019_NOTES.md`

## Validation
- `yarn lint`
- `yarn typecheck`
