# RLOOP-031 Notes — Ephemeral Schema + Deterministic Seed/Teardown Harness

## Summary
RLOOP-030’daki adapter/strict assertion temeli, production-like fixture lifecycle’e yaklaştırıldı:

- ephemeral schema create/drop akışı
- deterministic fixture üretimi (job/lease/revision)
- teardown guarantee (EXIT trap + drop denemesi)
- unknown fallback oranını düşürmeye yönelik sınıflandırma + assertion
- JSON rapora seed/schema metadata alanları

## Delivered

1. **Harness enhancement** (`scripts/concurrency-harness-rloop029.sh`)
   - `HARNESS_USE_EPHEMERAL_SCHEMA=1` ile ephemeral schema create/drop lifecycle
   - schema name sanitization (`SCHEMA_SAFE`) + cleanup trap
   - deterministic seed key üretimi (`HARNESS_SEED_NAMESPACE` + timestamp/workload)
   - fixture alanlarını otomatik üretim:
     - `HARNESS_JOB_ID`
     - `HARNESS_LEASE_TOKEN`
     - `HARNESS_LEASE_REVISION`
   - opsiyonel SQL seed (`SUPABASE_DB_URL` varsa `public.reconcile_jobs` upsert)

2. **Production-like race inputs (auto fixture wiring)**
   - `HARNESS_AUTO_FIXTURE_INPUTS=1` default
   - env verilmezse deterministic üretim, verilirse override desteği
   - RPC payload seed edilen fixture ile otomatik dolduruluyor

3. **Assertion/reporting improvements**
   - stale/error ipuçlarından `stale_blocked` inference ile unknown azaltma
   - yeni assertion:
     - `FAIL_ON_UNKNOWN_RATIO_BREACH` (default: 1)
     - `UNKNOWN_RATIO_FAIL_THRESHOLD` (default: 0.0500)
   - JSON rapora yeni metadata:
     - `seed.*`
     - `schema_lifecycle.*`

4. **Docs**
   - `docs/DB_CONCURRENCY_HARNESS_RLOOP-029.md` güncellendi (RLOOP-031 delta)
   - `docs/EPHEMERAL_SCHEMA_HARNESS_RLOOP-031.md` eklendi

## Validation
- `yarn lint`
- `yarn typecheck`

## Next suggestion (RLOOP-032)
- Harness’i gerçek parallel finalize yarışına geçirmek (eşzamanlı worker process/HTTP fan-out), run başına p95 latency + outcome sequence telemetry eklemek.