# RLOOP-049 Notes — Non-prod DB Canary Lane + Required Drift Check Draft

## Summary

RLOOP-049 ile fault-harness + migration/grant drift kontrolleri non-prod canary lane'e taşınacak şekilde draftlandı.

## Delivered

1. **Canary lane workflow draft**
   - `.github/workflows/nonprod-db-canary-lane.yml`
   - Trigger: `workflow_dispatch` + nightly schedule
   - Non-prod DB erişimli job: `SUPABASE_NONPROD_DB_URL` secret ile fault harness çalıştırma
   - Secret requirements step açıkça loglanır

2. **Drift check hardening (warn/fail policy)**
   - `scripts/check-migration-grant-drift-rloop048.py` policy-aware hale getirildi
   - `--policy warn|fail` destekler
   - JSON + Markdown rapor üretir
   - `warn` modunda drift tespit edilse de lane devam eder; `fail` modunda gate kırılır

3. **Artifact standard + trend summary**
   - `scripts/build-canary-summary-rloop049.py`
   - Standart output set:
     - `fault-harness.raw.jsonl`
     - `drift-check.json` / `drift-check.md`
     - `canary-summary.json` / `canary-summary.md`
     - `canary-trend.md`
     - `reports/canary/history/nonprod-db-canary-history.ndjson`

4. **Docs updates**
   - `docs/CANARY_LANE_RLOOP-049.md` eklendi
   - `docs/CI_QUALITY_GATES_RLOOP-014.md` canary/drift required-check hazırlığı ile güncellendi

## Operational Note

Başlangıç fazında default `drift_policy=warn` seçildi (false-positive riskini azaltmak için). Branch protection required-check modeline geçerken `fail` moduna yükseltme önerilir.
