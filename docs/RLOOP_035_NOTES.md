# RLOOP-035 Notes — Confidence Calibration + Blocking Graph Enrichment

## Summary
Bu iterasyonda iki ana iyileştirme eklendi:
1. `contention_confidence` için **offline kalibrasyon** akışı
2. Live lock collector + parser + harness tarafında **blocking graph summary** enrichment

## What changed
- Yeni script: `scripts/calibrate-contention-confidence-rloop035.py`
  - Input: `reports/concurrency-harness-history.ndjson`
  - Output: `reports/confidence-calibration.json`
  - Per-class affine param üretir: `score' = clamp(score * scale + shift)`
- Harness (`scripts/concurrency-harness-rloop029.sh`):
  - `CONFIDENCE_CALIBRATION_FILE` env desteği eklendi
  - Confidence raporunda **before/after calibration** alanları eklendi
  - `db-lock` confidence scoring’e `blocking_graph_density` sinyali eklendi
  - `contention_correlation.blocking_graph_summary` eklendi
  - `db_lock_accuracy_notes` alanı eklendi
- Collector (`scripts/live-lock-telemetry-collector-rloop034.sh`):
  - `pg_blocking_pids()` tabanlı blocker/blocked edge sayımı
  - NDJSON sample’a `blocking_graph_summary` eklendi
- Parser (`scripts/lock-telemetry-parser-rloop033.py`):
  - Parse çıktısına graph summary alanları eklendi

## Expected reporting additions
- `contention_confidence.confidence_before_calibration`
- `contention_confidence.confidence_after_calibration`
- `contention_confidence.calibration`
- `contention_correlation.blocking_graph_summary`

## Validation
- `yarn lint`
- `yarn typecheck`

## Follow-up suggestion (RLOOP-036)
- Labelled incident ground-truth ile calibration’ı heuristikten supervised (isotonic/logistic) yaklaşıma taşı.
- Blocking graph tarafında relation/query fingerprint enrichment ekleyip lock-chain root cause attribution doğruluğunu artır.
