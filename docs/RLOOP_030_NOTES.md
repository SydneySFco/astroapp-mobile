# RLOOP-030 Notes — Harness RPC Wiring + Strict CI Assertions + Notifications

## Summary
RLOOP-029’daki dry/skeleton harness, gerçek RPC outcome sayımına yaklaşacak şekilde adapter contract ile genişletildi; nightly workflow assertion-breach durumunda fail edecek hale getirildi.

## Delivered

1. **Harness RPC wiring + adapter contract**
   - `scripts/concurrency-harness-rloop029.sh`
   - `HARNESS_MODE` desteği: `auto|dry|rpc_http|command`
   - `rpc_http` modunda `finalize_reconcile_job` REST RPC çağrısı
   - `command` modunda JSON contract (`{"outcome":"..."}`)
   - outcome sayaçları artık gerçek response’tan türetiliyor (mümkün olan env’de)

2. **Strict CI assertions**
   - `applied_count == 0` guard fail
   - `stale_conflict_ratio >= STALE_RATIO_FAIL_THRESHOLD` fail
   - script assertion breach’te non-zero exit code döndürüyor

3. **Artifact + trend standardı**
   - standard JSON rapor: outcomes + ratios + assertions + trend
   - `reports/concurrency-harness-history.ndjson` append
   - önceki run stale ratio ile basit historical karşılaştırma notu

4. **Notifications draft (optional)**
   - workflow’de `CONCURRENCY_HARNESS_WEBHOOK_URL` varsa webhook notify
   - kısa status payload: job status, outcome dağılımı, stale ratio, run URL

5. **Docs update**
   - `docs/DB_CONCURRENCY_HARNESS_RLOOP-029.md` RLOOP-030 delta ile güncellendi

## Validation
- `yarn lint`
- `yarn typecheck`

## Next suggestion (RLOOP-031)
- Ephemeral DB schema + deterministic seed/teardown’i gerçek migration/fixture adımlarıyla tamamlayıp harness’i tamamen production-like hale getirmek.