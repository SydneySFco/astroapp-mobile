# CONCURRENCY TEST MATRIX — RLOOP-027

## Goal
`finalize` adımında stale worker çakışmalarını lease token + lease revision ile bloklamak ve aynı finalize çağrısını idempotent yapmak.

## Preconditions
- `claim_reconcile_job` çağrısı `lease_token` ve artan `lease_revision` üretir.
- `finalize_reconcile_job` optimistic ownership kontrolü yapar.
- Test job başlangıcı: `status=queued`, `attempt_count=1`, `max_attempts=3`.

## Matrix

1. **Single worker happy path (success)**
   - W1 claim -> `(token=t1, rev=1)`
   - W1 finalize(succeeded, t1, rev1)
   - **Expected:** `status=succeeded`, `leased_until=null`, finalize accepted.

2. **Duplicate finalize replay (same worker, same lease)**
   - W1 claim -> `(t1, rev1)`
   - W1 finalize(succeeded, t1, rev1)
   - W1 same request tekrar yollar
   - **Expected:** ikinci çağrı idempotent no-op, hata yok, state değişmez.

3. **Stale worker finalize after re-claim**
   - W1 claim -> `(t1, rev1)` lease expire
   - W2 claim -> `(t2, rev2)`
   - W1 finalize(failed/queued, t1, rev1)
   - **Expected:** stale finalize blocked (`stale finalize attempt blocked`).

4. **Race finalize: two workers, different leases**
   - W1 claim `(t1, rev1)`
   - lease expire + W2 claim `(t2, rev2)`
   - W1 ve W2 finalize near-simultaneous
   - **Expected:** yalnız valid current lease sahibi finalize eder; stale olan bloklanır.

5. **Retry path finalize (failed -> queued)**
   - W1 claim `(t1, rev1)`
   - W1 finalize(failed with decision `nextStatus=queued`, retry_after set)
   - same finalize replay
   - **Expected:** ilk finalize accepted, ikinci finalize idempotent, `retry_after` korunur.

6. **Dead-letter path finalize**
   - W1 claim `(t1, rev1)` and max attempt reached
   - W1 finalize(failed with `nextStatus=dead_lettered`)
   - replay same finalize
   - **Expected:** second call idempotent, `status=dead_lettered`, `finished_at` set.

7. **Tampered revision/token**
   - W1 claim `(t1, rev1)`
   - W1 finalize with `(t1, rev999)` or `(tampered token, rev1)`
   - **Expected:** blocked as stale/ownership mismatch.

## Observability checks
- Telemetry `reconcile_job_claimed` includes `leaseToken`, `leaseRevision`.
- Telemetry `reconcile_job_finalized` emitted once per worker attempt; duplicate submit upstream olabilir ama DB state deterministic kalır.

## Validation commands
- `yarn lint`
- `yarn typecheck`
