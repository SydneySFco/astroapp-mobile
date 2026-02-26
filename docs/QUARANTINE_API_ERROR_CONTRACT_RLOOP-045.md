# QUARANTINE API Error Contract (RLOOP-045)

RLOOP-045 ile quarantine admin control-plane endpointleri için hata payload şekli ve status/code eşleşmesi netleştirildi.

## Standard Error Payload

```json
{
  "error": {
    "code": "stale",
    "message": "Quarantine state is stale for requested transition",
    "details": {
      "replayId": "r-101",
      "currentStatus": "redriven",
      "expectedStatus": "pending_review"
    }
  }
}
```

- `code`: makine-okunur sabit hata kodu
- `message`: insan-okunur açıklama
- `details`: opsiyonel debug/operasyonel alanlar

## Status / Code Matrix

- `400 bad_request`
  - replayId eksik
  - audit alanları eksik (`actorId`, `reason`, `approvalRef`)
  - invalid pagination/filter parametreleri
- `403 unauthorized`
  - gerekli role yok (`admin_ops` / `admin_approver`)
- `404 not_found`
  - replayId bulunamadı
  - route bulunamadı (router-level)
- `409 stale`
  - geçiş için beklenen state (`pending_review`) sağlanmıyor
- `409 idempotent_duplicate`
  - aynı `replayId+action+requestId` daha önce işlendi
- `500 internal_error`
  - beklenmeyen/normalize edilemeyen runtime hatası

## Stale vs Not Found

Önceki `quarantine_stale_or_not_found` belirsizliği ayrıştırıldı:
- Kayıt yoksa: `404 not_found`
- Kayıt var ama state transition koşulu tutmuyorsa: `409 stale`

## Idempotency Contract

`requestId` (body) veya `idempotency-key` header ile gelen çağrılar için dedup uygulanır.
Aynı request tekrarında:
- side-effect tekrar edilmez
- API `409 idempotent_duplicate` döner
- `details` altında önceki işlem metadata'sı taşınabilir (`processedAt`, `status`, `requestId`)

## Runtime/Repository Boundary

Repository katmanı `QuarantineAdminApiError` fırlatır.
HTTP handler katmanı bunu doğrudan status/code’ye mapler; unknown exception’lar `500 internal_error`a normalize edilir.

## RLOOP-046 Güncellemesi — SQLSTATE Mapping

DB-first idempotency + transactional RPC akışında SQLSTATE eşleşmesi:

- `P0002` → `404 not_found`
- `P0001` → `409 stale`
- `23505` → `409 idempotent_duplicate`
- diğer tüm DB hataları → `500 internal_error`

Bu mapping repository katmanında normalize edilip API contract’ına taşınır.

## RLOOP-046 Güncellemesi — Transaction Boundary

`state transition` + `audit write` adımları tek DB transaction boundary’de yürütülür.
Bu sayede yarım-yazım (state değişti ama audit yok / audit var ama state değişmedi) riski minimize edilir.
