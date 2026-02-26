# AstroApp Ralph Loop Backlog

## Loop Rules
- Her iterasyon bir Loop ID ile çalışır (RLOOP-XXX)
- Her iterasyon sonunda: build check + kısa rapor + commit + push
- Commit formatı: `RLOOP-XXX: <short outcome>`
- Bloker varsa: `BLOCKER`, etki, çözüm opsiyonu, bir sonraki adım

## Current Objective
MVP P0 akışlarını uçtan uca çalışır hale getirmek (Beginner-first, sub-first model).

## Iteration Queue

### RLOOP-002 — Auth P0 Hardening
- Scope:
  - Forgot Password ekranı/flow
  - Auth hata/başarı state’leri (inline + toast)
  - Register step indicator (1/5 ... 5/5)
- Output:
  - Auth akışı demo edilebilir
  - signup_start / signup_complete event

### RLOOP-003 — Onboarding Closure
- Scope:
  - Birth data validation (date/time/location)
  - Intent screen final copy
  - Onboarding completion summary screen
- Output:
  - İlk kişisel özet + Home'a geçiş

### RLOOP-004 — Paywall Core
- Scope:
  - Premium subscription ekranı (monthly/yearly)
  - success/fail/cancel/restore states
  - paywall_view / subscribe_success events
- Output:
  - Subscription flow P0 kapalı

### RLOOP-005 — Reports Upsell Flow
- Scope:
  - Reports marketplace -> detail -> checkout -> result
  - report_view / report_buy events
- Output:
  - One-off rapor satın alma uçtan uca

### RLOOP-006 — Settings + Legal P0
- Scope:
  - Settings basic (profile/logout/delete request)
  - Privacy/Terms/KVKK linkleri + onboarding consent
- Output:
  - Compliance P0 kapalı

### RLOOP-007 — Stability Gate
- Scope:
  - P0 ekranlarda empty/loading/error state
  - low-network/timeout handling
- Output:
  - Release gate smoke-ready

## Next Dispatch Rule
Steve bir iterasyonu bitirince Sydney bir sonraki iterasyonu otomatik dispatch eder. Gerekirse Bella’dan yalnızca product/copy kararı çekilir.
