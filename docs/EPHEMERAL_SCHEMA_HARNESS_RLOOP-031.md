# Ephemeral Schema Harness — RLOOP-031

## Amaç
Concurrency harness run’larını production-like fixture lifecycle’e yaklaştırmak:
- run başında izole schema üretmek
- deterministic test fixture üretmek
- run sonunda teardown garantilemek

## Environment Variables

### Core
- `HARNESS_MODE=auto|dry|rpc_http|command`
- `WORKERS` (default: `20`)
- `ITERATIONS` (default: `5`)

### Ephemeral schema + seed
- `HARNESS_USE_EPHEMERAL_SCHEMA` (default: `1`)
- `HARNESS_SCHEMA_PREFIX` (default: `harness`)
- `HARNESS_SEED_NAMESPACE` (default: `rloop031`)
- `HARNESS_AUTO_FIXTURE_INPUTS` (default: `1`)
- `SUPABASE_DB_URL` (varsa SQL seed + schema lifecycle aktif)

### RPC http mode
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Command mode
- `FINALIZE_RPC_ADAPTER_CMD` (JSON çıktısı: `{"outcome":"applied|idempotent|stale_blocked"}`)

### Assertions
- `FAIL_ON_APPLIED_ZERO` (default: `1`)
- `FAIL_ON_THRESHOLD_BREACH` (default: `1`)
- `STALE_RATIO_FAIL_THRESHOLD` (default: `0.3000`)
- `FAIL_ON_UNKNOWN_RATIO_BREACH` (default: `1`)
- `UNKNOWN_RATIO_FAIL_THRESHOLD` (default: `0.0500`)

## Lifecycle
1. `SCHEMA_SAFE` hesaplanır (sanitized)
2. `create schema if not exists "SCHEMA_SAFE"`
3. deterministic fixture alanları üretilir (`job_id`, `lease_token`, `lease_revision`)
4. `public.reconcile_jobs` içine deterministic upsert (DB URL varsa)
5. harness attempts çalışır
6. `EXIT trap` ile `drop schema if exists "SCHEMA_SAFE" cascade`

## JSON Report Additions
- `seed.namespace`
- `seed.key`
- `seed.job_id`
- `seed.lease_token`
- `seed.lease_revision`
- `seed.seed_sql_applied`
- `seed.seed_rows_inserted`
- `schema_lifecycle.ephemeral_enabled`
- `schema_lifecycle.created`
- `schema_lifecycle.dropped`

## Notlar
- `finalize_reconcile_job` halen `public.reconcile_jobs` üzerinden çalıştığı için seed public tabloya yazılır.
- Ephemeral schema lifecycle bu iterasyonda isolation metadata + teardown guarantee sağlar; fonksiyon/search_path isolation bir sonraki adım olabilir.