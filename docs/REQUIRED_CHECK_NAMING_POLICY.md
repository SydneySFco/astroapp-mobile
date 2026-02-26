# Required Check Naming Policy

Bu doküman branch protection'da referanslanan check adlarının drift riskini azaltmak için naming standardını tanımlar.

## Goals

- Branch protection check isimleri **stabil** kalsın
- Workflow refactor/reusable split sırasında check-context kırılmasın
- Required-check migration adımları deterministic olsun

## Canonical Required Checks

Current canonical list:

1. `CI Quality Gates / required-check / ci-quality-gates`
2. `Non-prod DB Canary Lane / required-check / nonprod-live-publish-gate` *(live workflow_dispatch runs için)*
3. `nonprod-db-canary / drift` *(publisher check-run adı; workflow check context değil)*

> Not: 2 numara conditional bir gate'tir; yalnızca live publish path tetiklenince görünür.

## Naming Rules

1. Required check taşıyan job'larda `name:` zorunludur.
2. Prefix standardı: `required-check / <stable-id>`
3. `<stable-id>` alanı immutable kabul edilir.
4. Workflow `name:` alanı major governance değişikliği dışında değiştirilmez.
5. Reusable workflow çağıran parent job adı, branch protection context'i için source-of-truth kabul edilir.

## Change Management

Bir required-check adı değişecekse:

1. Önce yeni adı docs'a ekle
2. Branch protection'a **eski + yeni** birlikte geçici eklenir
3. En az 1-2 başarılı PR sonrası eski ad kaldırılır
4. Değişiklik notu `docs/RLOOP_XXX_NOTES.md` içinde migration evidence ile tutulur

## Anti-Patterns

- Job name'i otomatik/ephemeral değerle üretmek
- Workflow split sonrası check context doğrulamadan eski required list'i silmek
- Check adını env/input bazlı dinamikleştirmek
