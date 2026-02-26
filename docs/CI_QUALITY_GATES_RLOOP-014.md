# CI Quality Gates — RLOOP-014

## Amaç

Kod kalitesini CI üzerinde minimum zorunlu kapılarla güvenceye almak.

## Zorunlu Kapılar

- Install: `yarn install --frozen-lockfile`
- Lint: `yarn lint`
- TypeScript kontrolü: `yarn typecheck` (`tsc --noEmit`)

## Package Manager Politikası

- Standart: Yarn
- Ana lockfile: `yarn.lock`
- CI, `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb` dosyalarını policy ihlali olarak değerlendirir.

## Reliability Gate (RLOOP-037)

Nightly harness workflow içinde ek reliability gate:
- `scripts/eval-reliability-rloop036.py` ile `macro_ece` üretilir
- `scripts/reliability-gate-rloop037.py` warn/fail band uygular
  - Warn: `macro_ece >= reliability_warn_threshold`
  - Fail (job red): `macro_ece >= reliability_fail_threshold`
- Gate detayı artifact olarak yüklenir:
  - `reports/reliability-gate-rloop037.json`
  - `reports/reliability-gate-rloop037.md`

## PR Gate Notu

PR merge için CI job'unun yeşil olması zorunludur.
