# Reliability Pipeline — RLOOP-038 (+ RLOOP-039 hardening update)

## Hedef

Reliability gate'i sample dosyaya bağımlı “tek adım” kontrolden çıkarıp, **ground-truth artifact pipeline** + **drift alert routing** yaklaşımına taşımak.

RLOOP-039 ile bu akış production draft seviyesine genişletildi:
- source connector abstraction + watermark cursor
- retention/lineage metadata
- hardened alert payload + suppression + class route policy

## Pipeline Akışı (source -> transform -> artifact)

1. **Source**
   - RLOOP-038: labelled incidents JSONL
   - RLOOP-039: connector interface (jsonl / db-view draft / object-store draft)

2. **Transform**
   - Class bazında incident sayıları çıkarılır.
   - Min sample-size guard kuralları uygulanır.

3. **Artifact**
   - Kontratlı snapshot JSON üretilir.
   - Standart path:
     - `reports/groundtruth-artifacts/<cadence>/<YYYY-MM-DD>/groundtruth-snapshot.json`

## RLOOP-039 Artifact Contract Eklentileri

Top-level `metadata`:
- `run_id`
- `source_watermark`
- `checksum`
- `generated_at`
- `lineage.{upstream,stage,version}`
- `retention.{policy_days,cleanup_strategy}`

`pipeline` eklentileri:
- `source_connector`
- `source_uri`
- `watermark_field`
- `cursor_previous`
- `cursor_current`

## Retention + Cleanup

Policy önerisi:
- nightly: 30 gün
- weekly: 90 gün

Skeleton helper:
- `scripts/retention-lineage-helper-rloop039.py cleanup --keep-days <N> [--dry-run]`
- `scripts/retention-lineage-helper-rloop039.py validate-lineage`

## Drift Alert Routing (RLOOP-039)

Script:
- `scripts/route-drift-alerts-rloop039.py`

Hardening:
- webhook/slack standard payload
- dedup key + suppression window
- severity + class bazlı route table

Artifacts:
- `reports/drift-alert-routing-rloop039.json`
- `reports/drift-alert-routing-rloop039.slack.json`
- `reports/drift-alert-routing-rloop039.webhook.json`
- `reports/drift-alert-state-rloop039.json`

Policy detayı:
- `docs/ALERT_ROUTING_POLICY_RLOOP-039.md`

## Otomasyon Scriptleri

- `scripts/build-groundtruth-artifact-rloop039.py`
- `scripts/validate-groundtruth-artifact-schema-rloop039.py`
- `scripts/route-drift-alerts-rloop039.py`
- `scripts/retention-lineage-helper-rloop039.py`

## CI Entegrasyon Özeti

Nightly workflow içinde:
1. Reliability eval (`eval-reliability-rloop036.py`)
2. Ground-truth artifact build (RLOOP-039)
3. Artifact schema+lineage validation (RLOOP-039)
4. Reliability gate (`reliability-gate-rloop037.py`)
5. Drift alert routing (RLOOP-039)

Ek olarak pazar günü (UTC) `weekly` snapshot üretilir.
