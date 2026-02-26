# RLOOP-044 Observability Metrics — Quarantine Control Plane

## Metric Names

- `replay_quarantine_volume_total`
- `replay_quarantine_redrive_success_rate`
- `replay_quarantine_drop_rate`
- `replay_quarantine_admin_action_total`
- `replay_quarantine_idempotency_deduped_total`
- `replay_quarantine_stale_conflict_total`

## Standard Dimensions

`replay_quarantine_admin_action_total` için zorunlu boyutlar:
- `action`: `redrive | drop`
- `outcome`: `accepted | deduped | stale_conflict | rejected`
- `reason`: operasyonel reason code/string

Opsiyonel:
- `requestId`
- `replayId`

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

## Outcome Guidance

- `accepted`: state transition başarıyla işlendi
- `deduped`: aynı requestId daha önce işlendi, tekrar side-effect uygulanmadı
- `stale_conflict`: pending_review dışındaki state nedeniyle optimistic transition reddedildi
- `rejected`: validation/authz sebebiyle endpoint tarafından reddedildi
