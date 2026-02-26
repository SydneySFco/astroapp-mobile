# Privileged Override Policy (RLOOP-022)

## Purpose
Bu policy, `user_reports` lifecycle güvenliğini bozmayacak şekilde stuck `processing` kayıtlarının operasyonel recovery'sini tanımlar.

> Golden rule: Lifecycle guard (RLOOP-020) korunur. Override işlemi normal transition kurallarını bypass etmek için kullanılmaz.

---

## 1) Actor Constraints

### Allowed Actors
1. **Reconcile Requestor** (Ops on-call / incident commander)
   - Override request açabilir.
   - Tek başına uygulayamaz.
2. **Reconcile Approver** (Backend lead / designated approver)
   - Request’i onaylar veya reddeder.
   - Requestor ile aynı kişi olamaz (four-eyes).
3. **Executor** (service role edge function / scheduler)
   - Sadece onaylı request üzerinde job enqueue edebilir.

### Disallowed
- Client uygulama kullanıcıları
- Anon/authenticated normal JWT ile doğrudan RPC çağrısı
- Requestor=Approver self-approval

---

## 2) Approval Flow

1. **Request Created**
   - Input: `user_report_id`, `reason`, `incident_ref`, `max_age_minutes`
   - State: `requested`
2. **Approval Decision**
   - Approver request’i `approved` veya `rejected` yapar.
3. **Execution**
   - Sadece `approved` request için executor `enqueue_stuck_report_reconcile(...)` çalıştırır.
4. **Completion**
   - Job state `queued -> running -> succeeded|failed`
   - Sonuç audit’e immutable event olarak yazılır.

SLA hedefi:
- P1 incident’lerde request->approval <= 15 dk
- approval->enqueue <= 5 dk

---

## 3) Lifecycle-Safe Reconcile Strategy

### Forbidden (bu policy’de yok)
- `processing -> queued` doğrudan status update
- trigger disable / guard bypass

### Allowed
- `user_report_reconcile_jobs` içine idempotent job enqueue
- Aynı `user_report_id` için aynı anda tek açık reconcile job
- Worker’ın mevcut `processing` kaydı üzerinde güvenli replay/finalize akışı

Bu sayede transition matrix ile çakışma engellenir.

---

## 4) Audit Schema (Minimum)

Her privileged aksiyon için şu alanlar tutulur:
- `event_id`
- `event_type` (`request_created|request_approved|job_enqueued|job_started|job_succeeded|job_failed|request_rejected`)
- `user_report_id`
- `request_id`
- `job_id` (varsa)
- `reason`
- `incident_ref`
- `actor_role` (`requestor|approver|executor|worker`)
- `actor_id` (service principal veya operator id)
- `old_status` / `new_status` (varsa)
- `old_version` / `new_version` (varsa)
- `metadata_json`
- `created_at`

### Audit Rules
- Append-only (update/delete yasak veya çok sıkı kısıt)
- UTC timestamp
- Her failed attempt için error_code/error_message saklanır

---

## 5) Security Controls
- RPC fonksiyonları `security definer` + `service_role` check ile korunur.
- Public execute revoke edilir.
- Edge function sadece server-side secret ile çalışır.
- Rate limit önerisi: 1 report için 10 dk içinde max 1 enqueue denemesi.

---

## 6) Client / Telemetry Minimal Mapping

Client status map önerisi:
- Backend job enqueued/running => `reconcile_in_progress`
- job succeeded ve report ready => `reconcile_resolved`

Telemetry events:
- `report_reconcile_requested`
- `report_reconcile_completed`
- `report_reconcile_failed`

Fields:
- `report_id`
- `reconcile_job_id`
- `incident_ref`
- `latency_ms`
- `result`

---

## 7) Rollback & Kill-Switch
- Feature flag: `RECONCILE_OVERRIDE_ENABLED=false` ile enqueue kapatılır.
- Alert-only modda sadece tespit + log yapılır, enqueue yapılmaz.
- Art arda 3 failed run durumunda otomatik pause + human review.
