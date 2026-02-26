# Branch Protection Setup (master)

Bu runbook `master` branch'i için required status checks ve drift guard adımlarını tanımlar.

## Required Status Checks (Canonical)

Configure branch protection to require:

- **CI Quality Gates / required-check / ci-quality-gates**

Optional / conditional (default required yapılmamalı):

- **Non-prod DB Canary Lane / required-check / nonprod-live-publish-gate**
  - Bu check yalnızca live publish path'inde görünür.

Publisher check-run (workflow context değil):

- `nonprod-db-canary / drift`

## Drift Guard (RLOOP-058)

Branch protection required context listesi ile repository workflow/job check context isimleri arasındaki drift CI içinde otomatik doğrulanır.

- Script: `scripts/verify-required-check-contexts-rloop058.js`
- CI integration: `CI Quality Gates` workflow step'i
  - `push` (master): drift varsa `fail`
  - `pull_request`: drift/API erişim problemi için `warn`

### Lokal doğrulama

```bash
set -a && . ./.env && set +a

yarn verify:required-check-contexts:rloop058 --branch master --policy fail --on-api-error fail
```

### Drift çıktısı nasıl okunur?

- `Missing in workflows`: Required listede var ama workflow/job context'lerinde yok
  - Fix: workflow/job name'i geri hizala veya stale required context'i branch protection'dan kaldır
- `Extra workflow contexts`: Workflow tarafında var ama required listede yok
  - Fix: merge gate olması gereken context ise branch protection required listesine ekle
- `Potential rename drift candidates`: olası rename eşleşmeleri (heuristic similarity)

---

## Option A — GitHub UI

1. Open repository: `SydneySFco/astroapp-mobile`
2. Go to **Settings → Branches**
3. Under **Branch protection rules**, click **Add rule** (or edit existing `master` rule)
4. Branch name pattern: `master`
5. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
6. In status checks, add/select:
   - `CI Quality Gates / required-check / ci-quality-gates`
7. (Recommended) Enable:
   - **Require branches to be up to date before merging**
   - **Require conversation resolution before merging**
   - **Do not allow bypassing the above settings**
8. Save changes.

---

## Option B — GitHub API

> Requires admin permission on the repository and a token with repo/admin scope.

```bash
set -a && . ./.env && set +a

curl -sS -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/SydneySFco/astroapp-mobile/branches/master/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["CI Quality Gates / required-check / ci-quality-gates"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_linear_history": true
  }'
```

Expected success: HTTP 200 with protection details in JSON.

If blocked by permissions, ask a repo admin to apply the same via UI using this document.
