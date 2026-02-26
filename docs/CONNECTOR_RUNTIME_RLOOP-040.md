# Connector Runtime Integration — RLOOP-040

## Amaç

RLOOP-039 ile gelen source connector abstraction'ını runtime katmanına bağlayan çalıştırılabilir bir taslak oluşturmak.

Eklenen TS modülleri:
- `src/features/reliability/connectorRuntime.ts`
- `src/features/reliability/stateStore.ts`

## Runtime Adapter Skeleton

`runConnectorRuntime()` akışı:
1. `WatermarkStateStore` üzerinden `cursor_previous` okunur.
2. Connector adapter (`db-view` veya `object-store`) `readSince(cursor)` çağırır.
3. `sourceWatermark` ilerlemişse state-store'a persist edilir.
4. Sonuçta row'lar + cursor bilgisi runtime'a döner.

## Connector Adapter'ları

Draft factory fonksiyonları:
- `createDbViewConnector(...)`
- `createObjectStoreConnector(...)`

Bu factory'ler runtime için ortak `RuntimeSourceConnector` kontratını üretir. Gerçek DB/object-store IO implementasyonu infra katmanında enjekte edilir.

## Watermark Durability Abstraction

`WatermarkStateStore` kontratı:
- `get(key)`
- `set(record)`

Taslak implementasyonlar:
- `FileWatermarkStateStore`
  - Dosya IO callback'leri dependency olarak alır (runtime/env bağımsız)
- `DbWatermarkStateStorePlaceholder`
  - DB `selectByKey/upsert` callback'leriyle placeholder

## RLOOP-041 Güncellemesi

RLOOP-041 ile runtime operationalization bir adım ileri taşındı:

- `SqlWatermarkStateStoreAdapter` eklendi (`src/features/reliability/stateStore.ts`)
- Supabase/Postgres-friendly factory'ler eklendi:
  - `createSupabaseWatermarkStateStore(...)`
  - `createPostgresWatermarkStateStore(...)`
- DB row modeli normalize edildi:
  - `key`
  - `cursor`
  - `updated_at`

Bu sayede file/db placeholder'larla aynı `WatermarkStateStore` interface korunurken
infra tarafında callback enjeksiyonu ile doğrudan Supabase/pg binding yapılabilir hale geldi.

## Integration Test Hardening (RLOOP-041)

Yeni lightweight test iskeleti:
- `__tests__/reliability.runtime.rloop041.test.ts`

Doğrulanan temel senaryolar:
1. connector cursor advance + watermark persist
2. suppression window davranışı
3. retry/backoff + DLQ fallback
