# LIFECYCLE_TRANSITION_MATRIX

## Purpose
Client tarafında lifecycle state değişimlerini defensive olarak doğrulamak ve server-side policy/trigger kurallarına hazırlık sağlamak.

> Kaynak otorite her zaman backend'dir (`user_reports.status`). Bu matris frontend guard ve backend transition blocker kural seti için ortak referanstır.

## Valid Statuses
- `queued`
- `processing`
- `ready`

## Allowed Transitions
| From | To | Allowed | Notes |
|---|---|---|---|
| `queued` | `queued` | ✅ | idempotent event |
| `queued` | `processing` | ✅ | normal lifecycle ilerleyişi |
| `queued` | `ready` | ❌ | processing adımı atlanamaz |
| `processing` | `queued` | ❌ | rollback/stale event engellenir |
| `processing` | `processing` | ✅ | idempotent update |
| `processing` | `ready` | ✅ | terminal state |
| `ready` | `queued` | ❌ | terminal state geriye dönmez |
| `ready` | `processing` | ❌ | terminal state geriye dönmez |
| `ready` | `ready` | ✅ | idempotent update |

## Invalid Transition Block Matrix (Server-Side Policy Prep)
Backend trigger/policy kuralı aşağıdaki geçişleri reject etmelidir:

- `queued -> ready`
- `processing -> queued`
- `ready -> queued`
- `ready -> processing`

## Client Guard Notes
- Guard helper: `src/features/reports/lifecycleGuards.ts`
- Realtime event durumunda transition matrix + freshness guard (`updated_at` / `version`) birlikte kontrol edilir.
- Geçersiz veya stale event durumunda local state mutate edilmez, telemetry ile işaretlenir.
