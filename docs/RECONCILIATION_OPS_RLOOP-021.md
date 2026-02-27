# RLOOP-021 — Reconciliation Ops (Edge Function / Cron)

## Objective

`processing` durumunda SLA’yı aşan `user_reports` kayıtlarını 10 dakikalık cadence ile tespit etmek, güvenli aksiyon almak ve gözlemlenebilirliği artırmak.

## 1) 10 dk Cadence Job Örneği

Kaynak skeleton:
- `docs/supabase/reconciliation/reconcile_stuck_processing.ts`

Önerilen çalışma modeli:
1. pg_cron / scheduler her **10 dakikada** edge function’ı tetikler.
2. function, `updated_at < now() - SLA` ve `status='processing'` kayıtlarını çeker.
3. Her kayıt için `requeue_stuck_user_report(...)` RPC çağrılır.
4. Sonuçlar structured log + audit tabloya yazılır.

Örnek pseudo-cron:
- `*/10 * * * *` → `reconcile-stuck-processing`

## 2) Runtime Guardrails

- Max batch size: `500`
- Timeout: `<= 60s`
- Retry policy: idempotent olacak şekilde tek deneme + alarm (sonsuz retry yok)
- Mode flag:
  - `alert_only` (migration sonrası ilk 24 saat önerilir)
  - `retry` (stabilite teyidi sonrası)

## 3) Alert Thresholds (başlangıç önerisi)

### Error Alerts
- **Critical:** 3 ardışık job failure
- **Warning:** Job error rate > %5 (15 dk pencere)

### Backlog Alerts
- **Warning:** stuck `processing` count > 20 (10 dk)
- **Critical:** stuck `processing` count > 100 (10 dk)

### Latency Alerts
- **Warning:** oldest `processing` age > 45 dk
- **Critical:** oldest `processing` age > 90 dk

## 4) Observability Fields

Her run için minimum log alanları:
- `run_id`
- `threshold_iso`
- `mode`
- `scanned_count`
- `requeued_count`
- `failed_count`
- `duration_ms`

RPC/audit alanları:
- `user_report_id`
- `reason`
- `old_status`
- `new_status`
- `success`
- `error_code` / `error_message`
- `invoked_by` (service principal)

## 5) Operational Playbook

1. Alert tetiklenirse önce `alert_only` moda geç.
2. Son 1 saat RPC audit kayıtlarını incele.
3. Belirli hata pattern’i varsa rollout runbook rollback/mitigation uygula.
4. Incident sonrası postmortem: SLA, thresholds, batch limit revizyonu.

## 6) Security

- Edge function sadece server-side secret (`SUPABASE_SERVICE_ROLE_KEY`) ile çalışmalı.
- Client tarafından doğrudan RPC çağrısı kapalı olmalı.
- Audit kaydı immutable yaklaşımda tutulmalı (update/delete kısıtları önerilir).