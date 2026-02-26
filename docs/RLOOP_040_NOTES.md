# RLOOP-040 Notes — Connector Runtime + Alert Dispatcher Draft

## Yapılanlar

### 1) Connector runtime integration draft
- `src/features/reliability/connectorRuntime.ts`
  - DB/view + object-store connector adapter skeleton
  - runtime orchestration: `runConnectorRuntime()`
  - watermark cursor read/persist döngüsü
- `src/features/reliability/stateStore.ts`
  - `WatermarkStateStore` abstraction
  - `FileWatermarkStateStore` (callback tabanlı file placeholder)
  - `DbWatermarkStateStorePlaceholder` (query callback tabanlı db placeholder)

### 2) Alert dispatcher worker skeleton
- `src/features/reliability/alertDispatcherWorker.ts`
  - Slack/Webhook dispatcher adapter contract
  - suppression window guard (`dedupKey + lastSentAt`)
  - retry/backoff policy (`computeDispatchBackoffMs`)
  - max retry sonrası dead-letter enqueue taslağı

### 3) Observability fields
- `AlertDispatchMetrics` eklendi:
  - `dispatchSuccessCount`
  - `dispatchFailureCount`
  - `dispatchSuppressionHitCount`

### 4) Dokümantasyon
- Yeni: `docs/CONNECTOR_RUNTIME_RLOOP-040.md`
- Güncellenecek policy: `docs/ALERT_ROUTING_POLICY_RLOOP-039.md`
- Bu not: `docs/RLOOP_040_NOTES.md`

## Notlar / Sınırlar
- Worker ve connector katmanı şu aşamada draft/skeleton; gerçek network/db IO dependency injection ile bekleniyor.
- Dispatch guard route prefix (`webhook://` vs default slack) üzerinden kanal seçiyor.
- Dispatch başarısında suppression store güncellenir; başarısızlıkta DLQ kaydı açılır.
