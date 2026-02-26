# RLOOP-048 Notes — Ephemeral Fault-Injection E2E Harness + Drift Guard

## Summary

RLOOP-048 kapsamında RPC atomicity ve operational safety için DB-near e2e taslak katmanı eklendi:

1. Ephemeral schema fault-injection harness (audit/state failpoint)
2. Migration/grant drift guard script taslağı
3. Harness outcome parser + lightweight test skeleton
4. RLOOP-047 rollout checklist güncellemesi

## Added

- `scripts/run-db-fault-harness-rloop048.sh`
  - Geçici schema oluşturur
  - Controlled failpoint senaryolarını koşturur
  - JSON output üretir
- `scripts/check-migration-grant-drift-rloop048.py`
  - Son migration version drift check (`EXPECTED_MIGRATION_VERSION` opsiyonel)
  - Function/grant coverage coarse check
- `src/features/reliability/faultHarnessOutcomeParser.ts`
  - Harness çıktısını expectation set ile parse + validate eder
- `__tests__/faultHarnessOutcomeParser.rloop048.test.ts`
  - Parser için lightweight contract testi
- `docs/DB_FAULT_INJECTION_E2E_RLOOP-048.md`
  - Senaryo ve çalışma notları

## Caveats

- Drift guard, grant coverage için string/regex bazlı coarse kontrol yapar (SQL parser değil).
- Harness SQL, production fonksiyonunun birebir kopyası değil; rollback davranışı odaklı doğrulama sağlar.

## CI Draft Integration

Örnek adımlar:

```bash
python3 scripts/check-migration-grant-drift-rloop048.py
# DB erişimli ortamda opsiyonel:
# DATABASE_URL=$SUPABASE_DB_URL ./scripts/run-db-fault-harness-rloop048.sh
```

Öneri: drift guard’ı required check yap; DB harness’i initially non-blocking nightly lane’de çalıştır.
