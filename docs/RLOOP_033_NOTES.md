# RLOOP-033 Notes — Multi-job Chaos Harness + Lock Correlation Draft

## Summary
RLOOP-032’deki tek-job odaklı parallel race harness, bu iterasyonda multi-job chaos senaryosuna genişletildi. Ayrıca lock telemetry korelasyon draft’ı ve contention sınıflandırması rapora eklendi.

## Delivered

1. **Multi-job chaos mode**
   - `JOB_POOL_SIZE` ile aynı anda yarışacak job sayısı
   - `WORKER_FAN_OUT` ile job başına eşzamanlı worker sayısı
   - iteration başına toplam attempt: `JOB_POOL_SIZE * WORKER_FAN_OUT`
   - deterministic fixture seeding her job için ayrı üretiliyor (`job_id/lease_token/lease_revision`).

2. **Contention classification**
   - Her attempt contention class etiketi alıyor:
     - `network`
     - `db-lock`
     - `stale-race`
     - `unknown`
   - Sınıflandırma raw RPC response/error hint’lerinden türetiliyor.

3. **Lock telemetry correlation draft**
   - Optional `LOCK_TELEMETRY_FILE` (NDJSON sample input)
   - Telemetry’den contention windows çıkarılıyor
   - `LATENCY_SPIKE_THRESHOLD_MS` üzerindeki spike’lar ile window korelasyonu hesaplanıyor
   - `contention_correlation` objesi rapora eklendi.

4. **Report extension**
   - Yeni alanlar:
     - `job_pool_metrics`
     - `contention_correlation`
     - `contention_classes`

## Validation
- `yarn lint`
- `yarn typecheck`

## Next suggestion (RLOOP-034)
- Telemetry collector’ı script’e dahil et (live pg sampling), run sırasında otomatik sample + merge; class ağırlıklarını historical baseline ile kalibre et ve CI alert payload’ına root-cause confidence skoru ekle.