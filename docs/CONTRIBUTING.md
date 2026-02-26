# Contributing Guide

This project enforces CI quality gates and loop-based traceability.

## Branch Naming

Use a branch name that contains the loop id:

- `feature/RLOOP-015-short-description`
- `fix/RLOOP-015-short-description`
- `chore/RLOOP-015-short-description`

Rules:
- Prefix should reflect the work type (`feature`, `fix`, `chore`, `docs`, `refactor`).
- Include exactly one loop id in `RLOOP-XXX` format.
- Use lowercase kebab-case for the remaining description.

## Commit Message Format

Commit messages must include a loop id in `RLOOP-XXX` format.

Recommended format:

- `RLOOP-015: enforce governance guardrails for CI and PR flow`

Rules:
- Start with `RLOOP-XXX:`
- Keep subject line imperative and concise.
- Group related changes in a single logical commit when possible.

## Pull Request Requirements

Before opening a PR:

1. Run `yarn lint`
2. Run `yarn typecheck`
3. Ensure docs are updated when behavior/process changes
4. Fill in `.github/pull_request_template.md`

## CI Quality Gates

The GitHub Actions workflow **CI Quality Gates** is required for merges to protected branches.

Current required checks:
- Lint
- Type check
