# RLOOP-039 Notes

## Yapılanlar

1. **Ground-truth pipeline production draft (source connector + watermark)**
   - Yeni script: `scripts/build-groundtruth-artifact-rloop039.py`
   - Source connector abstraction eklendi:
     - `jsonl`
     - `db-view` (draft; local sqlite destekli, prod adapter beklentisi dokümante)
     - `object-store` (draft; `file://` mirror üzerinden)
   - Watermark/read cursor yaklaşımı:
     - input cursor state: `--watermark-state`
     - incremental read: watermark-field bazlı
     - başarılı run sonrası cursor persist

2. **Retention + lineage metadata**
   - Artifact metadata alanları eklendi:
     - `run_id`
     - `source_watermark`
     - `checksum` (sha256, canonical json)
     - `generated_at`
   - Ek lineage:
     - `metadata.lineage.{upstream,stage,version}`
   - Retention policy alanı:
     - `metadata.retention.policy_days`
     - `metadata.retention.cleanup_strategy`

3. **Alert routing hardening**
   - Yeni script: `scripts/route-drift-alerts-rloop039.py`
   - Standart event payload üretimi (webhook/slack için)
   - Dedup/suppression window:
     - `--suppression-window-minutes`
     - state file: `reports/drift-alert-state-rloop039.json`
   - Severity + class bazlı route table:
     - default gömülü mapping
     - `--route-table` ile override

4. **Schema + lineage validation**
   - Yeni script: `scripts/validate-groundtruth-artifact-schema-rloop039.py`
   - RLOOP-039 contract + metadata doğrulaması

5. **Optional helper skeleton**
   - Yeni script: `scripts/retention-lineage-helper-rloop039.py`
   - Komutlar:
     - `cleanup` (time-based retention cleanup)
     - `validate-lineage` (metadata required fields kontrolü)

6. **Workflow update**
   - `.github/workflows/nightly-concurrency-harness.yml` RLOOP-039 scriptlerine geçirildi.
   - Upload artifact listesine yeni routing/state/watermark çıktıları eklendi.

## Notlar

- DB/view ve object-store connector'ları production adapter extension point olarak taslaklandı.
- CI şu anda sample JSONL ile çalışmaya devam ediyor; connector arayüzü prod source geçişi için hazırlandı.
