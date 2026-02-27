# RLOOP-059 — Required-check Context Drift Auto-remediation

## Objective
RLOOP-058 detect-only drift guard, kontrollü remediation (dry-run + explicit apply) modeline yükseltildi.

## Delivered

- Enhanced script: `scripts/verify-required-check-contexts-rloop058.js`
  - New flags:
    - `--apply`
    - `--dry-run`
    - `--repo <owner/repo>`
    - `--branch <branch>`
    - `--canonical-only`
  - GitHub branch protection required contexts read + patch flow:
    - GET: `/branches/{branch}/protection`
    - PATCH: `/branches/{branch}/protection/required_status_checks`
  - Default mode: **dry-run** (non-destructive)
  - Apply mode: only with explicit `--apply` and valid GitHub token
  - Console summary: drift, remediation plan, planned vs applied

- CI detect integration:
  - `.github/workflows/ci-quality-gates.yml`
  - Guard step now explicitly runs `--dry-run`

- Script command additions:
  - `verify:required-check-contexts:rloop059:apply`

## Safety Model

1. Script default behavior is non-destructive (dry-run).
2. Changes to required checks happen only when:
   - `--apply` is passed
   - token is available (`GITHUB_TOKEN` or `--token`)
3. Planned/apply summary is always printed.
4. `--canonical-only` is opt-in and intentionally strict:
   - required contexts are aligned only to workflow contexts matching ` / required-check / `.

## Manual Apply Runbook

```bash
set -a && . ./.env && set +a

# Preview only
yarn verify:required-check-contexts:rloop058 \
  --dry-run \
  --repo SydneySFco/astroapp-mobile \
  --branch master \
  --policy fail \
  --on-api-error fail

# Apply remediation plan
yarn verify:required-check-contexts:rloop058 \
  --apply \
  --repo SydneySFco/astroapp-mobile \
  --branch master \
  --policy fail \
  --on-api-error fail

# Optional strict canonical alignment
yarn verify:required-check-contexts:rloop058 \
  --apply \
  --canonical-only \
  --repo SydneySFco/astroapp-mobile \
  --branch master
```

## Notes

- Existing workflow naming remains canonical target:
  - `CI Quality Gates / required-check / ci-quality-gates`
- Drift example handled:
  - stale: `quality-gates`
  - canonical: `CI Quality Gates / required-check / ci-quality-gates`
