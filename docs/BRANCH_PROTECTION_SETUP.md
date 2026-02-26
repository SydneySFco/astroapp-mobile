# Branch Protection Setup (master)

This runbook describes how to enforce governance guardrails on `master`.

## Required Status Check

Configure branch protection to require:
- **CI Quality Gates**

---

## Option A — GitHub UI

1. Open repository: `SydneySFco/astroapp-mobile`
2. Go to **Settings → Branches**
3. Under **Branch protection rules**, click **Add rule**
4. Branch name pattern: `master`
5. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
6. In status checks, add/select:
   - `CI Quality Gates`
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
      "contexts": ["CI Quality Gates"]
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
