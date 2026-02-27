# RLOOP-058 Notes — Required-check Context Drift Guard

## Objective

Branch protection required-check context listesi ile workflow/job check context adları arasındaki drift'i otomatik tespit eden guard eklemek.

## Implemented

1. **Drift guard script**
   - `scripts/verify-required-check-contexts-rloop058.js`
   - GitHub Branch Protection API (`/branches/{branch}/protection`) üzerinden required contexts çekilir
   - `.github/workflows/*.yml|yaml` dosyalarından workflow/job context listesi türetilir (`<workflow name> / <job name>`)
   - Drift analizi:
     - `missingInWorkflows`
     - `extraNotRequired`
     - olası rename eşleşmeleri (`renameSuggestions`, token similarity heuristic)
   - Actionable çıktı + önerilen fix adımları
   - Policy:
     - `--policy warn|fail`
     - `--on-api-error warn|fail`

2. **CI integration**
   - `CI Quality Gates` workflow sonuna guard step eklendi:
     - Step name: `Required-check context drift guard (RLOOP-058)`
     - `push` için `fail`, `pull_request` için `warn`
   - `package.json` script eklendi:
     - `verify:required-check-contexts:rloop058`

3. **Documentation updates**
   - `docs/BRANCH_PROTECTION_SETUP.md`
     - Canonical required context isimleri güncellendi
     - Drift guard kullanım/yorumlama bölümü eklendi

## Usage

```bash
set -a && . ./.env && set +a

yarn verify:required-check-contexts:rloop058 --branch master --policy fail --on-api-error fail
```

## Example actionable summary

- Missing in workflows: stale required context veya workflow rename drift
- Extra workflow contexts: branch protection required listesine eklenmesi gereken yeni gate
- Potential rename candidates: migration sırasında hangi context'in hangisine evrildiğine dair öneri
