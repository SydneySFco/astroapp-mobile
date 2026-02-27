# RLOOP-036 Notes — Ground-truth Calibration + Reliability + Blocker Fingerprint

## Bu iterasyonda yapılanlar

1. **Ground-truth calibration skeleton**
   - Yeni script: `scripts/fit-groundtruth-calibration-rloop036.py`
   - Labelled incident JSONL formatı ile class başına calibration parametresi üretir.
   - Desteklenen yöntemler:
     - `--method isotonic` (PAV bin'leri)
     - `--method logistic` (1D Platt-style)

2. **Reliability evaluation utility**
   - Yeni script: `scripts/eval-reliability-rloop036.py`
   - Class-wise reliability curve + ECE + macro ECE hesaplar.

3. **Blocker fingerprint enrichment (safe redaction)**
   - `scripts/live-lock-telemetry-collector-rloop034.sh`:
     - `pg_blocking_pids()` edges üzerinden top blocker query fingerprint çıkarımı
     - raw query taşınmaz; sadece hash + query_family + redaction metadata
   - `scripts/concurrency-harness-rloop029.sh`:
     - telemetry örnekleri üzerinden top blocker fingerprint aggregation
     - `contention_correlation.blocking_graph_summary.top_blocker_fingerprint`
     - `contention_confidence.top_blocker_fingerprint`

4. **Alert payload enrichment**
   - `.github/workflows/nightly-concurrency-harness.yml` webhook text:
     - dominant contention class + confidence
     - top blocker fingerprint (kısaltılmış hash)

## Ground-truth format taslağı
Önerilen JSONL satırı:

```json
{"incident_id":"inc-001","actual_class":"db-lock","scores":{"network":0.11,"db-lock":0.82,"stale-race":0.04,"unknown":0.03},"meta":{"source":"incident-review","labeler":"oncall"}}
```

Zorunlu alanlar:
- `incident_id`
- `actual_class`
- `scores`

Opsiyonel:
- `meta` (label provenance)

## Sonraki adım notu
- Ground-truth dataset büyüdükçe calibration modeli için holdout split + drift takibi eklenmeli.
