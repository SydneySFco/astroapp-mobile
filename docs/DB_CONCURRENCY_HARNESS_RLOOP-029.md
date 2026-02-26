# DB-backed Concurrency Harness (RLOOP-029)

## Purpose
`finalize_reconcile_job` concurrency davranışını gerçek DB seviyesinde doğrulamak ve nightly otomasyon için temel hazırlamak.

Hedef metrikler:
- outcome dağılımı: `applied:idempotent:stale_blocked`
- stale conflict ratio
- run-to-run drift gözlemi

---

## Scope
Bu doküman bir **plan + skeleton** sunar. Production-grade assertion/fail policy RLOOP-030’da sıkılaştırılacaktır.

### In Scope
- Ephemeral schema lifecycle (create/seed/drop)
- Parallel finalize race senaryoları
- Outcome aggregation + JSON report
- Nightly CI integration noktaları

### Out of Scope (RLOOP-030)
- Full SQL migration automation for harness tables
- Historical trend persistence (external TSDB/warehouse)
- Slack/PagerDuty integration

---

## Harness Architecture

### 1) Ephemeral schema strategy
Her run için izole bir schema oluşturulur:
- örnek: `harness_20260226_133700_ab12`

Adımlar:
1. `create schema if not exists <schema>`
2. Test tablosu/seed data oluştur
3. Concurrency race çalıştır
4. Sonuçları JSON raporla
5. `drop schema <schema> cascade`

Not:
- Script hata alsa bile cleanup için `trap` kullanılmalı.
- CI’da runlar birbiriyle çakışmasın diye schema adında timestamp+random tutulur.

### 2) Seed strategy
Minimum seed şeması:
- `reconcile_jobs` benzeri bir test tablosu
  - `id` (uuid)
  - `status`
  - `lease_token`
  - `version`
  - `finalized_at`

Seed set önerisi:
- Tek bir hot job id (race için)
- Ek olarak birkaç control row (opsiyonel)

### 3) Parallel finalize race
Aynı job üzerinde aynı anda finalize tetiklenir.

Parametreler:
- `workers` (örn. 20)
- `iterations` (örn. 5)

Beklenen davranış:
- İlk geçerli finalize: `applied`
- Aynı lease/version ile tekrarlar: `idempotent`
- stale lease/version ile gelenler: `stale_blocked`

### 4) Outcome aggregation
Her deneme için outcome toplanır:
- `applied_count`
- `idempotent_count`
- `stale_blocked_count`
- `total_attempts`

Derived metric:
- `stale_conflict_ratio = stale_blocked_count / total_attempts`

Output format (öneri):
```json
{
  "schema": "harness_20260226_133700_ab12",
  "workers": 20,
  "iterations": 5,
  "total_attempts": 100,
  "outcomes": {
    "applied": 5,
    "idempotent": 60,
    "stale_blocked": 35
  },
  "ratios": {
    "stale_conflict_ratio": 0.35
  }
}
```

---

## Ops Thresholds (stale conflict ratio)

Önerilen alarm seviyeleri:
- **Healthy:** `< 0.05`
- **Watch:** `>= 0.05 && < 0.15`
- **Alert:** `>= 0.15 && < 0.30`
- **Critical:** `>= 0.30`

Ek kurallar:
- `applied_count == 0 && total_attempts > 0` => doğrudan alarm
- 7 günlük baseline’a göre `>= 2x` artış => watch/alert escalation

Bu eşikler başlangıç önerisidir; prod traffic pattern’e göre kalibre edilmelidir.

---

## CI Integration Draft

Workflow: `.github/workflows/nightly-concurrency-harness.yml`

Trigger:
- nightly schedule (UTC)
- manual dispatch

Secrets/vars gereksinimleri:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- opsiyonel: `SUPABASE_DB_URL` (doğrudan psql/test client için)

CI job:
1. dependencies install
2. harness script execute
3. report artifact upload
4. (RLOOP-030) threshold breach ise fail

---

## Script Skeleton

Dosya: `scripts/concurrency-harness-rloop029.sh`

Bu script şu anda:
- env doğrular
- ephemeral schema adı üretir
- placeholder report üretir
- cleanup trap içerir

RLOOP-030’da gerçek DB/RPC çağrıları ve assert/fail logic eklenecektir.
