# SUPABASE_BACKEND_PLAN

## Goal
AstroApp backend standardını Supabase-first modele geçirmek.

## Environment
Required env vars:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Client entrypoint:
- `src/services/supabase/client.ts`

Auth adapter:
- `src/services/supabase/auth.ts`

---

## Suggested Data Model (MVP)

### 1) `profiles`
Auth user metadata için uygulama profili.

Fields (minimum):
- `id uuid primary key` -> `auth.users.id` ile aynı
- `email text not null unique`
- `full_name text`
- `birth_date date`
- `birth_time text`
- `city text`
- `country text`
- `intent text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### 2) `reports_catalog`
Marketplace'te listelenecek rapor tipleri.

Fields (minimum):
- `id uuid primary key`
- `slug text unique not null`
- `title text not null`
- `description text`
- `price_cents integer not null`
- `currency text not null default 'USD'`
- `is_active boolean not null default true`
- `created_at timestamptz default now()`

### 3) `report_orders`
Satın alma/checkout kaydı.

Fields (minimum):
- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `report_catalog_id uuid not null references reports_catalog(id)`
- `status text not null` (`pending|paid|failed|refunded`)
- `provider text` (örn. `stripe`, `iap`)
- `provider_ref text`
- `amount_cents integer not null`
- `currency text not null`
- `created_at timestamptz default now()`

### 4) `user_reports`
Kullanıcıya üretilen raporun final çıktısı.

Fields (minimum):
- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `report_catalog_id uuid not null references reports_catalog(id)`
- `order_id uuid references report_orders(id)`
- `title text not null`
- `summary text`
- `content_json jsonb`
- `status text not null default 'ready'` (`queued|processing|ready|archived`)
- `created_at timestamptz default now()`

---

## RPC / Function Suggestions

### `get_report_catalog()`
- Public aktif raporları döndürür (`reports_catalog where is_active = true`).

### `get_my_reports()`
- `auth.uid()` kullanarak kullanıcının `user_reports` kayıtlarını döndürür.

### `create_report_order(report_catalog_id uuid)`
- Auth user için `report_orders` satırı oluşturur (status: `pending`).

> Not: MVP'de doğrudan tablo sorgusu da yeterli olabilir; RPC özellikle policy sadeleştirme için önerilir.

---

## RLS Notes (MVP)

### `profiles`
- `select/update`: sadece `id = auth.uid()`.
- `insert`: authenticated user kendisi için insert edebilir.

### `reports_catalog`
- `select`: anon + authenticated için `is_active = true`.
- `insert/update/delete`: sadece service role/admin.

### `report_orders`
- `select/insert`: sadece `user_id = auth.uid()`.
- `update`: ödeme callback'i için server-side/service role.

### `user_reports`
- `select`: sadece `user_id = auth.uid()`.
- `insert/update/delete`: server-side/service role (rapor üretim pipeline).

---

## Auth Flow (Current App Alignment)

- `signIn` -> `supabase.auth.signInWithPassword`
- `signUp` -> `supabase.auth.signUp`
- `forgotPassword` -> `supabase.auth.resetPasswordForEmail`
- `logout` -> `supabase.auth.signOut`

`src/features/auth/authApi.ts` içinde Supabase configured ise bu wrapper'lar çalışır, değilse mevcut REST endpoint fallback'i kullanılır.

---

## RLOOP-016 Wiring Status

Aktif bağlanan Supabase query/mutation noktaları (`src/features/reports/reportsApi.ts`):

- `getReportCatalog`
  - Table: `reports_catalog`
  - Fields: `id`, `slug`, `title`, `description`, `price_cents`, `currency`, `is_active`
  - Mapping:
    - `description` -> `shortDescription` / `preview`
    - `price_cents` -> `price` (major unit)

- `getPurchasedReports`
  - Table: `user_reports`
  - Fields: `report_catalog_id`, `created_at`
  - Mapping:
    - `report_catalog_id` -> `reportId`
    - `created_at` -> `purchasedAt`

- `getReportDetail`
  - Tables: `reports_catalog` + `user_reports`
  - Detail için catalog alanları ve varsa `user_reports.content_json` okunur.

- `purchaseReport`
  - Table: `report_orders`
  - Insert fields: `report_catalog_id`, `status='pending'`

Notlar:
- Supabase env yoksa (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) local fallback catalog ile app akışı korunur.
- UI, reports ekranlarında `reportsSlice` mock catalog yerine `reportsApi` query cache kullanır.

## RLOOP-017 Live Lifecycle Status

Aktifleşen/sertleştirilen noktalar:

- `getReportDetail(reportId)` artık gerçek lifecycle döndürüyor:
  - Öncelik: `user_reports.status` (`queued|processing|ready`)
  - Fallback: `report_orders.status` (`pending -> queued`, `paid -> processing`)
- Read ekranı doğrudan detail query lifecycle’ına bağlı.
- 401/403/timeout edge-case’leri API katmanında normalize edilip UI’da anlamlı fallback + retry olarak gösteriliyor.
- Checkout sonrası frontend local başlangıç lifecycle’ı `queued` olarak set edilerek state continuity korunuyor.

## RLOOP-018 Backend Lifecycle + Realtime Plan Update

### Lifecycle Source Priority (single source)
1. **Primary:** `user_reports.status`
2. **Fallback:** `report_orders.status` (yalnızca `user_reports` henüz oluşmadıysa)

Mapping (UI lifecycle):
- `user_reports.status`
  - `queued -> queued`
  - `processing -> processing`
  - `ready -> ready`
  - `archived -> ready` (read ekranında terminal fallback)
- `report_orders.status` fallback
  - `pending -> queued`
  - `paid -> processing`
  - `failed -> queued` (retry/yeniden üretim bekleyebilir)
  - `refunded -> ready` (active lifecycle dışı)

### Realtime Read Model
- Channel: `postgres_changes` on `public.user_reports`
- Filter: `report_catalog_id=eq.<id>`
- Trigger: `UPDATE` event geldiğinde detail query refetch
- Polling fallback: low frequency (`15s`) yalnızca güvenlik ağı

### Telemetry Skeletons
- `report_lifecycle_transition`
- `report_lifecycle_ready`
- `report_realtime_subscription`
- `reports_retry` içinde `retry_count`

## RLOOP-019 Server-side Authority + Realtime Reliability Plan Update

### Lifecycle transition guard policy (backend)
`user_reports.status` için backend trigger/policy tarafında aşağıdaki invalid transition'lar bloklanmalı:

- `queued -> ready`
- `processing -> queued`
- `ready -> queued`
- `ready -> processing`

Allowed transitions:
- `queued -> queued|processing`
- `processing -> processing|ready`
- `ready -> ready`

Client tarafı defensive guard uygular; ancak **final authority backend** kalır.

### Realtime reliability hardening
- Subscription drop durumları (`CLOSED|TIMED_OUT|CHANNEL_ERROR`) için reconnect + backoff (`1s,2s,4s,8s,15s`) uygulanmalı.
- Out-of-order event riskine karşı payload tarafında `updated_at` ve mümkünse `version` alanı sağlanmalı.
- Client stale event'leri ignore eder; backend'de de monoton güncelleme (trigger check) önerilir.

### Telemetry coverage (RLOOP-019)
Ek metrikler:
- reconnect attempts
- subscription drops
- stale event ignored

## Open Items

1. SQL migration scripts hazırlanmalı.
2. Trigger: `auth.users` -> `profiles` otomatik create (opsiyonel ama önerilir).
3. Payment provider webhooks + service role güvenlik modeli netleştirilmeli.
4. Report generation pipeline (queue/edge function) tasarlanmalı.
5. `user_reports` için transition guard trigger + optional `version` increment mekanizması uygulanmalı.
