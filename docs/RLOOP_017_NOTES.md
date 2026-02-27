# RLOOP-017 Notes — Supabase Live Wiring + Report Lifecycle Stabilization

## Scope Summary
- Report read/detail flow, `getReportDetail(reportId)` query lifecycle’ına bağlandı.
- Checkout sonrası rapor durumları için lifecycle (`queued | processing | ready`) UI geçişleri netleştirildi.
- Auth/RLS ve network edge-case’leri için anlamlı fallback + retry eklendi.

## Technical Changes

### 1) `reportsApi` lifecycle + error hardening
- Dosya: `src/features/reports/reportsApi.ts`
- `ReportDetail` modeline `lifecycleStatus` alanı eklendi.
- `getReportDetail` artık:
  - `reports_catalog` + `user_reports` sorgularını timeout guard ile çalıştırır.
  - `user_reports.status` üzerinden lifecycle döndürür.
  - `user_reports` yoksa son `report_orders.status` kaydına göre fallback lifecycle üretir:
    - `pending -> queued`
    - `paid -> processing`
- `purchaseReport` timeout guard ve status-aware error mapping ile güçlendirildi.
- Auth/RLS/network error mapping:
  - 401 (`auth/jwt/unauthorized`)
  - 403 (`permission/forbidden/rls`)
  - 408 (`timeout`)

### 2) Read screen gerçek detail query entegrasyonu
- Dosya: `src/screens/ReportReadScreen.tsx`
- `ReportListItem` prop’u yerine `reportId` ile query-driven render yapısına geçildi.
- `useGetReportDetailQuery(reportId)` ile:
  - loading / error / queued / processing / ready state’leri `ScreenState` pattern ile gösteriliyor.
  - retry aksiyonu RTK Query `refetch` ile bağlandı.
  - 401/403/timeout için kullanıcıya anlamlı mesajlar veriliyor.

### 3) App lifecycle state wiring
- Dosya: `src/app/App.tsx`
- Checkout success sonrası local lifecycle başlangıcı `queued` olarak işaretleniyor.
- Read screen’e local lifecycle + lifecycle update callback geçilerek UI state geçişleri stabilize edildi.

## Validation
- `yarn lint` ✅
- `yarn typecheck` ✅

## Notes
- Lifecycle’in nihai geçişi backend üretim pipeline’ına bağlıdır (`report_orders`/`user_reports` güncellemeleri).
- Frontend, bu iterasyonda canlı sorgu sonuçlarına göre durum render eder ve polling ile güncellemeyi takip eder.