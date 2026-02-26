# RLOOP-016 Notes — Supabase Real Data Wiring

## Scope Summary
- Reports data source, `reportsSlice` mock catalog ağırlığından `reportsApi` (RTK Query) odaklı yapıya taşındı.
- Supabase tablo alanlarıyla uyumlu mapping katmanı eklendi.
- RLOOP-007 ekran state pattern'i (loading/error/empty) Reports Marketplace ve My Reports ekranlarında korundu.

## Technical Changes

### 1) `reportsApi` Supabase query/mutation adaptasyonu
- Dosya: `src/features/reports/reportsApi.ts`
- `axiosBaseQuery` yerine `fakeBaseQuery + queryFn` ile doğrudan Supabase client kullanımı.
- Endpoints:
  - `getReportCatalog` -> `reports_catalog`
  - `getReportDetail` -> `reports_catalog` + `user_reports`
  - `getPurchasedReports` -> `user_reports`
  - `purchaseReport` (mutation) -> `report_orders` insert (`status: pending`)
- Type mapping:
  - `price_cents -> price`
  - `report_catalog_id -> reportId`
  - `created_at -> purchasedAt`

### 2) App wiring
- Dosya: `src/app/App.tsx`
- Reports akışında data source artık:
  - `useGetReportCatalogQuery`
  - `useGetPurchasedReportsQuery`
  - `usePurchaseReportMutation`
- Checkout success sonrası mutation deneniyor; hata olsa da UX continuity için local purchased fallback tutuluyor.

### 3) Screen state alignment
- Dosyalar:
  - `src/screens/ReportsMarketplaceScreen.tsx`
  - `src/screens/MyReportsScreen.tsx`
- Loading/Error/Empty state için `ScreenState` kullanımı query durumlarına bağlandı.

### 4) Type alignment
- Reports screen prop type'ları `reportsSlice.Report` yerine `reportsApi.ReportListItem` ile güncellendi:
  - `ReportDetailScreen`
  - `ReportCheckoutScreen`
  - `ReportReadScreen`
  - `ReportsMarketplaceScreen`
  - `MyReportsScreen`

## Known Gaps (intentional for MVP slice)
- `purchaseReport` şu an `report_orders` kaydı açıyor; gerçek ödeme callback + `user_reports` üretimi backend pipeline'a bağlı.
- `ReportReadScreen` full content için henüz ayrı detail fetch zinciri açmıyor; mevcut list item preview gösteriyor.
- Legacy `reportsSlice` reducer store'da duruyor (geri uyumluluk için), ancak reports UI source-of-truth artık reportsApi query cache.
