# Reliability Evaluation (RLOOP-036)

## Amaç
Confidence skorlarının gerçek olasılıklarla hizasını class bazında ölçmek.

## Girdi formatı (labelled incidents)
JSONL (incident başına 1 satır):

```json
{"incident_id":"inc-001","actual_class":"db-lock","scores":{"network":0.11,"db-lock":0.82,"stale-race":0.04,"unknown":0.03}}
```

- `actual_class`: ground-truth class
- `scores`: modelin class confidence skorları

## Metrikler
- **Class-wise reliability curve**: bin bazında `avg_conf` vs `emp_acc`
- **ECE (Expected Calibration Error)**: bin ağırlıklı |acc-conf|
- **macro_ece**: class ECE ortalaması

## Utility
```bash
python3 scripts/eval-reliability-rloop036.py \
  --input reports/incidents-groundtruth.jsonl \
  --bins 10 \
  --time-field timestamp \
  --slice-by day \
  --out reports/reliability-eval-rloop036.json
```

## Çıktı
- `classwise.<class>.curve[]`
- `classwise.<class>.ece`
- `macro_ece`
- `classwise_ece_trend.<class>[]`
  - `slice`
  - `ece`
  - `count`

## Yorumlama
- ECE düşükse (0'a yakın) confidence iyi kalibre.
- Yüksek ECE görülen class için isotonic/logistic recalibration önerilir.
