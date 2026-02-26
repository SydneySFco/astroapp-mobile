# RLOOP-042 Notes — Runtime Infra Binding + Replay Policy Hardening

## Yapılanlar

### 1) Runtime infra binding draft güçlendirme
- `src/features/reliability/stateStore.ts`
  - `createSupabaseWatermarkBindings(...)` eklendi.
  - `createPostgresWatermarkBindings(...)` eklendi.
  - Böylece `SqlWatermarkStateStoreAdapter` için supabase-js / pg pattern'inde concrete callback binding örnekleri sağlandı.

### 2) Config/env sözleşmesi
- `src/config/env.ts`
  - Runtime reliability için yeni env alanları eklendi:
    - `RELIABILITY_STATE_STORE_DRIVER`
    - `RELIABILITY_STATE_STORE_TABLE`
    - `RELIABILITY_REPLAY_MAX_COUNT`
    - `RELIABILITY_REPLAY_BASE_BACKOFF_MS`
    - `RELIABILITY_REPLAY_MAX_BACKOFF_MS`
    - `RELIABILITY_REPLAY_JITTER_FACTOR`

### 3) Replay policy hardening
- `src/features/reliability/dlqReplayWorker.ts`
  - `ReplayPolicy` kontratı eklendi.
  - `computeReplayBackoffMs(...)` ile jittered exponential backoff eklendi.
  - `maxReplayCount` kontrolü eklendi.
  - Poison-message quarantine modeli eklendi:
    - max cap aşımı -> `max_replay_cap_reached`
    - fatal classification -> `poison_message_fatal_error`

### 4) Telemetry enrichment
- `src/features/reliability/alertDispatcherWorker.ts`
  - attempt-level telemetry eklendi (`attempt`, `latencyMs`, `failureClassification`).
- `src/features/reliability/dlqReplayWorker.ts`
  - replay tick telemetry enrich edildi:
    - `attemptLatencyMs`
    - `failureClassificationTags`
    - `quarantinedCount`

### 5) Integration docs/tests
- Yeni dokümanlar:
  - `docs/REPLAY_POLICY_RLOOP-042.md`
  - `docs/RLOOP_042_NOTES.md`
- Güncellenen doküman:
  - `docs/CONNECTOR_RUNTIME_RLOOP-040.md`
- Testler:
  - `__tests__/dlqReplayWorker.rloop042.test.ts` (lightweight skeleton)
  - `__tests__/reliability.runtime.rloop041.test.ts` telemetry assertion güncellemesi
