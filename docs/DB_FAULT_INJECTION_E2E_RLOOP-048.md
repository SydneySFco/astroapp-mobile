# DB Fault-Injection E2E (Ephemeral Schema) — RLOOP-048

Amaç: `replay_quarantine_apply_admin_action` benzeri RPC akışında **DB-near atomic rollback** garantisini, kontrollü failpoint senaryoları ile doğrulamak.

## Harness

- Script: `scripts/run-db-fault-harness-rloop048.sh`
- Model: ephemeral schema (run başına geçici schema)
- Output: JSON satırları (scenario bazlı)

### Senaryolar

1. `happy_path`
   - Beklenti: state `redriven`, deduped `false`
2. `audit_insert_fail`
   - Enjeksiyon: `XX001`
   - Beklenti: transaction rollback, state `pending_review`, gate audit row `0`
3. `state_transition_fail`
   - Enjeksiyon: `XX002`
   - Beklenti: transaction rollback, state `pending_review`, gate audit row `0`

## Çalıştırma

```bash
DATABASE_URL=postgres://... ./scripts/run-db-fault-harness-rloop048.sh
```

Dry-run SQL çıktısı:

```bash
DATABASE_URL=postgres://... HARNESS_DRY_RUN=1 ./scripts/run-db-fault-harness-rloop048.sh
```

## Outcome parsing skeleton

- Parser: `src/features/reliability/faultHarnessOutcomeParser.ts`
- Test: `__tests__/faultHarnessOutcomeParser.rloop048.test.ts`

Parser, harness JSON output’unu expectation listesine göre doğrular. CI’de DB erişimi olmayan job’larda parser testleri hızlı smoke katmanı olarak kullanılabilir.

## Notlar

- Bu harness **draft** seviyesindedir; production migration SQL ile birebir aynı değildir.
- Hedef: rollback invariants’ını görünür ve tekrarlanabilir hale getirmek.
- Bir sonraki adım: gerçek migration fonksiyonuna parametrize failpoint (yalnızca non-prod) veya test-only wrapper yaklaşımı.
