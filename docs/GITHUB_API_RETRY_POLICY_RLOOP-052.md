# GitHub API Retry Policy — RLOOP-052

## Policy

Default retry policy (`DEFAULT_GITHUB_RETRY_POLICY`):

- `maxAttempts`: `4`
- `baseDelayMs`: `500`
- `maxDelayMs`: `8000`
- `jitterRatio`: `0.2`

Backoff:

- Exponential: `baseDelayMs * 2^(attempt-1)`
- Delay cap: `maxDelayMs`
- Jitter: `delay + (delay * jitterRatio * random)`

## Retryable Conditions

Aşağıdaki durumlar retry edilir:

1. HTTP `429`
2. HTTP `5xx`
3. HTTP `403` + response body içinde `secondary rate limit`

## Rate-Limit Header Handling

Retry bekleme süresi hesaplama sırası:

1. `Retry-After` header (seconds veya HTTP-date)
2. `X-RateLimit-Reset` header (epoch seconds)
3. Local exponential backoff + jitter

## Secondary Rate Limit Notes

GitHub secondary rate limit, bursty parallel çağrılarda (özellikle comments/checks update dalgaları) görülebilir.

Öneriler:

- aynı PR için comment/check çağrılarını serialize et
- aynı run için duplicate publish çağrılarını dedupe et (`external_id`, marker)
- uzun vadede in-memory queue + per-repo concurrency guard ekle

## Idempotency & Duplicate Prevention

- Checks: deterministic `external_id`
- Sticky comments: marker + bot-login tabanlı upsert planı
- Artifacts: read-before-write (`sha`) + deterministic path

> Not: Header-level idempotency (`X-Idempotency-Key`) eklenmiştir fakat GitHub endpointlerinde tek başına yeterli duplicate garantisi olarak görülmemelidir.
