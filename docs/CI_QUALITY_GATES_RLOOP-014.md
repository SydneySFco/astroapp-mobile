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

## PR Gate Notu

PR merge için CI job'unun yeşil olması zorunludur.
