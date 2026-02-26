# RLOOP-029 Notes — DB-backed Concurrency Harness + Nightly CI Draft

## Summary
Bu iterasyonda concurrency doğrulama yaklaşımı unit/skeleton seviyesinden DB-backed harness planına taşındı ve nightly pipeline için workflow taslağı eklendi.

Teslim edilenler:
1. DB-backed harness yaklaşımı ve script skeleton
2. Nightly CI workflow taslağı (manual + schedule)
3. Secret/env gereksinimleri
4. stale conflict ratio için operasyonel alarm eşikleri

## Changes

### 1) DB-backed harness plan + script skeleton
- Yeni doküman:
  - `docs/DB_CONCURRENCY_HARNESS_RLOOP-029.md`
- Yeni script skeleton:
  - `scripts/concurrency-harness-rloop029.sh`

Planın ana prensipleri:
- Ephemeral schema: her run için `harness_<timestamp>_<rand>` schema
- Seed: schema içinde izole `reconcile_jobs` tablosu + deterministic job set
- Parallel finalize race: N worker aynı job id üzerinde finalize RPC/SQL çağrısı
- Outcome raporu: `applied:idempotent:stale_blocked` dağılımı + stale ratio

### 2) Nightly CI workflow draft
- Yeni workflow:
  - `.github/workflows/nightly-concurrency-harness.yml`

Tetikleyiciler:
- `workflow_dispatch` (manuel)
- `schedule` (gece UTC cron)

Job akışı:
- checkout + node setup + yarn install
- harness script çalıştırma
- sonucu artifact olarak yükleme

### 3) Ops thresholds (stale conflict ratio)
Öneri eşikler dokümana işlendi:
- **Healthy:** `< 5%`
- **Watch:** `>= 5% && < 15%`
- **Alert:** `>= 15%`
- **Critical:** `>= 30%`

Ek guardrail:
- `applied_count == 0` ve toplam deneme > 0 ise alarm
- Ani sıçrama (7-gün baseline’a göre +2x) uyarısı

## Validation
- `yarn lint`
- `yarn typecheck`

## Follow-up (RLOOP-030 suggestion)
- Harness script’i gerçek Supabase RPC (`finalize_reconcile_job`) çağrısına bağlayıp:
  - JSON raporunu parse eden assertion katmanı
  - GitHub Action’da threshold breach durumunda build fail
  - trend çıktısını (7 günlük) artifact + Slack/ops webhook’a taşıma
