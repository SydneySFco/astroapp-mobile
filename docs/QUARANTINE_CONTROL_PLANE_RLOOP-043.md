# Quarantine Control Plane Draft — RLOOP-043

## 1) Persistence Draft

### 1.1 Önerilen ana tablo

`public.replay_quarantine_messages`

Önerilen alanlar:
- `replay_id text primary key`
- `event_id text not null`
- `dedup_key text`
- `route text not null`
- `status text not null default 'pending_review'`
- `quarantine_reason text not null`
- `replay_count integer not null`
- `last_error_classification text`
- `last_error_message text`
- `failed_at timestamptz`
- `quarantined_at timestamptz not null`
- `reviewed_at timestamptz`
- `reviewed_by text`
- `redriven_at timestamptz`
- `dropped_at timestamptz`
- `payload jsonb`
- `headers jsonb`
- `original_dead_letter jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 1.2 Durum geçişleri

- Initial: `pending_review`
- Allowed terminal states:
  - `redriven`
  - `dropped`

Tek yönlü geçiş:
- `pending_review -> redriven`
- `pending_review -> dropped`
- Terminal state’den geri dönüş yok.

### 1.3 Audit tablosu

`public.replay_quarantine_audit_log`:
- immutable append-only
- her transition ve manuel işlem için kayıt
- zorunlu alanlar:
  - `actor_id`
  - `reason`
  - `approval_ref`

## 2) Retention / Purge Strategy

Öneri:
- `pending_review`: 30 gün sonra “stale review” alarmı üret, otomatik silme yapma.
- `redriven` / `dropped`: 90 gün tutulup purge edilebilir.

Purge job örneği:
- Günlük cron
- Batch delete (örn. 5k satır)
- Önce audit snapshot/export, sonra delete

## 3) Read Model

### 3.1 List view fields
- `replayId`
- `eventId`
- `route`
- `status`
- `quarantineReason`
- `replayCount`
- `failedAt`
- `quarantinedAt`
- `lastErrorClassification`
- `lastErrorMessage`
- `reviewedAt`
- `reviewedBy`

### 3.2 Detail view fields
List’e ek olarak:
- `dedupKey`
- `payload`
- `headers`
- `originalDeadLetter`
- `auditTrail[]`

## 4) Admin Operations Endpoint Skeleton

Role policy:
- list/detail: `admin_ops` veya `admin_approver`
- redrive/drop: sadece `admin_approver`

### 4.1 Manual redrive
`POST /admin/ops/reliability/quarantine/:replayId/redrive`

Body:
- `actorId` (opsiyonel; context actor fallback)
- `reason` (zorunlu)
- `approvalRef` (zorunlu)
- `requestId` (opsiyonel idempotency/audit)
- `note` (opsiyonel)

### 4.2 Force drop
`POST /admin/ops/reliability/quarantine/:replayId/drop`

Body zorunlulukları redrive ile aynıdır.

## 5) Observability

Önerilen metricler:
- `replay_quarantine_volume_total`
- `replay_quarantine_redrive_success_rate`
- `replay_quarantine_drop_rate`

Ek dashboard boyutları:
- status bazlı dağılım (`pending_review/redriven/dropped`)
- reason bazlı dağılım
- route bazlı yoğunluk
- review latency p95/p99

## 6) Implementation Boundary

RLOOP-043 çıktısı sözleşme ve taslaktır:
- TS contracts + handler skeleton
- SQL draft migration
- dokümantasyon

RLOOP-044’te hedef:
- Supabase adapter wiring
- HTTP router entegrasyonu
- gerçek metric emit path
