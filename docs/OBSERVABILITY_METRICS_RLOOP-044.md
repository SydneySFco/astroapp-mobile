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
