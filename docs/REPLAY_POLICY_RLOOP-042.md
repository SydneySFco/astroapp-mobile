# Replay Policy Hardening — RLOOP-042

## Amaç
DLQ replay akışını operasyonel olarak daha güvenli hale getirmek:
- jittered backoff
- max replay cap
- poison-message quarantine
- attempt-level telemetry

## Policy Kontratı
`ReplayPolicy`:
- `maxReplayCount`: replay deneme üst sınırı
- `baseReplayBackoffMs`: backoff başlangıç değeri
- `maxReplayBackoffMs`: backoff tavanı
- `jitterFactor`: [0..1] aralığında jitter katsayısı

## Backoff Formülü
`computeReplayBackoffMs(replayCount, policy)`:
1. Exponential: `base * 2^replayCount`
2. Clamp: `[base, max]`
3. Jitter: `*(1 ± jitterFactor)`

Bu yaklaşım senkron retry dalgalarını (thundering herd) azaltır.

## Quarantine Kuralları
Replay item quarantine edilir:
1. `replayCount >= maxReplayCount`
   - reason: `max_replay_cap_reached`
2. Son attempt class'ı `fatal`
   - reason: `poison_message_fatal_error`

Quarantine edilen item queue'dan `ack` ile düşülür ve yeniden replay edilmez.

## Telemetry
Replay tick telemetry alanları:
- `attemptLatencyMs`: tüm attempt latency değerleri
- `failureClassificationTags`: retryable/fatal/unknown sınıfları
- `quarantinedCount`: quarantine edilen item sayısı

## Operasyon Notu
`ReplayQuarantineStore` persistence'i infra'ya bırakılmıştır.
RLOOP-043'te quarantine retention/purge, dashboard read-model ve operator re-drive endpoint'i önerilir.
