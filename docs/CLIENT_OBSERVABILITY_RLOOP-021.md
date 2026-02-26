# RLOOP-021 — Client Observability Note

## Objective

Client tarafında `version` / `updated_at` uyumsuzluklarını telemetry event’lerine dönüştürüp backend enforcement etkisini izlemek.

## Event Mapping

## 1) `report_version_regression_detected`

**Ne zaman:**
- Aynı `report_id` için yeni gelen payload `version < local_version`.

**Payload:**
- `report_id`
- `local_version`
- `incoming_version`
- `local_updated_at`
- `incoming_updated_at`
- `screen`
- `app_version`

**Severity:** warning

## 2) `report_timestamp_regression_detected`

**Ne zaman:**
- `incoming_updated_at < local_updated_at` ama `incoming_version >= local_version`.

**Payload:**
- `report_id`
- `local_version`
- `incoming_version`
- `delta_ms`
- `network_state`
- `app_version`

**Severity:** warning

## 3) `report_version_gap_detected`

**Ne zaman:**
- `incoming_version - local_version > 1` (missed realtime event / late refresh sinyali)

**Payload:**
- `report_id`
- `local_version`
- `incoming_version`
- `gap`
- `last_sync_at`

**Severity:** info (yüksek frekansta olursa warning)

## 4) `report_stale_after_focus_refresh`

**Ne zaman:**
- Screen focus refresh sonrası payload hâlâ eski (`incoming == local` ve expected fresh değil)

**Payload:**
- `report_id`
- `version`
- `updated_at`
- `focus_refresh_duration_ms`
- `connectivity`

**Severity:** warning

## Dashboard / SLO Önerisi

- 24h içinde `*_regression_*` event oranı < %0.5
- `version_gap_detected` trendi release bazlı karşılaştırılmalı
- Event’ler `app_version`, `platform`, `network_state` kırılımında izlenmeli

## Notes

- Event’ler PII içermemeli.
- Raw payload yerine normalize edilmiş alanlar kullanılmalı.
- Sampling gerekiyorsa `info` event’lerde yapılmalı; `warning` event’ler full gönderilmeli.