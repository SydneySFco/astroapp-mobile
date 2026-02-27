# Required Check Naming Policy

Bu doküman, branch protection required status checks için naming standard'ı tanımlar.

## Canonical Pattern

Required context isimleri şu pattern'e uymalıdır:

`<Workflow Name> / required-check / <stable-lane-id>`

Örnek:

- `CI Quality Gates / required-check / ci-quality-gates`

## Rules

1. `required-check` segmenti zorunlu ve sabittir.
2. `<stable-lane-id>` küçük harf + kebab-case olmalıdır.
3. Workflow rename durumunda check context drift riski oluşur:
   - branch protection required contexts script ile kontrol edilmelidir.
4. Job display name değişiklikleri yapılırken branch protection required listesi eşzamanlı gözden geçirilmelidir.

## Drift Guard and Auto-remediation

Script:

- `scripts/verify-required-check-contexts-rloop058.js`

Modes:

- Detect (`--dry-run`, default)
- Apply (`--apply`, explicit)

Recommended flow:

1. PR/CI: detect mode (`--dry-run`)
2. Ops/manual: apply mode (`--apply`) with admin-capable token
3. Optional strict align: `--canonical-only`

## Why this policy exists

- Merge gate'lerin yanlış/boş check'e bakmasını engeller
- `quality-gates` vs `CI Quality Gates / required-check / ci-quality-gates` gibi drift vakalarını erken yakalar
- Gerektiğinde kontrollü ve denetlenebilir remediation sağlar
