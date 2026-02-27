# RLOOP-060 — Required-check Drift Governance + Audit Trail

## Objective
Required-check drift detection/remediation akışını governance-grade traceability ve safety kontrolleriyle güçlendirmek.

## Delivered

- Enhanced guard script: `scripts/verify-required-check-contexts-rloop058.js`
  - Machine-readable audit artifact output (`--audit-file`)
  - Artifact includes:
    - timestamp
    - actor
    - mode (`dry-run|apply`)
    - branch/repo
    - before/after required contexts
    - drift diff + remediation plan
    - apply + verification result
  - Read-after-write verification (apply sonrası protection re-fetch + expected vs actual compare)
  - Allowlist / denylist policy safety:
    - `--allowlist`
    - `--denylist`
  - Dry-run default retained; apply explicit (`--apply`)

- CI integration (`.github/workflows/ci-quality-gates.yml`)
  - Detect step now emits audit JSON in non-destructive mode
  - Audit JSON uploaded via `actions/upload-artifact@v4`

- Docs / operator runbook (`docs/BRANCH_PROTECTION_SETUP.md`)
  - Governance model
  - Audit usage
  - allow/deny safety controls
  - rollback path

## Validation

```bash
yarn lint
yarn typecheck
```

## Operator snippets

```bash
# detect + audit
yarn verify:required-check-contexts:rloop058 \
  --dry-run \
  --repo SydneySFco/astroapp-mobile \
  --branch master \
  --audit-file artifacts/required-check-drift-audit.json

# explicit apply + verification
yarn verify:required-check-contexts:rloop058 \
  --apply \
  --repo SydneySFco/astroapp-mobile \
  --branch master \
  --audit-file artifacts/required-check-drift-audit.json
```
