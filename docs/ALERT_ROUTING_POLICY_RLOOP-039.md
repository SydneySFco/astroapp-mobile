# ALERT ROUTING POLICY — RLOOP-039

## Amaç

Drift alert routing'i production-hardening seviyesine taşımak:
- webhook/slack payload standardı
- dedup/suppression window
- severity + class bazlı route table

## Payload Standardı

`route-drift-alerts-rloop039.py` event payload (webhook/slack için ortak çekirdek):

- `version`
- `event_id`
- `dedup_key`
- `occurred_at`
- `severity` (`warn|critical`)
- `alert_class`
- `route`
- `summary`
- `details`:
  - `latest_ece`
  - `moving_avg_ece`
  - `delta`
  - `reasons[]`
  - `source`
- `suppressed`
- `suppression_window_minutes`

## Dedup / Suppression

- Suppression state: `reports/drift-alert-state-rloop039.json`
- Dedup key: `sha1(class|severity|route)`
- Varsayılan suppression window: 60 dk
- Pencere içinde aynı dedup key tekrar oluşursa:
  - event artifact'e yazılır
  - `suppressed=true`
  - dış kanal dispatch katmanında drop edilebilir

## Severity + Class Route Table

Default route table (script içine gömülü):

- `default.warn -> slack://reliability-warn`
- `default.critical -> slack://reliability-critical`
- `db-lock.warn -> slack://db-oncall`
- `db-lock.critical -> pagerduty://db-critical`
- `network.warn -> slack://network-warn`
- `network.critical -> pagerduty://network-critical`

Override için `--route-table <json>` verilir.

## RLOOP-040 Dispatch Worker Taslağı

`src/features/reliability/alertDispatcherWorker.ts` ile runtime worker skeleton eklendi.

Öne çıkanlar:
- Kanal adapter'ları: `slack` ve `webhook`
- `dedup_key` + suppression window guard
- Retry/backoff policy:
  - exponential backoff (`baseBackoffMs`, `maxBackoffMs`)
  - `maxAttempts` sonrası dead-letter queue enqueue
- Dispatch guard route prefix'i:
  - `webhook://...` => webhook dispatcher
  - diğer route'lar => slack dispatcher (draft default)

## Observability Alanları (RLOOP-040)

Worker metrik alanları:
- `dispatchSuccessCount`
- `dispatchFailureCount`
- `dispatchSuppressionHitCount`

Bu alanlar run bazlı veya tick bazlı telemetry emit katmanına bağlanmak üzere taslak olarak tanımlandı.

## Operasyon Notu

- `out-slack` ve `out-webhook` çıktıları dispatch katmanına hazır format üretir.
- Gerçek webhook/slack gönderimi CI/job orchestration katmanında yapılmalıdır.
- Dead-letter queue replay/runbook adımı bir sonraki iterasyonda (RLOOP-041) operationalize edilmelidir.
