# RLOOP-041 Notes — Runtime Operationalization + Integration Test Hardening

## Yapılanlar

### 1) Watermark state store operationalization
- `src/features/reliability/stateStore.ts`
  - `SqlWatermarkStateStoreAdapter` eklendi.
  - Supabase/Postgres uyumlu `fetchByKey/upsertRow` callback kontratı tanımlandı.
  - `createSupabaseWatermarkStateStore` ve `createPostgresWatermarkStateStore` factory'leri eklendi.
  - File/DB placeholder ile aynı `WatermarkStateStore` interface korundu.

### 2) Dispatcher transport operationalization
- `src/features/reliability/alertDispatcherWorker.ts`
  - Slack/webhook için transport-adapter isimlendirmesi netleştirildi (`createSlackTransportDispatcher`, `createWebhookTransportDispatcher`).
  - Hata sınıflandırma katmanı eklendi: `retryable | fatal | unknown`.
  - Retry akışı fatal hata durumunda kısa devre yapacak şekilde güncellendi.
  - DLQ kaydına `lastErrorMessage`, `lastErrorClassification` alanları eklendi.
  - Telemetry metriklerine `dispatchRetryCount` alanı eklendi.

### 3) DLQ replay worker skeleton
- `src/features/reliability/dlqReplayWorker.ts`
  - Replay queue kontratı: `pullBatch / ack / reschedule`.
  - Tick skeleton: `runDlqReplayTick`.
  - Telemetry alanları:
    - `pulledCount`
    - `ackedCount`
    - `rescheduledCount`
    - `replaySuccessCount`
    - `replayFailureCount`

### 4) Integration test hardening
- `__tests__/reliability.runtime.rloop041.test.ts`
  - Connector cursor advance + watermark persist senaryosu.
  - Suppression window behavior senaryosu.
  - Retry/backoff + DLQ fallback doğrulama senaryosu.

### 5) Reliability module export update
- `src/features/reliability/index.ts`
  - `dlqReplayWorker` export edildi.

## Notlar
- Bu iterasyonda Supabase/Postgres adapter'ları callback odaklı operational skeleton olarak tutuldu; gerçek client binding (supabase-js / pg) runtime/infrastructure katmanında enjekte edilecek şekilde bırakıldı.
- RLOOP-040 API isimleri backward-compatible alias ile korunuyor (`createSlackDispatcher`, `createWebhookDispatcher`).
