# Branch Protection Setup (master)

Bu runbook `master` branch'i için required status checks ve migration adımlarını tanımlar.

## Required Status Checks (Canonical)

Configure branch protection to require:

- **CI Quality Gates / required-check / ci-quality-gates**

Optional / conditional (default required yapılmamalı):

- **Non-prod DB Canary Lane / required-check / nonprod-live-publish-gate**
  - Bu check yalnızca live publish path'inde görünür.

Publisher check-run (workflow context değil):

- `nonprod-db-canary / drift`

## Migration Steps (RLOOP-057)

RLOOP-057 ile check context adları stabilize edildi. Eski context'ten geçiş için:

1. Branch protection required listesine yeni context'i ekle
2. Eski context'i geçici olarak koru
3. 1-2 başarılı PR sonrası eski context'i kaldır
4. Final listeyi bu dokümanla eşitle

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
