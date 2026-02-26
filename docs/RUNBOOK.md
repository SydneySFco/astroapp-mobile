# RUNBOOK

## Package Manager Standardı

- Bu repo için tek standart paket yöneticisi: **Yarn (classic)**
- Referans sürüm: `yarn@1.22.22` (`package.json > packageManager`)
- Kurulum komutu: `yarn install`

## Lockfile Stratejisi

- Versiyonlanan lockfile: **`yarn.lock`**
- Kabul edilmeyen lockfile'lar: `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`
- Farklı lockfile oluşursa commit edilmeden kaldırılmalı.

## CI Quality Gates

CI aşağıdaki kontrolleri zorunlu çalıştırır:

1. Dependencies install (`yarn install --frozen-lockfile`)
2. Lint (`yarn lint`)
3. Type check (`yarn typecheck`)

PR/Push sırasında bu adımlardan biri başarısız olursa gate fail olur.
