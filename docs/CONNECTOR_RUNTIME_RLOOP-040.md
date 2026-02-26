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

## Sonraki Adım (RLOOP-041 öneri girdisi)

- `build-groundtruth-artifact-rloop039.py` ile bu TS runtime adapter katmanını aynı contract etrafında birleştirmek
- state-store için gerçek Supabase/Postgres implementasyonu eklemek
- runtime tick için integration test (cursor advance + idempotent replay)
