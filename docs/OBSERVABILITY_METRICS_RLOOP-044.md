# RLOOP-044/RLOOP-045 Observability Metrics — Quarantine Control Plane

## Metric Names

- `replay_quarantine_volume_total`
- `replay_quarantine_redrive_success_rate`
- `replay_quarantine_drop_rate`
- `replay_quarantine_admin_action_total`
- `replay_quarantine_idempotency_deduped_total`
- `replay_quarantine_stale_conflict_total`
- `github_api_attempt_count`
- `github_api_rate_limit_hits`
- `publisher_idempotent_dedupe_count`

## Standard Dimensions

`replay_quarantine_admin_action_total` için zorunlu boyutlar:
- `action`: `redrive | drop`
- `outcome`: `accepted | deduped | stale_conflict | rejected`
- `reason`: operasyonel reason code/string

Canary publisher / GitHub API metricleri için zorunlu boyutlar:
- `action`: `github_api | check_run | sticky_comment | artifact_sync | runtime`
- `outcome`: `attempt | rate_limited | success | failure | dry_run | deduped`
- `endpoint`: örn. `checks.create`, `issues.comments.update`, `contents.put`, `publisher.run`

Opsiyonel:
- `requestId`
- `replayId`

## Error Contract → Outcome Mapping (RLOOP-045)

- `idempotent_duplicate` -> `deduped`
- `stale` -> `stale_conflict`
- `unauthorized | bad_request | not_found | internal_error` -> `rejected`
- başarılı transition -> `accepted`

Bu mapping `action/outcome/reason` triad’ını API-level hata sözleşmesi ile hizalar.

## Emit Noktaları

- **POST redrive/drop accepted**: `accepted`
- **POST redrive/drop duplicate requestId**: `deduped`
- **POST redrive/drop stale transition**: `stale_conflict`
- **authz/validation/not-found/internal failures**: `rejected`

## RLOOP-054 Dashboard Metric Set (Ops)

Aşağıdaki paneller canary publisher runtime için operasyonel minimum dashboard setini oluşturur.

### 1) Canary Publish Success / Failure

Kaynak metric:
- `github_api_attempt_count`

Önerilen filtre:
- `action in (check_run, sticky_comment, artifact_sync)`
- `outcome in (success, failure)`

Önerilen görselleştirme:
- stacked time-series (`success` vs `failure`)
- SLI: `success / (success + failure)`

### 2) Dedupe Hit Ratio

Kaynak metricler:
- pay: `publisher_idempotent_dedupe_count`
- payda: `github_api_attempt_count{action="check_run", outcome="success"} + publisher_idempotent_dedupe_count`

Formül:
- `dedupe_ratio = dedupe_count / total_publish_intents`

Alarm önerisi:
- ani yükseliş (ör. > %25) -> olası replay/idempotency anomalisi

### 3) Rate-limit Hit Trend

Kaynak metric:
- `github_api_rate_limit_hits`

Boyut:
- `endpoint`

Önerilen görselleştirme:
- endpoint bazlı time-series
- 1h moving average + 24h baseline karşılaştırması

### 4) Drift Severity Distribution

Kaynak sinyal:
- canary summary status (`success|warn|fail`) ve drift check detayları

Önerilen bucket’lar:
- `success` = healthy
- `warn` = medium severity
- `fail` = high severity

Önerilen görselleştirme:
- günlük yüzde dağılımı (stacked area / donut)
- release window filtresi ile karşılaştırma

## Sample Payload

```json
{
  "metric": "replay_quarantine_admin_action_total",
  "value": 1,
  "dimensions": {
    "action": "redrive",
    "outcome": "accepted",
    "reason": "approved_by_oncall"
  },
  "requestId": "idem-123",
  "replayId": "r-991",
  "observedAt": "2026-02-26T14:45:00.000Z"
}
```
