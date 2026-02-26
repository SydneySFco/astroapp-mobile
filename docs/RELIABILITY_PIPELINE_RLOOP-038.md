# Reliability Pipeline — RLOOP-038

## Hedef

Reliability gate'i sample dosyaya bağımlı “tek adım” kontrolden çıkarıp, **ground-truth artifact pipeline** + **drift alert routing** yaklaşımına taşımak.

## Pipeline Akışı (source -> transform -> artifact)

1. **Source**
   - Input: labelled incidents JSONL
   - Örnek: `reports/incidents-groundtruth.sample.jsonl`

2. **Transform**
   - Class bazında incident sayıları çıkarılır.
   - Min sample-size guard kuralları uygulanır.
   - Guard sonucu artifact içine gömülür (`guard_failed`).

3. **Artifact**
   - Kontratlı snapshot JSON üretilir.
   - Standart path:
     - `reports/groundtruth-artifacts/<cadence>/<YYYY-MM-DD>/groundtruth-snapshot.json`
   - `cadence`: `nightly` veya `weekly`

## Artifact Contract Standardı

Top-level:
- `contract_version`
- `pipeline`
- `summary`
- `guards`

### `pipeline`
- `source`
- `transform`
- `artifact`
- `cadence`
- `snapshot_ts`

### `summary`
- `incidents`
- `classes[]`
- `class_counts{}`

### `guards`
- `global_min_samples`
- `class_overrides{}`
- `class_evaluation{ class -> {observed,min_required,passed} }`
- `guard_failed`

## Min Sample-Size Guards

- Varsayılan global guard: `--global-min-samples` (default: `25`)
- Class override formatı:
  - `--min-class-samples "db-lock:30,network:15,unknown:40"`
- `--fail-on-guard` kullanılırsa, herhangi bir class guard fail durumunda script non-zero döner.

## Drift Alert Routing

Kaynak rapor: `scripts/eval-reliability-rloop036.py` çıktısı (`classwise_ece_trend`).

Sinyal üretimi:
- `latest_ece`
- `moving_avg_ece` (önceki slice'lar üzerinden pencere ortalaması)
- `delta = latest_ece - moving_avg_ece`

Gate:
- **Warn**: `latest_ece >= warn_abs` veya `delta >= warn_delta`
- **Critical**: `latest_ece >= critical_abs` veya `delta >= critical_delta`

Routing:
- Warn -> `--warn-route`
- Critical -> `--critical-route`

Output artifact:
- `reports/drift-alert-routing-rloop038.json`
- `reports/drift-alert-routing-rloop038.md`

## Otomasyon Scriptleri

- `scripts/build-groundtruth-artifact-rloop038.py`
- `scripts/validate-groundtruth-artifact-schema-rloop038.py`
- `scripts/route-drift-alerts-rloop038.py`

## CI Entegrasyon Özeti

Nightly workflow içinde:
1. Reliability eval (`eval-reliability-rloop036.py`)
2. Ground-truth artifact build (`build-groundtruth-artifact-rloop038.py`)
3. Artifact schema validation (`validate-groundtruth-artifact-schema-rloop038.py`)
4. Reliability gate (`reliability-gate-rloop037.py`)
5. Drift alert routing (`route-drift-alerts-rloop038.py`)

Ek olarak pazar günü (UTC) `weekly` snapshot da üretilir.
