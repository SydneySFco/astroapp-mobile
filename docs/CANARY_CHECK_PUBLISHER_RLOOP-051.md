# Canary Check Publisher — RLOOP-051 Draft

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

- `CANARY_DRIFT_POLICY=warn|fail`
- `CANARY_CHECK_NAME` (default: `nonprod-db-canary / drift`)
- `CANARY_STICKY_COMMENT_ENABLED` (default: `true`)

## Suggested integration order (RLOOP-052)

1. Workflow step: summary JSON parse + signal üretimi
2. Checks API call (create/update check-run)
3. PR comment upsert call
4. Artifact store read/write entegrasyonu
5. Retry/backoff + idempotency safeguards
