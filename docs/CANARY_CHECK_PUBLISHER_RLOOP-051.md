# Canary Check Publisher — RLOOP-051 Draft (+ RLOOP-052 update)

## Purpose

`nonprod-db-canary` lane çıktısını PR yüzeyinde iki kanaldan yayınlamak:

1. GitHub check-run (`nonprod-db-canary / drift`)
2. Tek bir sticky PR comment (upsert)

## Components

### 1) Check payload builder

File: `src/features/reliability/canaryCheckPublisher.ts`

- `buildCanaryCheckRunPayload(signal, policy, now, checkName?)`
- `mapCanaryStatusToCheckConclusion(status, policy)`

Status mapping:

- `success` -> `success`
- `warn` + policy `warn` -> `neutral`
- `warn` + policy `fail` -> `failure`
- `fail` -> `failure`

### 2) Sticky comment upsert

- Marker: `<!-- canary-check:nonprod-db-canary-drift -->`
- `planStickyCommentUpsert(existingComments, body, botLogin)`
  - Marker + bot author eşleşmesi varsa `update`
  - Yoksa `create`

Bu sayede PR başına tek canary yorumunun güncellenmesi garanti edilir.

### 3) ArtifactStore abstraction

File: `src/features/reliability/artifactStore.ts`

- `ArtifactStore` interface:
  - `read(pointer)`
  - `write(input)`
  - `exists(pointer)`
- `GitHubArtifactStore`:
  - başlangıç adapter iskeleti
  - gerçek API akışı RLOOP-052'de tamamlanacak

### 4) Runtime config

File: `src/features/reliability/canaryCheckPublisherConfig.ts`

Config çözümleme:

- `CANARY_PUBLISHER_MODE=dry|live` (default: `dry`)
- `CANARY_DRIFT_POLICY=warn|fail`
- `CANARY_CHECK_NAME` (default: `nonprod-db-canary / drift`)
- `CANARY_STICKY_COMMENT_ENABLED` (default: `true`)
- `CANARY_ARTIFACT_SYNC_ENABLED` (default: `true`)

## RLOOP-052 Integration Update

### GitHub API client skeleton

File: `src/features/reliability/githubApi.ts`

- Checks API:
  - `createCheckRun(...)`
  - `updateCheckRun(...)`
- PR comments API:
  - `listPullRequestComments(...)`
  - `createPullRequestComment(...)`
  - `updatePullRequestComment(...)`
- Contents API (artifact draft):
  - `getRepoContent(...)`
  - `putRepoContent(...)`

### Retry/backoff and rate-limit behavior

- Exponential backoff + jitter (`DEFAULT_GITHUB_RETRY_POLICY`)
- Retry on `429`, `5xx`, and `403 secondary rate limit`
- `Retry-After` ve `X-RateLimit-Reset` header’larıyla bekleme süresi override

### Idempotency/duplicate controls

- Check-run payload artık deterministic `external_id` içerir
- Sticky comment upsert helper (`upsertCanaryStickyComment`) marker + bot-login ile tek yorumu günceller
- Artifact write pathi deterministic ve `sha` ile update/create ayrımı yapılır

### ArtifactStore update

File: `src/features/reliability/artifactStore.ts`

- `GitHubArtifactStore` artık draft seviyesinde read/write akışına sahip
- Path standardı: `<artifactNamePrefix>/<pointer.key>`
- `exists(pointer)` read bazlı çalışır

## RLOOP-053 Runtime Wiring Update

File: `src/features/reliability/canaryPublisherRuntime.ts`

- Check create/update + sticky comment upsert + artifact sync tek runtime akışında orkestra edilir
- Dry mode (`CANARY_PUBLISHER_MODE=dry`) güvenli default olarak side-effect üretmez
- `external_id` tabanlı dedupe guard ile duplicate publish baskılanır
- Observability için `action/outcome/endpoint` dimension setiyle metric emission hazırlanmıştır
