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

## RLOOP-041 Dispatch Operationalization Güncellemesi

RLOOP-041 ile `src/features/reliability/alertDispatcherWorker.ts` üzerinde:

- Transport adapter ayrımı operational naming ile güncellendi:
  - `createSlackTransportDispatcher(...)`
  - `createWebhookTransportDispatcher(...)`
- Error classification eklendi:
  - `retryable` (429/5xx, timeout/network vb.)
  - `fatal` (4xx permanent class)
  - `unknown`
- Fatal sınıf hata alındığında retry döngüsü kısa devre yapar.
- DLQ kaydı zenginleştirildi:
  - `lastErrorMessage`
  - `lastErrorClassification`
- Telemetry metriklerine `dispatchRetryCount` eklendi.

## RLOOP-041 DLQ Replay Skeleton

Yeni modül: `src/features/reliability/dlqReplayWorker.ts`

- Replay queue consumption taslağı:
  - `pullBatch(limit)`
  - `ack(replayId)`
  - `reschedule(replayId, reason)`
- Tick API: `runDlqReplayTick(...)`
- Telemetry alanları:
  - `pulledCount`, `ackedCount`, `rescheduledCount`
  - `replaySuccessCount`, `replayFailureCount`

## Operasyon Notu

- `out-slack` ve `out-webhook` çıktıları dispatch katmanına hazır format üretir.
- Gerçek webhook/slack gönderimi CI/job orchestration katmanında yapılmalıdır.
- DLQ replay skeleton operationalize edildi; production runbook/policy tuning bir sonraki iterasyonda derinleştirilebilir.
