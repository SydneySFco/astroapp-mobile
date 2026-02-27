# RLOOP-018 Notes — Backend Lifecycle Completion + Realtime Read Updates

## Scope Summary
- `report_orders -> user_reports` lifecycle akışı backend öncelikli tek kaynak yaklaşımıyla netleştirildi.
- Read ekranında Supabase Realtime ile `user_reports.status` canlı dinleme aktif edildi.
- Polling fallback düşük frekansa (15sn) çekildi.
- Lifecycle telemetry event iskeletleri eklendi (transition, time-to-ready, retry count).
- 401/403/408 hata durumlarında kullanıcı mesajları + retry aksiyonu güçlendirildi.

## Technical Changes

### 1) Lifecycle source-of-truth stabilization
- Dosya: `src/features/reports/reportsApi.ts`
- `getReportDetail` flow:
  - Öncelik her zaman `user_reports.status` (`queued|processing|ready|archived->ready`).
  - `user_reports` yoksa `report_orders.status` fallback kullanılır.
- Order status mapping netleştirildi:
  - `pending|failed -> queued`
  - `paid -> processing`
  - `refunded -> ready` (active lifecycle dışı terminal durum)
- `purchased` flag yalnızca okunabilir/aktif order statülerinde true (`pending|paid`).

### 2) Realtime subscription + controlled polling fallback
- Dosya: `src/screens/ReportReadScreen.tsx`
- `supabase.channel(...).on('postgres_changes')` ile `public.user_reports` update event’leri dinleniyor.
- Filtre: `report_catalog_id=eq.<reportId>`
- Update geldiğinde:
  - status local lifecycle state’e yansıtılıyor
  - query `refetch()` ile data tekilleştirilerek cache güncelleniyor
- Polling fallback: 15sn (yüksek frekans polling kaldırıldı).

### 3) Telemetry skeletons
- Dosyalar:
  - `src/screens/ReportReadScreen.tsx`
  - `src/features/analytics/analytics.ts`
- Yeni event skeletonları:
  - `report_lifecycle_transition` (`from_status`, `to_status`)
  - `report_lifecycle_ready` (`time_to_ready_ms`, `retry_count`)
  - `report_realtime_subscription` (`subscription_status`)

### 4) Error hardening (401/403/408 + retry)
- Read ekranında status-aware hata mesajları korunup retry aksiyonu sayaçlı hale getirildi.
- Retry denemeleri `reports_retry` event’ine `retry_count` ile düşülüyor.

## Validation
- `yarn lint`
- `yarn typecheck`
