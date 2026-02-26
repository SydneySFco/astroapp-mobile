# Confidence Calibration (RLOOP-035)

## Goal
Historical harness run'larından contention class confidence skorlarını daha iyi kalibre etmek.

## Data source
- `reports/concurrency-harness-history.ndjson`

Her satır (run report) için kullanılan alanlar:
- `contention_classes` (proxy actual class)
- `contention_confidence.contention_class_confidence` veya `confidence_before_calibration`

## Method (offline draft)
`calibrate-contention-confidence-rloop035.py` basit bir affine yaklaşım üretir:

- Her class için:
  - positive set: dominant/actual class = class
  - negative set: dominant/actual class != class
  - `pos_mean`, `neg_mean` hesaplanır
- Parametreler:
  - `scale = clamp(0.9 + max(pos_mean - neg_mean, 0.05))`
  - `shift = clamp(0.05 - neg_mean*0.15)`
- Runtime uygulama:
  - `calibrated = clamp(raw * scale + shift)`

## Run
```bash
python3 scripts/calibrate-contention-confidence-rloop035.py \
  --history reports/concurrency-harness-history.ndjson \
  --out reports/confidence-calibration.json
```

Harness çalıştırırken:
```bash
CONFIDENCE_CALIBRATION_FILE=reports/confidence-calibration.json \
./scripts/concurrency-harness-rloop029.sh
```

## Output fields
- `contention_confidence.confidence_before_calibration`
- `contention_confidence.confidence_after_calibration`
- `contention_confidence.calibration`

## RLOOP-036 update (ground-truth calibration path)
Proxy-label affine calibration yanında labelled incident dataset ile supervised calibration skeleton eklendi:

```bash
python3 scripts/fit-groundtruth-calibration-rloop036.py \
  --input reports/incidents-groundtruth.jsonl \
  --method isotonic \
  --out reports/groundtruth-calibration-rloop036.json
```

Alternatif:
- `--method logistic` (Platt-style, class one-vs-rest)

Ground-truth satır formatı:
```json
{"incident_id":"inc-001","actual_class":"db-lock","scores":{"network":0.11,"db-lock":0.82,"stale-race":0.04,"unknown":0.03}}
```

## Notes / limitations
- Bu iterasyonda prod tarafında hâlâ heuristic confidence pipeline kullanılıyor; ground-truth calibration output'u entegrasyon için hazır skeleton.
- `db-lock` confidence doğruluğu lock sampling yoğunluğu + spike korelasyonu + blocking graph yoğunluğu + top blocker fingerprint coverage ile artar.
