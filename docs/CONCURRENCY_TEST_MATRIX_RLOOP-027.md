# CONCURRENCY TEST MATRIX — RLOOP-027/RLOOP-028

## Goal
`finalize` adımında stale worker çakışmalarını lease token + lease revision ile bloklamak, duplicate finalize çağrılarını idempotent yapmak ve outcome contractını doğrulamak:

- `applied`
- `idempotent`
- `stale_blocked`

## Preconditions
- `claim_reconcile_job` çağrısı `lease_token` ve artan `lease_revision` üretir.
- `finalize_reconcile_job` optimistic ownership kontrolü yapar ve outcome döner.
- Test job başlangıcı: `status=queued`, `attempt_count=1`, `max_attempts=3`.

## Matrix

1. **Single worker happy path (success)**
   - W1 claim -> `(token=t1, rev=1)`
   - W1 finalize(succeeded, t1, rev1)
   - **Expected:** outcome=`applied`, `status=succeeded`, `leased_until=null`.

2. **Duplicate finalize replay (same worker, same lease)**
   - W1 claim -> `(t1, rev1)`
   - W1 finalize(succeeded, t1, rev1)
   - W1 same request tekrar yollar
   - **Expected:** ikinci çağrı outcome=`idempotent`, hata yok, state değişmez.

3. **Stale worker finalize after re-claim**
   - W1 claim -> `(t1, rev1)` lease expire
   - W2 claim -> `(t2, rev2)`
   - W1 finalize(failed/queued, t1, rev1)
   - **Expected:** outcome=`stale_blocked`, state update yok.

4. **Race finalize: two workers, different leases**
   - W1 claim `(t1, rev1)`
   - lease expire + W2 claim `(t2, rev2)`
   - W1 ve W2 finalize near-simultaneous
   - **Expected:** current owner finalize outcome=`applied`; stale olan outcome=`stale_blocked`.

5. **Retry path finalize (failed -> queued)**
   - W1 claim `(t1, rev1)`
   - W1 finalize(failed with decision `nextStatus=queued`, retry_after set)
   - same finalize replay
   - **Expected:** ilk finalize outcome=`applied`, ikinci outcome=`idempotent`, `retry_after` korunur.

6. **Dead-letter path finalize**
   - W1 claim `(t1, rev1)` and max attempt reached
   - W1 finalize(failed with `nextStatus=dead_lettered`)
   - replay same finalize
   - **Expected:** ikinci çağrı outcome=`idempotent`, `status=dead_lettered`, `finished_at` set.

7. **Tampered revision/token**
   - W1 claim `(t1, rev1)`
   - W1 finalize with `(t1, rev999)` or `(tampered token, rev1)`
   - **Expected:** outcome=`stale_blocked`.

## Observability checks
- Telemetry `reconcile_job_claimed` includes `leaseToken`, `leaseRevision`.
- Telemetry `reconcile_job_finalized` includes `outcome` (`applied|idempotent`) for accepted finalizations.
- Stale conflicts emit dedicated event:
  - `reconcile_job_finalize_stale_conflict`
  - counter: `reconcile_job_finalize_stale_conflict_count`

## CI-friendly test approach
- Unit-level deterministic tests for runtime telemetry routing and outcome handling.
- Integration tests (DB-backed) nightly or gated pipeline stage.
- Keep PR checks lightweight: `lint + typecheck + targeted unit tests`.

## Validation commands
- `yarn lint`
- `yarn typecheck`
