# RLOOP-037 Notes

## Yapılanlar

1. **Online calibration apply path (harness runtime)**
   - `scripts/concurrency-harness-rloop029.sh` içine `CALIBRATION_METHOD` eklendi.
   - Yeni method yolu:
     - `CALIBRATION_METHOD=groundtruth`
     - `method=isotonic` veya `method=logistic` içeren calibration JSON güvenli parse edilip uygulanır.
   - Güvenli parse yaklaşımı:
     - tip/format kontrolü (`dict/list`)
     - sayısal alanlar için `safe_float`
     - skorlar için `clamp`
     - parse/apply hatasında fallback + `calibration.error`

2. **Reliability gate (CI)**
   - Yeni script: `scripts/reliability-gate-rloop037.py`
   - `macro_ece` için warn/fail threshold bandları eklendi.
   - Fail bandında script non-zero döner => CI step fail olur (job red).
   - Gate detayı artifact dosyaları:
     - `reports/reliability-gate-rloop037.json`
     - `reports/reliability-gate-rloop037.md`

3. **Drift reporting (time-sliced class-wise ECE trend)**
   - `scripts/eval-reliability-rloop036.py` genişletildi.
   - Yeni parametreler:
     - `--time-field`
     - `--slice-by day|week|month`
   - Yeni çıktı alanı:
     - `classwise_ece_trend.<class>[]` (`slice`, `ece`, `count`)

4. **Workflow entegrasyonu**
   - `.github/workflows/nightly-concurrency-harness.yml`:
     - reliability warn/fail inputs eklendi (workflow_dispatch)
     - reliability eval + gate adımı eklendi
     - reliability çıktı/artifact yükleme eklendi

## Not
- CI reliability gate’i deterministik çalışsın diye örnek dataset eklendi:
  - `reports/incidents-groundtruth.sample.jsonl`
