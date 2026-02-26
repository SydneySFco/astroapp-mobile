# RLOOP-038 Notes

## Yapılanlar

1. **Ground-truth artifact pipeline (draft)**
   - Yeni script: `scripts/build-groundtruth-artifact-rloop038.py`
   - Akış standardı: `source -> transform -> artifact`
   - Nightly/weekly cadence desteklendi (`--cadence nightly|weekly`)
   - Artifact path standardı:
     - `reports/groundtruth-artifacts/<cadence>/<YYYY-MM-DD>/groundtruth-snapshot.json`
   - Min sample-size guard eklendi:
     - global guard (`--global-min-samples`)
     - class override (`--min-class-samples class:min,...`)
     - opsiyonel hard-fail (`--fail-on-guard`)

2. **Drift alert routing**
   - Yeni script: `scripts/route-drift-alerts-rloop038.py`
   - Moving average + delta gate yaklaşımı uygulandı.
   - Severity seviyeleri:
     - `ok`
     - `warn`
     - `critical`
   - Severity’e göre route seçimi:
     - warn -> `--warn-route`
     - critical -> `--critical-route`

3. **Workflow update**
   - `.github/workflows/nightly-concurrency-harness.yml` genişletildi.
   - Reliability eval sonrasında:
     - ground-truth snapshot build
     - snapshot schema validation
     - drift alert routing
   - Pazar günleri otomatik `weekly` snapshot üretimi eklendi.
   - Yeni artifact çıktıları upload kapsamına alındı.

4. **Docs + CI docs update**
   - Yeni doküman: `docs/RELIABILITY_PIPELINE_RLOOP-038.md`
   - CI gate dokümanı RLOOP-038 pipeline/drift adımları ile güncellendi.

5. **Optional automation skeleton**
   - Yeni script: `scripts/validate-groundtruth-artifact-schema-rloop038.py`
   - Contract alanları ve class consistency kontrolü yapar.
