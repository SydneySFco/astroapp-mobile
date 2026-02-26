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

## Open Items

1. SQL migration scripts hazırlanmalı.
2. Trigger: `auth.users` -> `profiles` otomatik create (opsiyonel ama önerilir).
3. Payment provider webhooks + service role güvenlik modeli netleştirilmeli.
4. Report generation pipeline (queue/edge function) tasarlanmalı.
