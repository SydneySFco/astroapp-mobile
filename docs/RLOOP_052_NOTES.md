# RLOOP-052 Notes — GitHub API Publisher Integration Hardening

## Summary

RLOOP-051'de hazırlanan canary check publisher iskeleti, bu iterasyonda GitHub API entegrasyonuna yaklaştırıldı:

- Checks API için create/update client skeleton eklendi
- PR sticky comment için list/create/update akışı client tarafında modellendi
- Artifact store için GitHub Contents API tabanlı read/write draft akışı eklendi
- Retry/backoff + temel idempotency key/marker yaklaşımı uygulandı
- Secondary rate-limit handling davranışı dokümante edildi

## Implemented

1. `src/features/reliability/githubApi.ts`
   - `GitHubApiClient`
   - Checks API methods:
     - `createCheckRun(...)`
     - `updateCheckRun(...)`
   - PR comments methods:
     - `listPullRequestComments(...)`
     - `createPullRequestComment(...)`
     - `updatePullRequestComment(...)`
   - Contents API methods (artifact draft):
     - `getRepoContent(...)`
     - `putRepoContent(...)`
   - Retry policy:
     - exponential backoff + jitter
     - `Retry-After` / `X-RateLimit-Reset` parsing
     - retryable status: `429`, `5xx`, and `403 secondary rate limit`

2. `src/features/reliability/canaryCheckPublisher.ts`
   - Check payload'a `external_id` üretimi eklendi (`buildCanaryCheckExternalId`)
   - Sticky comment için API-level upsert helper eklendi (`upsertCanaryStickyComment`)
   - Marker tabanlı tek yorum stratejisi korundu

3. `src/features/reliability/artifactStore.ts`
   - `GitHubArtifactStore` artık read/write için `GitHubApiClient` kullanıyor
   - Path standardı: `<artifactNamePrefix>/<pointer.key>`
   - `write` akışında mevcut SHA okunup Contents API PUT ile upsert yapılıyor

## Idempotency Strategy (Draft)

- Check-run: `external_id = canary-check:<policy>:<runId>:<status>`
- PR comment: marker (`CANARY_STICKY_COMMENT_MARKER`) + bot author + idempotency header key
- Artifact write: `artifact:<path>:<sha|create>` idempotency anahtarı

## Notes / Risks

- GitHub API `X-Idempotency-Key` davranışı endpoint bazında garanti vermez; asıl duplicate koruması için marker/external_id + read-before-write tercih edilmelidir.
- Contents API path encoding basit tutuldu; nested/special-char pathler için ek test önerilir.
- Draft seviyesinde telemetry (attempt count, rate-limit metrics) henüz eklenmedi.
