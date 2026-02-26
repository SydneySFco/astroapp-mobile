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

## Notes / limitations
- Bu iterasyonda ground-truth incident labels yok; `contention_classes` proxy label olarak kullanılıyor.
- Parametrik yaklaşım hızlı fakat kaba; labelled dataset büyüyünce isotonic/logistic calibration önerilir.
- `db-lock` confidence doğruluğu lock sampling yoğunluğu + spike korelasyonu + blocking graph yoğunluğuna bağlıdır.
