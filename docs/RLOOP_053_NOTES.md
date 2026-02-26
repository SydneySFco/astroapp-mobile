# RLOOP-053 Notes — Publisher Runtime Wiring + Observability + Dry/Live Controls

## Objective

Canary publisher bileşenlerini runtime orkestrasyonuna bağlamak, güvenli dry/live kontrolünü eklemek ve operasyonel metric yüzeyini genişletmek.

## Delivered

1. **Runtime orchestrator skeleton**
   - `src/features/reliability/canaryPublisherRuntime.ts`
   - Tek akışta şu adımları koordine eder:
     - check-run create/update
     - sticky comment upsert
     - artifact sync
   - `existingCheckRunId` varsa update, yoksa create davranışı

2. **Dry/Live mode controls (safe default dry)**
   - `resolveCanaryCheckPublisherRuntimeConfig(...)` genişletildi
   - Yeni env/config anahtarları:
     - `CANARY_PUBLISHER_MODE=dry|live` (default: `dry`)
     - `CANARY_ARTIFACT_SYNC_ENABLED=true|false`
   - Dry mode'da network side effect yok; yalnızca plan/result döner

3. **Observability metrics**
   - Metric isimleri eklendi:
     - `github_api_attempt_count`
     - `github_api_rate_limit_hits`
     - `publisher_idempotent_dedupe_count`
   - Standard dimensions: `action`, `outcome`, `endpoint`
   - `createGitHubTelemetryMetricBridge(...)` ile GitHub API telemetry -> metric event map'i
   - `GitHubApiClient` telemetry callback desteği:
     - endpoint bazlı success/retry/failure/rate_limited denemeleri

4. **Idempotent dedupe control**
   - `runCanaryPublisherRuntime` içinde `external_id` tabanlı set dedupe
   - Duplicate publish tespitinde `publisher_idempotent_dedupe_count` emit edilir

5. **Tests**
   - `__tests__/canaryPublisherRuntime.rloop053.test.ts`
   - Kapsam:
     - default config dry mode
     - dry mode side-effect suppression
     - telemetry bridge metric emission
     - idempotent dedupe behavior

## Validation

- `yarn lint`
- `yarn typecheck`
