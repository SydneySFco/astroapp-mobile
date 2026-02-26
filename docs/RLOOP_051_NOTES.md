# RLOOP-051 Notes — Canary Check Publisher Draft

## Objective

Canary lane sonuçlarını PR check surface'e taşıyacak implementasyon taslağını üretmek:

- GitHub Checks payload builder
- Sticky PR comment upsert planı
- ArtifactStore abstraction + GitHub adapter skeleton
- Runtime policy/config wiring

## Delivered

1. **Check publisher skeleton**
   - `src/features/reliability/canaryCheckPublisher.ts`
   - `buildCanaryCheckRunPayload(...)`
   - `mapCanaryStatusToCheckConclusion(...)`
   - Status mapping: `success | warn | fail` → `success | neutral/failure | failure`

2. **Sticky comment upsert strategy**
   - Marker tabanlı tek comment yaklaşımı:
     - `<!-- canary-check:nonprod-db-canary-drift -->`
   - `planStickyCommentUpsert(...)` ile create/update kararı

3. **ArtifactStore abstraction**
   - `src/features/reliability/artifactStore.ts`
   - `ArtifactStore` interface (`read/write/exists`)
   - `GitHubArtifactStore` başlangıç adapter skeleton

4. **Runtime config wiring**
   - `src/features/reliability/canaryCheckPublisherConfig.ts`
   - Env tabanlı çözümleme:
     - `CANARY_DRIFT_POLICY=warn|fail`
     - `CANARY_CHECK_NAME`
     - `CANARY_STICKY_COMMENT_ENABLED`

## Validation

- `yarn lint`
- `yarn typecheck`

## Follow-up Candidate (RLOOP-052)

- GitHub API client entegrasyonu (Checks + PR comments + artifacts)
- Workflow içine publish adımını bağlama
- Idempotency/retry/backoff + rate-limit handling
- Dry-run ve fixture testleri (policy transition senaryoları)
